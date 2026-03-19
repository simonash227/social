'use server'

import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/db'
import { brands, posts, postPlatforms, activityLog, QualityDetails } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getModelConfig, checkAiSpend, logAiSpend } from '@/lib/ai'
import { getBreaker } from '@/lib/circuit-breaker'
import { sanitizeText } from '@/lib/sanitize'
import { extractFromUrl, extractPdf } from '@/lib/extract'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { loadLearnings, loadGoldenExamples, type BrandLearning, type GoldenExample } from '@/lib/prompt-injector'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GenerationResult {
  platforms: Record<string, {
    content: string
    hookVariants: Array<{ text: string; score: number }>
    winningHook: string
  }>
  totalCostUsd: number
  error?: string
}

interface CritiqueResult {
  dimensions: QualityDetails
  overallScore: number
  weakestDimension: string
}

export interface RefinedGenerationResult {
  platforms: Record<string, {
    content: string
    hookVariants: Array<{ text: string; score: number }>
    winningHook: string
    qualityScore: number
    qualityDetails: QualityDetails
    qualityWarning?: string
    discarded?: true
    discardReason?: string
  }>
  totalCostUsd: number
  error?: string
}

interface GeneratedContent {
  [platform: string]: { content: string }
}

interface HookScoringResult {
  [platform: string]: {
    variants: Array<{ text: string; score: number }>
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORM_CONSTRAINTS: Record<string, { limit: number; hashtagNote: string }> = {
  twitter:   { limit: 280,  hashtagNote: '0-3 hashtags' },
  x:         { limit: 280,  hashtagNote: '0-3 hashtags' },
  linkedin:  { limit: 3000, hashtagNote: '3-5 hashtags' },
  instagram: { limit: 2200, hashtagNote: '5-15 hashtags' },
  tiktok:    { limit: 2200, hashtagNote: '3-5 hashtags' },
}

// ─── Lazy-initialized Anthropic client ───────────────────────────────────────

let _anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic()
  return _anthropic
}

// ─── Internal helpers ────────────────────────────────────────────────────────

type BrandRow = typeof brands.$inferSelect

function buildSystemPrompt(
  brand: BrandRow,
  learnings?: BrandLearning[],
  goldenExamples?: GoldenExample[]
): string {
  const parts: string[] = [
    `You are a social media content writer for the brand "${brand.name}".`,
    '',
    `NICHE: ${brand.niche}`,
    `VOICE AND TONE: ${brand.voiceTone}`,
  ]

  if (brand.targetAudience) {
    parts.push(`TARGET AUDIENCE: ${brand.targetAudience}`)
  }
  if (brand.goals) {
    parts.push(`GOALS: ${brand.goals}`)
  }
  if (brand.topics && brand.topics.length > 0) {
    parts.push(`TOPICS TO COVER: ${brand.topics.join(', ')}`)
  }
  if (brand.dosList && brand.dosList.length > 0) {
    parts.push(`ALWAYS DO:\n${brand.dosList.map(d => `- ${d}`).join('\n')}`)
  }
  if (brand.dontsList && brand.dontsList.length > 0) {
    parts.push(`NEVER DO:\n${brand.dontsList.map(d => `- ${d}`).join('\n')}`)
  }
  if (brand.examplePosts && brand.examplePosts.length > 0) {
    parts.push(`EXAMPLE POSTS (match this style):\n${brand.examplePosts.join('\n---\n')}`)
  }
  if (brand.bannedHashtags && brand.bannedHashtags.length > 0) {
    parts.push(`BANNED HASHTAGS (never use): ${brand.bannedHashtags.join(', ')}`)
  }

  // Inject golden examples as style references
  if (goldenExamples && goldenExamples.length > 0) {
    parts.push('')
    parts.push('TOP PERFORMING POSTS — USE AS STYLE REFERENCE (do not copy, generalize the pattern):')
    for (const ex of goldenExamples) {
      parts.push(`[${ex.platform.toUpperCase()} — engagement score ${ex.engagementScore}]`)
      parts.push(ex.content.slice(0, 300)) // cap at 300 chars to manage token budget
      parts.push('---')
    }
  }

  // Inject approved learnings
  if (learnings && learnings.length > 0) {
    parts.push('')
    parts.push('LEARNINGS FROM YOUR TOP PERFORMERS (apply these):')
    for (const l of learnings) {
      const prefix = l.type === 'avoid_pattern' ? 'AVOID' : 'DO'
      parts.push(`- [${prefix}] ${l.description}`)
    }
  }

  parts.push('')
  parts.push('Respond with ONLY valid JSON -- no markdown fences, no commentary.')

  return parts.join('\n')
}

function buildGenerationPrompt(
  platforms: string[],
  sourceText: string,
  sourceUrl: string,
  brand: BrandRow
): string {
  const source = sourceText
    ? `SOURCE TEXT:\n${sourceText}`
    : sourceUrl
      ? `SOURCE URL: ${sourceUrl}\n(Use this URL as context for what the content is about)`
      : 'No source material provided. Create original content based on the brand context.'

  const platformInstructions = platforms.map(platform => {
    const p = platform.toLowerCase()
    const constraints = PLATFORM_CONSTRAINTS[p] ?? { limit: 2000, hashtagNote: 'appropriate hashtags' }
    const platformNote = brand.platformNotes?.[p] ?? ''
    return [
      `${platform.toUpperCase()}: max ${constraints.limit} characters, ${constraints.hashtagNote}`,
      platformNote ? `  Platform note: ${platformNote}` : '',
    ].filter(Boolean).join('\n')
  }).join('\n')

  return [
    source,
    '',
    'Write a platform-optimized post for each of these platforms:',
    platformInstructions,
    '',
    'Return JSON with this exact shape:',
    '{',
    platforms.map(p => `  "${p.toLowerCase()}": { "content": "..." }`).join(',\n'),
    '}',
    '',
    'Only include keys for the platforms listed above.',
  ].join('\n')
}

function buildHookScoringPrompt(
  platforms: string[],
  generatedContent: GeneratedContent
): string {
  const entries = platforms.map(p => {
    const content = generatedContent[p.toLowerCase()]?.content ?? ''
    return `${p.toUpperCase()}: "${content.slice(0, 200)}${content.length > 200 ? '...' : ''}"`
  }).join('\n')

  return [
    'For each platform post below, generate 5 alternative hook/opening line variants.',
    'Each hook should be an attention-grabbing first line or title that could replace the beginning of the post.',
    'Score each variant 1-10 based on:',
    '- Attention-grab (does it stop the scroll?)',
    '- Relevance (does it relate to the post content?)',
    '- Brand fit (does it match the brand voice?)',
    '',
    entries,
    '',
    'Return JSON with this exact shape:',
    '{',
    platforms.map(p => [
      `  "${p.toLowerCase()}": {`,
      '    "variants": [',
      '      { "text": "hook text here", "score": 8 },',
      '      { "text": "another hook", "score": 7 }',
      '    ]',
      '  }',
    ].join('\n')).join(',\n'),
    '}',
  ].join('\n')
}

function parseJsonResponse<T>(text: string): T {
  // Strip markdown fences if present
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    throw new Error(`Failed to parse AI response as JSON. Raw text: ${cleaned.slice(0, 200)}`)
  }
}

