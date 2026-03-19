import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/db'
import { brands, posts, postAnalytics, brandLearnings } from '@/db/schema'
import { eq, and, isNotNull, desc, sql } from 'drizzle-orm'
import { getModelConfig, checkAiSpend, logAiSpend } from '@/lib/ai'

// ─── Lazy-initialized Anthropic client ───────────────────────────────────────

let _anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!_anthropic) _anthropic = new Anthropic()
  return _anthropic
}

// ─── Pricing table (mirror of generate.ts, do NOT import from server action) ──

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3.00,  output: 15.00 },
  'claude-opus-4-20250514':   { input: 15.00, output: 75.00 },
  'claude-haiku-4-5-20251001':  { input: 0.80,  output: 4.00  },
}

function calculateCostUsd(model: string, inputTokens: number, outputTokens: number): string {
  const p = PRICING[model] ?? { input: 3.00, output: 15.00 }
  const cost = (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
  return cost.toFixed(6)
}

// ─── JSON response parser (mirror of generate.ts) ────────────────────────────

function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  try {
    return JSON.parse(cleaned) as T
  } catch {
    throw new Error(`Failed to parse AI response as JSON. Raw: ${cleaned.slice(0, 200)}`)
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LearningCandidate {
  type: 'hook_pattern' | 'topic_pattern' | 'structural_pattern' | 'avoid_pattern'
  description: string
  confidence: 'high' | 'medium' | 'low'
  supportingPostIds: number[]
}

interface PostForAnalysis {
  id: number
  content: string
  engagementScore: number
  platform: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPostForAnalysis(post: PostForAnalysis): string {
  return [
    `POST ID: ${post.id}`,
    `ENGAGEMENT SCORE: ${post.engagementScore}`,
    `HOOK (first 80 chars): ${post.content.slice(0, 80)}`,
    `LENGTH: ${post.content.length} chars`,
    `PLATFORM: ${post.platform}`,
  ].join('\n')
}

// ─── Core: analyzeForBrand ────────────────────────────────────────────────────

/**
 * Run learning analysis for a single brand+platform cohort.
 * Guards: 7-day time gate, 30-post data gate, AI spend gate.
 * All produced learnings are written with status='pending' (never auto-approved).
 */
export async function analyzeForBrand(
  brandId: number,
  platform: string,
  options?: { force?: boolean }
): Promise<{ skipped?: boolean; reason?: string; learningsWritten?: number }> {
  const db = getDb()
  const force = options?.force ?? false

  // ── 1. Time gate ──────────────────────────────────────────────────────────
  const brand = await db
    .select({ lastLearningRunAt: brands.lastLearningRunAt })
    .from(brands)
    .where(eq(brands.id, brandId))
    .get()

  if (!brand) return { skipped: true, reason: 'brand_not_found' }

  if (!force && brand.lastLearningRunAt) {
    const lastRun = new Date(brand.lastLearningRunAt).getTime()
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    if (lastRun > sevenDaysAgo) {
      return { skipped: true, reason: 'ran_recently' }
    }
  }

  // ── 2. Data gate: 30+ posts with engagement scores ────────────────────────
  const eligibleCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(postAnalytics)
    .innerJoin(posts, eq(postAnalytics.postId, posts.id))
    .where(
      and(
        eq(posts.brandId, brandId),
        eq(postAnalytics.platform, platform),
        isNotNull(postAnalytics.engagementScore)
      )
    )
    .get()

  if ((eligibleCount?.count ?? 0) < 30) {
    return { skipped: true, reason: 'insufficient_data' }
  }

  // ── 3. Spend gate ─────────────────────────────────────────────────────────
  const underLimit = await checkAiSpend()
  if (!underLimit) {
    return { skipped: true, reason: 'spend_limit' }
  }

  // ── 4. Query top 20 and bottom 10 performers ─────────────────────────────
  const allRows = await db
    .select({
      id: posts.id,
      content: posts.content,
      engagementScore: postAnalytics.engagementScore,
      platform: postAnalytics.platform,
    })
    .from(posts)
    .innerJoin(postAnalytics, eq(postAnalytics.postId, posts.id))
    .where(
      and(
        eq(posts.brandId, brandId),
        eq(postAnalytics.platform, platform),
        isNotNull(postAnalytics.engagementScore)
      )
    )
    .orderBy(desc(postAnalytics.engagementScore))
    .all()

  const topPerformers = allRows.slice(0, 20) as PostForAnalysis[]
  const underPerformers = allRows.slice(-10) as PostForAnalysis[]

  // ── 5. Format posts for analysis ─────────────────────────────────────────
  const topFormatted = topPerformers.map(formatPostForAnalysis).join('\n\n---\n\n')
  const underFormatted = underPerformers.map(formatPostForAnalysis).join('\n\n---\n\n')

  // ── 6. Claude analysis call ───────────────────────────────────────────────
  const modelConfig = getModelConfig()
  const model = modelConfig.primary

  const systemPrompt = [
    'You are an expert social media content analyst.',
    'Analyze the provided posts and extract up to 5 actionable learnings.',
    'Return ONLY a valid JSON array with no markdown fences or commentary.',
    'Each learning must follow this schema:',
    '{ "type": "hook_pattern"|"topic_pattern"|"structural_pattern"|"avoid_pattern",',
    '  "description": "max 100 chars",',
    '  "confidence": "high"|"medium"|"low",',
    '  "supportingPostIds": [1, 2] }',
    'For top performers: extract what made them succeed (hook_pattern, topic_pattern, structural_pattern).',
    'For underperformers: extract patterns to avoid (avoid_pattern).',
  ].join('\n')

  const userPrompt = [
    `Platform: ${platform}`,
    `Brand ID: ${brandId}`,
    '',
    '=== TOP PERFORMERS (highest engagement) ===',
    topFormatted,
    '',
    '=== UNDERPERFORMERS (lowest engagement) ===',
    underFormatted,
    '',
    'Extract up to 5 learnings as a JSON array.',
  ].join('\n')

  const response = await getAnthropic().messages.create({
    model,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  // ── 7. Parse response ─────────────────────────────────────────────────────
  const rawText = response.content[0].type === 'text' ? response.content[0].text : '[]'
  const candidates = parseJsonResponse<LearningCandidate[]>(rawText)

  // ── 8. Write learnings (all pending, never auto-approved) ─────────────────
  const now = new Date().toISOString()
  let learningsWritten = 0

  for (const candidate of candidates) {
    await db.insert(brandLearnings).values({
      brandId,
      platform,
      type: candidate.type,
      description: candidate.description.slice(0, 100),
      confidence: candidate.confidence,
      supportingPostIds: candidate.supportingPostIds ?? null,
      isActive: 1,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }).run()
    learningsWritten++
  }

  // ── 9. Update lastLearningRunAt ───────────────────────────────────────────
  await db
    .update(brands)
    .set({ lastLearningRunAt: now, updatedAt: now })
    .where(eq(brands.id, brandId))
    .run()

  // ── 10. Log AI spend ──────────────────────────────────────────────────────
  const costUsd = calculateCostUsd(model, response.usage.input_tokens, response.usage.output_tokens)
  logAiSpend({
    brandId,
    model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    costUsd,
  })

  console.log(`[learning-engine] brand=${brandId} platform=${platform}: wrote ${learningsWritten} learnings`)
  return { learningsWritten }
}

// ─── analyzeAllPlatformsForBrand ──────────────────────────────────────────────

/**
 * Run learning analysis for all platforms a brand has data for.
 */
export async function analyzeAllPlatformsForBrand(
  brandId: number,
  options?: { force?: boolean }
): Promise<void> {
  const db = getDb()

  const platformRows = await db
    .selectDistinct({ platform: postAnalytics.platform })
    .from(postAnalytics)
    .innerJoin(posts, eq(postAnalytics.postId, posts.id))
    .where(eq(posts.brandId, brandId))
    .all()

  for (const row of platformRows) {
    if (!row.platform) continue
    const result = await analyzeForBrand(brandId, row.platform, options)
    if (result.skipped) {
      console.log(`[learning-engine] brand=${brandId} platform=${row.platform}: skipped (${result.reason})`)
    }
  }
}

// ─── analyzeAllBrands ─────────────────────────────────────────────────────────

/**
 * Run learning analysis for all brands across all platforms.
 * Uses a globalThis mutex to prevent concurrent runs.
 */
export async function analyzeAllBrands(): Promise<void> {
  const g = globalThis as Record<string, unknown>
  if (g.__learningRunning) {
    console.log('[learning-engine] skipping -- previous run still in progress')
    return
  }

  g.__learningRunning = true

  try {
    const db = getDb()
    const allBrands = await db.select({ id: brands.id }).from(brands).all()

    for (const brand of allBrands) {
      await analyzeAllPlatformsForBrand(brand.id)
    }

    console.log(`[learning-engine] analyzeAllBrands complete: ${allBrands.length} brands processed`)
  } finally {
    g.__learningRunning = false
  }
}
