'use server'

import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/db'
import { brands, posts, postPlatforms } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getModelConfig, checkAiSpend, logAiSpend } from '@/lib/ai'
import { getBreaker } from '@/lib/circuit-breaker'
import { sanitizeText } from '@/lib/sanitize'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

// ─── Module-level Anthropic client ───────────────────────────────────────────

const anthropic = new Anthropic()

// ─── Internal helpers ────────────────────────────────────────────────────────

type BrandRow = typeof brands.$inferSelect

function buildSystemPrompt(brand: BrandRow): string {
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
    'claude-haiku-3-20250307':  { input: 0.25,  output: 1.25  },
  }
  const p = pricing[model] ?? { input: 3.00, output: 15.00 }
  const cost = (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
  return cost.toFixed(6)
}

// ─── Exported server actions ─────────────────────────────────────────────────

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

    // 3. Sanitize source text if provided
    const cleanSourceText = sourceText ? sanitizeText(sourceText) : ''

    // 4. Build prompts
    const systemPrompt = buildSystemPrompt(brand)
    const userPrompt = buildGenerationPrompt(platforms, cleanSourceText, sourceUrl, brand)
    const modelConfig = getModelConfig()

    // 5. Generation call via circuit breaker
    const genResponse = await getBreaker('anthropic').call(() =>
      anthropic.messages.create({
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
      anthropic.messages.create({
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

export async function saveGeneratedPosts(
  brandId: number,
  platformContents: Record<string, string>,
  sourceText: string,
  sourceUrl: string
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
      qualityScore: null,
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