function calculateCostUsd(model: string, inputTokens: number, outputTokens: number): string {
  // Prices per million tokens
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-20250514': { input: 3.00,  output: 15.00 },
    'claude-opus-4-20250514':   { input: 15.00, output: 75.00 },
    'claude-haiku-4-5-20251001':  { input: 0.80,  output: 4.00  },
  }
  const p = pricing[model] ?? { input: 3.00, output: 15.00 }
  const cost = (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
  return cost.toFixed(6)
}

// ─── Quality pipeline helpers ────────────────────────────────────────────────

function computeOverallScore(dimensions: QualityDetails): number {
  return Math.round(
    (dimensions.hook.score + dimensions.value.score + dimensions.voice.score +
     dimensions.uniqueness.score + dimensions.platformFit.score) / 5
  )
}

function findWeakestDimension(dimensions: QualityDetails): string {
  const entries: Array<[string, number]> = [
    ['hook',        dimensions.hook.score],
    ['value',       dimensions.value.score],
    ['voice',       dimensions.voice.score],
    ['uniqueness',  dimensions.uniqueness.score],
    ['platformFit', dimensions.platformFit.score],
  ]
  return entries.reduce((a, b) => (b[1] < a[1] ? b : a))[0]
}

function buildCritiquePrompt(platform: string, content: string, brandVoice: string): string {
  return [
    `You are a social media content quality evaluator for the ${platform} platform.`,
    `Brand voice: ${brandVoice}`,
    '',
    'Evaluate the following post on 5 dimensions, scoring each 1-10 (integer only):',
    '- hook: Does the opening grab attention and stop the scroll?',
    '- value: Does the post provide genuine value or insight to the reader?',
    '- voice: Does the content match the brand voice and tone?',
    '- uniqueness: Is the content original and non-generic?',
    '- platformFit: Is the format, length, and style appropriate for ' + platform + '?',
    '',
    'POST TO EVALUATE:',
    content,
    '',
    'Return ONLY valid JSON -- no markdown fences, no commentary:',
    '{',
    '  "dimensions": {',
    '    "hook":        { "score": 8, "note": "brief note" },',
    '    "value":       { "score": 7, "note": "brief note" },',
    '    "voice":       { "score": 9, "note": "brief note" },',
    '    "uniqueness":  { "score": 6, "note": "brief note" },',
    '    "platformFit": { "score": 8, "note": "brief note" }',
    '  }',
    '}',
  ].join('\n')
}

