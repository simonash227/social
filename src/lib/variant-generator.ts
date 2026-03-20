import { getDb } from '@/db'
import { brands } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getModelConfig, logAiSpend } from '@/lib/ai'
import { getBreaker } from '@/lib/circuit-breaker'
import {
  runCritique,
  buildSystemPrompt,
  buildGenerationPrompt,
  parseJsonResponse,
  calculateCostUsd,
  getAnthropic,
  type GeneratedContent,
} from '@/app/actions/generate'
import { loadLearnings, loadGoldenExamples } from '@/lib/prompt-injector'

// ─── Constants ────────────────────────────────────────────────────────────────

const TEMPERATURES = [0.7, 0.85, 1.0] as const

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VariantResult {
  platformContents: Record<string, string>
  qualityScore: number
  temperature: number
}

export interface GenerateVariantsResult {
  winner: VariantResult
  losers: VariantResult[]
  variantGroup: string
  activeLearningIds: number[]
  totalCostUsd: number
  error?: string
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * Generate 3 content variants at different temperatures, score each with
 * runCritique, and return the highest-scoring as winner with losers linked.
 *
 * If all calls fail, returns { error }. Partial failures are handled gracefully.
 */
export async function generateVariants(
  brandId: number,
  platforms: string[],
  sourceText: string,
  sourceUrl: string,
): Promise<GenerateVariantsResult> {
  const db = getDb()
  const modelConfig = getModelConfig()

  // 1. Query brand
  const brand = db.select().from(brands).where(eq(brands.id, brandId)).get()
  if (!brand) {
    return {
      winner: { platformContents: {}, qualityScore: 0, temperature: 0 },
      losers: [],
      variantGroup: crypto.randomUUID(),
      activeLearningIds: [],
      totalCostUsd: 0,
      error: 'Brand not found',
    }
  }

  // 2. Load learnings + golden examples for primary platform
  const primaryPlatform = platforms[0]
  const learnings = brand.learningInjection
    ? loadLearnings(brandId, primaryPlatform)
    : []
  const goldenExamples = loadGoldenExamples(brandId, primaryPlatform)

  // 3. Build prompts (shared across all 3 variants)
  const systemPrompt = buildSystemPrompt(brand, learnings, goldenExamples)
  const userPrompt = buildGenerationPrompt(platforms, sourceText, sourceUrl, brand)

  let totalCostUsd = 0
  const activeLearningIds = learnings.map(l => l.id)

  // 4. Call Haiku 3x concurrently at different temperatures
  const variantAttempts = await Promise.all(
    TEMPERATURES.map(async (temperature) => {
      try {
        const response = await getBreaker('anthropic').call(() =>
          getAnthropic().messages.create({
            model: modelConfig.primary,
            max_tokens: 4096,
            temperature,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          })
        )

        const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
        const costStr = calculateCostUsd(
          modelConfig.primary,
          response.usage.input_tokens,
          response.usage.output_tokens,
        )

        // 5. Log spend for each generation call individually
        logAiSpend({
          brandId,
          model: modelConfig.primary,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          costUsd: costStr,
        })

        totalCostUsd += parseFloat(costStr)

        // 6. Parse response
        const generatedContent = parseJsonResponse<GeneratedContent>(rawText)
        const platformContents: Record<string, string> = {}
        for (const platform of platforms) {
          const key = platform.toLowerCase()
          platformContents[key] = generatedContent[key]?.content ?? ''
        }

        return { ok: true as const, platformContents, temperature }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[variant-generator] Haiku call failed at temperature ${temperature}:`, message)
        return { ok: false as const, temperature, error: message }
      }
    })
  )

  // Filter to successful variants
  const successfulAttempts = variantAttempts.filter(a => a.ok)

  if (successfulAttempts.length === 0) {
    return {
      winner: { platformContents: {}, qualityScore: 0, temperature: 0 },
      losers: [],
      variantGroup: crypto.randomUUID(),
      activeLearningIds,
      totalCostUsd,
      error: 'All variant generation calls failed',
    }
  }

  // 7. Score each successful variant with runCritique on primary platform
  const brandVoice = `${brand.voiceTone}${brand.targetAudience ? ', targeting ' + brand.targetAudience : ''}`

  const scoredVariants: VariantResult[] = await Promise.all(
    successfulAttempts.map(async (attempt) => {
      const primaryContent = attempt.platformContents[primaryPlatform.toLowerCase()] ?? ''
      let qualityScore = 5 // default if critique fails

      if (primaryContent) {
        try {
          const critique = await runCritique(brandId, primaryPlatform, primaryContent, brandVoice)
          qualityScore = critique.overallScore
        } catch (err) {
          console.error(`[variant-generator] runCritique failed for temperature ${attempt.temperature}:`, err)
        }
      }

      return {
        platformContents: attempt.platformContents,
        qualityScore,
        temperature: attempt.temperature,
      }
    })
  )

  // 8. Sort by qualityScore descending — index 0 is winner
  scoredVariants.sort((a, b) => b.qualityScore - a.qualityScore)

  const [winner, ...losers] = scoredVariants

  return {
    winner,
    losers,
    variantGroup: crypto.randomUUID(),
    activeLearningIds,
    totalCostUsd,
  }
}