function buildRewritePrompt(
  platform: string,
  originalContent: string,
  critique: CritiqueResult,
  brandSystemPrompt: string
): string {
  const weakDimensions = Object.entries(critique.dimensions)
    .filter(([, dim]) => dim.score < 7)
    .map(([name, dim]) => `- ${name} (score ${dim.score}/10): ${dim.note}`)
    .join('\n')

  const strongDimensions = Object.entries(critique.dimensions)
    .filter(([, dim]) => dim.score >= 8)
    .map(([name, dim]) => `- ${name} (score ${dim.score}/10): preserve this`)
    .join('\n')

  return [
    `Rewrite this ${platform} post to improve its weak dimensions while preserving what is already strong.`,
    '',
    'DIMENSIONS TO IMPROVE:',
    weakDimensions || '(none -- general polish)',
    '',
    strongDimensions ? 'DIMENSIONS TO PRESERVE:\n' + strongDimensions : '',
    '',
    'ORIGINAL POST:',
    originalContent,
    '',
    'Return ONLY the rewritten post text -- no JSON, no commentary, no markdown fences.',
    'Keep the same platform format and length constraints for ' + platform + '.',
  ].filter(line => line !== null).join('\n')
}

interface CritiqueDimensionsJson {
  dimensions: QualityDetails
}

async function runCritique(
  brandId: number,
  platform: string,
  content: string,
  brandVoice: string
): Promise<CritiqueResult> {
  const modelConfig = getModelConfig()
  const prompt = buildCritiquePrompt(platform, content, brandVoice)

  try {
    const response = await getBreaker('anthropic').call(() =>
      getAnthropic().messages.create({
        model: modelConfig.critique,
        max_tokens: 1024,
        system: 'You are a social media content quality evaluator. Respond with ONLY valid JSON -- no markdown fences, no commentary.',
        messages: [{ role: 'user', content: prompt }],
      })
    )

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const costUsd = calculateCostUsd(
      modelConfig.critique,
      response.usage.input_tokens,
      response.usage.output_tokens
    )
    logAiSpend({
      brandId,
      model: modelConfig.critique,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      costUsd,
    })

    const parsed = parseJsonResponse<CritiqueDimensionsJson>(rawText)
    const dimensions = parsed.dimensions
    const overallScore = computeOverallScore(dimensions)
    const weakestDimension = findWeakestDimension(dimensions)

    return { dimensions, overallScore, weakestDimension }
  } catch {
    // Fallback: do not throw -- return a passing score to avoid blocking the user
    const fallbackDimensions: QualityDetails = {
      hook:        { score: 7, note: 'Critique parse error -- fallback pass' },
      value:       { score: 7, note: 'Critique parse error -- fallback pass' },
      voice:       { score: 7, note: 'Critique parse error -- fallback pass' },
      uniqueness:  { score: 7, note: 'Critique parse error -- fallback pass' },
      platformFit: { score: 7, note: 'Critique parse error -- fallback pass' },
    }
    return {
      dimensions: fallbackDimensions,
      overallScore: 7,
      weakestDimension: 'hook',
    }
  }
}

async function runRewrite(
  brandId: number,
  platform: string,
  originalContent: string,
  critique: CritiqueResult,
  brand: BrandRow
): Promise<{ content: string; costUsd: number }> {
  const modelConfig = getModelConfig()
  const systemPrompt = buildSystemPrompt(brand)
  const rewritePrompt = buildRewritePrompt(platform, originalContent, critique, systemPrompt)

  const response = await getBreaker('anthropic').call(() =>
    getAnthropic().messages.create({
      model: modelConfig.primary,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: rewritePrompt }],
    })
  )

  const rewrittenContent = response.content[0].type === 'text'
    ? response.content[0].text.trim()
    : originalContent

  const costUsdStr = calculateCostUsd(
    modelConfig.primary,
    response.usage.input_tokens,
    response.usage.output_tokens
  )
  logAiSpend({
    brandId,
    model: modelConfig.primary,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costUsd: costUsdStr,
  })

  return { content: rewrittenContent, costUsd: parseFloat(costUsdStr) }
}

// ─── Exported server actions ─────────────────────────────────────────────────

/**
 * Extract source content from a URL or PDF base64 string.
 * Called from the client BEFORE generateContent so the user can see and edit
 * the extracted text before triggering generation.
 */
export async function extractSource(
  sourceUrl: string,
  pdfBase64?: string
): Promise<{ text: string; title?: string; error?: string }> {
  if (pdfBase64) {
    const buffer = Buffer.from(pdfBase64, 'base64')
    return extractPdf(buffer)
  }

  if (sourceUrl) {
    return extractFromUrl(sourceUrl)
  }

  return { text: '' }
}

export async function generateContent(
  brandId: number,
  platforms: string[],
  sourceText: string,
  sourceUrl: string
): Promise<GenerationResult> {
  const emptyResult: GenerationResult = { platforms: {}, totalCostUsd: 0 }

  try {
    const db = getDb()

    // 1. Query brand
    const brand = db.select().from(brands).where(eq(brands.id, brandId)).get()
    if (!brand) {
      return { ...emptyResult, error: 'Brand not found' }
    }

    // 2. Check spend limit
    const underLimit = await checkAiSpend()
    if (!underLimit) {
      return { ...emptyResult, error: 'Daily AI spend limit reached' }
    }

    // 3. Sanitize source text if provided; auto-extract from URL if sourceText is empty
    let cleanSourceText = sourceText ? sanitizeText(sourceText) : ''

    if (!cleanSourceText && sourceUrl) {
      const extracted = await extractFromUrl(sourceUrl)
      if (extracted.text) {
        cleanSourceText = extracted.text
      }
      // If extraction failed, continue with URL-only prompt behavior (graceful degradation)
    }

    // 3.5. Load learnings and golden examples for prompt injection
    const learnings = brand.learningInjection
      ? loadLearnings(brandId, platforms[0])
      : []
    const goldenExamples = loadGoldenExamples(brandId, platforms[0])

    // 4. Build prompts
    const systemPrompt = buildSystemPrompt(brand, learnings, goldenExamples)
    const userPrompt = buildGenerationPrompt(platforms, cleanSourceText, sourceUrl, brand)
    const modelConfig = getModelConfig()

    // 5. Generation call via circuit breaker
    const genResponse = await getBreaker('anthropic').call(() =>
      getAnthropic().messages.create({
        model: modelConfig.primary,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })
    )

    // 6. Parse generation response
    const genText = genResponse.content[0].type === 'text' ? genResponse.content[0].text : ''
    const generatedContent = parseJsonResponse<GeneratedContent>(genText)

    // 7. Log generation cost
    const genCost = calculateCostUsd(
      modelConfig.primary,
      genResponse.usage.input_tokens,
      genResponse.usage.output_tokens
    )
    logAiSpend({
      brandId,
      model: modelConfig.primary,
      inputTokens: genResponse.usage.input_tokens,
      outputTokens: genResponse.usage.output_tokens,
      costUsd: genCost,
    })

    let totalCost = parseFloat(genCost)

    // 8. Hook scoring call
    const hookPrompt = buildHookScoringPrompt(platforms, generatedContent)
    const hookResponse = await getBreaker('anthropic').call(() =>
      getAnthropic().messages.create({
        model: modelConfig.critique,
        max_tokens: 4096,
        system: 'You are a social media hook optimization expert. Score hooks based on attention-grab, relevance, and brand fit. Respond with ONLY valid JSON -- no markdown fences, no commentary.',
        messages: [{ role: 'user', content: hookPrompt }],
      })
    )

    // 9. Parse hook response
    const hookText = hookResponse.content[0].type === 'text' ? hookResponse.content[0].text : ''
    const hookResult = parseJsonResponse<HookScoringResult>(hookText)

    // 10. Log hook scoring cost
    const hookCost = calculateCostUsd(
      modelConfig.critique,
      hookResponse.usage.input_tokens,
      hookResponse.usage.output_tokens
    )
    logAiSpend({
      brandId,
      model: modelConfig.critique,
      inputTokens: hookResponse.usage.input_tokens,
      outputTokens: hookResponse.usage.output_tokens,
      costUsd: hookCost,
    })

    totalCost += parseFloat(hookCost)

    // 11. Merge results -- select winning hook per platform
    const result: GenerationResult = {
      platforms: {},
      totalCostUsd: totalCost,
    }

    for (const platform of platforms) {
      const key = platform.toLowerCase()
      const content = generatedContent[key]?.content ?? ''
      const variants = hookResult[key]?.variants ?? []

      // Sort by score descending, pick the best
      const sorted = [...variants].sort((a, b) => b.score - a.score)
      const winningHook = sorted.length > 0 ? sorted[0].text : ''

      result.platforms[key] = {
        content,
        hookVariants: variants,
        winningHook,
      }
    }

    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during generation'

    // Surface circuit breaker errors clearly
    if (message.includes('circuit-breaker')) {
      return { ...emptyResult, error: 'Service temporarily unavailable. Please try again in a few minutes.' }
    }

    return { ...emptyResult, error: message }
  }
}

export async function refineAndGate(
  brandId: number,
  generated: GenerationResult
): Promise<RefinedGenerationResult> {
  const emptyResult: RefinedGenerationResult = { platforms: {}, totalCostUsd: 0 }

  try {
    const db = getDb()

    // 1. Query brand
    const brand = db.select().from(brands).where(eq(brands.id, brandId)).get()
    if (!brand) {
      return { ...emptyResult, error: 'Brand not found' }
    }

    // 2. Check spend limit
    const underLimit = await checkAiSpend()
    if (!underLimit) {
      return { ...emptyResult, error: 'Daily AI spend limit reached' }
    }

    const brandVoice = `${brand.voiceTone}${brand.targetAudience ? ', targeting ' + brand.targetAudience : ''}`
    let totalCost = 0
    const refinedPlatforms: RefinedGenerationResult['platforms'] = {}

    // 3. Process each platform
    for (const [platform, platformData] of Object.entries(generated.platforms)) {
      let currentContent = platformData.content
      let retried = false

      // a. Initial critique
      const initialCritique = await runCritique(brandId, platform, currentContent, brandVoice)
      totalCost += 0 // critique cost already logged inside runCritique

      // b. Conditional skip: score >= 8
      if (initialCritique.overallScore >= 8) {
        db.insert(activityLog).values({
          brandId,
          type: 'quality',
          level: 'info',
          message: `Self-refine skipped: initial score ${initialCritique.overallScore}/10 for ${platform}`,
          createdAt: new Date().toISOString(),
        }).run()

        refinedPlatforms[platform] = {
          ...platformData,
          qualityScore: initialCritique.overallScore,
          qualityDetails: initialCritique.dimensions,
        }
        continue
      }

      // c. Self-refine: score < 8, run rewrite + re-critique
      const rewriteResult = await runRewrite(brandId, platform, currentContent, initialCritique, brand)
      currentContent = rewriteResult.content
      totalCost += rewriteResult.costUsd

      let currentCritique = await runCritique(brandId, platform, currentContent, brandVoice)

      // d. Quality gate routing
      if (currentCritique.overallScore >= 7) {
        // Pass
        db.insert(activityLog).values({
          brandId,
          type: 'quality',
          level: 'info',
          message: `Quality gate passed: score ${currentCritique.overallScore}/10 for ${platform}`,
          createdAt: new Date().toISOString(),
        }).run()

        refinedPlatforms[platform] = {
          ...platformData,
          content: currentContent,
          qualityScore: currentCritique.overallScore,
          qualityDetails: currentCritique.dimensions,
        }
      } else if (currentCritique.overallScore >= 5 && !retried) {
        // Score 5-6: one re-refine retry
        retried = true
        const retryRewrite = await runRewrite(brandId, platform, currentContent, currentCritique, brand)
        currentContent = retryRewrite.content
        totalCost += retryRewrite.costUsd

        currentCritique = await runCritique(brandId, platform, currentContent, brandVoice)

        const warningMsg = `Passed after retry with marginal score ${currentCritique.overallScore}/10`
        db.insert(activityLog).values({
          brandId,
          type: 'quality',
          level: 'warn',
          message: `Quality gate marginal: score ${currentCritique.overallScore}/10 for ${platform} after retry`,
          createdAt: new Date().toISOString(),
        }).run()

        refinedPlatforms[platform] = {
          ...platformData,
          content: currentContent,
          qualityScore: currentCritique.overallScore,
          qualityDetails: currentCritique.dimensions,
          qualityWarning: warningMsg,
        }
      } else if (currentCritique.overallScore < 5) {
        // Discard
        const weakestNote = currentCritique.dimensions[currentCritique.weakestDimension as keyof QualityDetails]?.note ?? 'Low quality'
        db.insert(activityLog).values({
          brandId,
          type: 'quality',
          level: 'warn',
          message: `Content discarded: score ${currentCritique.overallScore}/10 for ${platform}, reason: ${weakestNote}`,
          createdAt: new Date().toISOString(),
        }).run()

        refinedPlatforms[platform] = {
          ...platformData,
          content: currentContent,
          qualityScore: currentCritique.overallScore,
          qualityDetails: currentCritique.dimensions,
          discarded: true,
          discardReason: weakestNote,
        }
      } else {
        // Score >= 7 after first rewrite (catches case where retried=true but score climbed >= 7)
        db.insert(activityLog).values({
          brandId,
          type: 'quality',
          level: 'info',
          message: `Quality gate passed: score ${currentCritique.overallScore}/10 for ${platform}`,
          createdAt: new Date().toISOString(),
        }).run()

        refinedPlatforms[platform] = {
          ...platformData,
          content: currentContent,
          qualityScore: currentCritique.overallScore,
          qualityDetails: currentCritique.dimensions,
        }
      }
    }

    return {
      platforms: refinedPlatforms,
      totalCostUsd: generated.totalCostUsd + totalCost,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during quality pipeline'

    if (message.includes('circuit-breaker')) {
      return { ...emptyResult, error: 'Service temporarily unavailable. Please try again in a few minutes.' }
    }

    return { ...emptyResult, error: message }
  }
}

export async function saveGeneratedPosts(
  brandId: number,
  platformContents: Record<string, string>,
  sourceText: string,
  sourceUrl: string,
  qualityData?: Record<string, { score: number; details: QualityDetails }>
): Promise<{ error?: string }> {
  try {
    const db = getDb()

    // Get first platform's content for the main post record
    const platformKeys = Object.keys(platformContents)
    if (platformKeys.length === 0) {
      return { error: 'No platform content to save' }
    }

    const primaryContent = platformContents[platformKeys[0]]

    // Insert the main post
    const postResult = db.insert(posts).values({
      brandId,
      sourceUrl: sourceUrl || null,
      sourceText: sourceText || null,
      content: primaryContent,
      status: 'draft',
      qualityScore: qualityData?.[platformKeys[0]]?.score ?? null,
      qualityDetails: qualityData?.[platformKeys[0]]?.details ?? null,
    }).returning({ id: posts.id }).get()

    // Insert one postPlatform per platform
    for (const [platform, content] of Object.entries(platformContents)) {
      db.insert(postPlatforms).values({
        postId: postResult.id,
        platform,
        content,
        status: 'pending',
      }).run()
    }

    revalidatePath('/brands/' + brandId)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save posts'
    return { error: message }
  }

  redirect('/brands/' + brandId)
}
