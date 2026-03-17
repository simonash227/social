import Anthropic from '@anthropic-ai/sdk'
import Parser from 'rss-parser'
import { getDb } from '@/db'
import { feedSources, feedEntries, activityLog, brands } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getModelConfig, checkAiSpend, logAiSpend } from '@/lib/ai'
import { getBreaker } from '@/lib/circuit-breaker'
import { sanitizeText } from '@/lib/sanitize'

// ─── Module-level singletons ──────────────────────────────────────────────────

const anthropic = new Anthropic()

const parser = new Parser({
  timeout: 10_000,
  headers: { 'User-Agent': 'SocialContentEngine/1.0' },
})

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedSource = typeof feedSources.$inferSelect
type Brand = typeof brands.$inferSelect

interface NewEntry {
  id: number
  feedSourceId: number
  title: string
  url: string
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Poll all enabled feed sources, insert new entries, batch-score with Haiku,
 * and auto-disable feeds that have accumulated 10+ consecutive failures.
 * Uses globalThis mutex to prevent overlapping cron ticks.
 */
export async function pollFeeds(): Promise<void> {
  const g = globalThis as Record<string, unknown>
  if (g.__feedPollRunning) {
    console.log('[feed-poll] skipping tick -- previous run still in progress')
    return
  }

  g.__feedPollRunning = true

  try {
    const db = getDb()

    // Query only enabled feed sources
    const enabledFeeds = db
      .select()
      .from(feedSources)
      .where(eq(feedSources.enabled, 1))
      .all()

    console.log(`[feed-poll] polling ${enabledFeeds.length} enabled feeds`)

    // Sequential iteration -- avoid overwhelming external servers
    for (const feed of enabledFeeds) {
      try {
        await pollSingleFeed(feed)
      } catch (err) {
        // Catch any unhandled error from pollSingleFeed to keep loop running
        console.error(`[feed-poll] unexpected error for feed ${feed.id}:`, err)
      }
    }
  } finally {
    g.__feedPollRunning = false
  }
}

// ─── Internal: poll a single feed ────────────────────────────────────────────

async function pollSingleFeed(feed: FeedSource): Promise<void> {
  const db = getDb()

  try {
    const parsed = await parser.parseURL(feed.url)
    const newEntries: NewEntry[] = []

    for (const item of parsed.items ?? []) {
      const url = item.link ?? item.guid
      if (!url) continue

      const title = sanitizeText(item.title ?? '')

      try {
        // Try inserting -- UNIQUE constraint on url means duplicates throw
        const result = db
          .insert(feedEntries)
          .values({
            feedSourceId: feed.id,
            url,
            title: title || null,
            createdAt: new Date().toISOString(),
          })
          .run()

        // lastInsertRowid is BigInt in better-sqlite3
        const insertedId = Number(result.lastInsertRowid)

        newEntries.push({ id: insertedId, feedSourceId: feed.id, title, url })
      } catch (insertErr) {
        // UNIQUE constraint violation = already seen, skip silently
        const msg = insertErr instanceof Error ? insertErr.message : String(insertErr)
        if (!msg.includes('UNIQUE')) {
          console.warn(`[feed-poll] Unexpected insert error for ${url}:`, insertErr)
        }
      }
    }

    // Batch Haiku scoring -- max 20 per poll
    if (newEntries.length > 0) {
      const toScore = newEntries.slice(0, 20)
      const brand = await getBrandForFeed(feed)
      await scoreBatch(feed, brand, toScore)
    }

    // Reset consecutive failures on success
    if (feed.consecutiveFailures > 0) {
      db.update(feedSources)
        .set({ consecutiveFailures: 0 })
        .where(eq(feedSources.id, feed.id))
        .run()
    }

    console.log(`[feed-poll] feed ${feed.id}: ${newEntries.length} new entries`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const newFailureCount = feed.consecutiveFailures + 1

    console.error(`[feed-poll] feed ${feed.id} failed (attempt ${newFailureCount}): ${message}`)

    if (newFailureCount >= 10) {
      // Auto-disable after 10 consecutive failures
      db.update(feedSources)
        .set({ consecutiveFailures: newFailureCount, enabled: 0 })
        .where(eq(feedSources.id, feed.id))
        .run()

      await logActivity(
        feed.brandId,
        'feed_poll',
        'error',
        `Feed ${feed.id} auto-disabled after 10 consecutive failures: ${message}`,
        { feedId: feed.id, url: feed.url, consecutiveFailures: newFailureCount }
      )
    } else {
      db.update(feedSources)
        .set({ consecutiveFailures: newFailureCount })
        .where(eq(feedSources.id, feed.id))
        .run()

      await logActivity(
        feed.brandId,
        'feed_poll',
        'error',
        `Feed ${feed.id} poll failed (${newFailureCount}/10): ${message}`,
        { feedId: feed.id, url: feed.url, consecutiveFailures: newFailureCount }
      )
    }
  }
}

// ─── Internal: get brand for a feed ──────────────────────────────────────────

async function getBrandForFeed(feed: FeedSource): Promise<Brand | null> {
  const db = getDb()
  return db
    .select()
    .from(brands)
    .where(eq(brands.id, feed.brandId))
    .get() ?? null
}

// ─── Internal: batch Haiku relevance scoring ─────────────────────────────────

async function scoreBatch(
  feed: FeedSource,
  brand: Brand | null,
  entries: NewEntry[]
): Promise<void> {
  // Check AI spend limit before calling
  const underLimit = await checkAiSpend()
  if (!underLimit) {
    console.log(`[feed-poll] AI spend limit reached -- skipping scoring for feed ${feed.id}`)
    return
  }

  const modelConfig = getModelConfig()
  const model = modelConfig.filter  // Haiku

  // Build a compact prompt listing all entries
  const brandContext = brand
    ? `Brand: "${brand.name}" (${brand.niche}). Topics: ${(brand.topics ?? []).join(', ') || 'general'}.`
    : 'General content.'

  const entryList = entries
    .map(e => `- ID ${e.id}: "${e.title || e.url}"`)
    .join('\n')

  const prompt = `You are a relevance scoring assistant.

${brandContext}

Rate the relevance of each article to this brand on a scale of 1-10, where:
- 1-3: Not relevant (unrelated topic)
- 4-6: Somewhat relevant (tangentially related)
- 7-10: Highly relevant (directly useful for content creation)

Articles:
${entryList}

Respond with ONLY a JSON array in this exact format (no other text):
[{"id": <id>, "score": <1-10>}, ...]`

  try {
    const breaker = getBreaker('anthropic-feed-scoring')
    const response = await breaker.call(() =>
      anthropic.messages.create({
        model,
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      })
    )

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''

    // Parse JSON response
    let scores: Array<{ id: number; score: number }> = []
    try {
      // Extract JSON array from the response (handle any preamble)
      const jsonMatch = rawText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        scores = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON array found in response')
      }
    } catch (parseErr) {
      console.warn(`[feed-poll] Failed to parse scoring response for feed ${feed.id}:`, parseErr)
      // Don't crash -- entries remain with null relevanceScore and will be re-scored on next poll
      return
    }

    // Update each entry's relevanceScore in DB
    const db = getDb()
    for (const { id, score } of scores) {
      if (typeof id === 'number' && typeof score === 'number' && score >= 1 && score <= 10) {
        db.update(feedEntries)
          .set({ relevanceScore: Math.round(score) })
          .where(eq(feedEntries.id, id))
          .run()
      }
    }

    // Log AI spend
    const inputTokens = response.usage.input_tokens
    const outputTokens = response.usage.output_tokens
    // Haiku pricing: $0.25/1M input, $1.25/1M output
    const costUsd = ((inputTokens * 0.00000025) + (outputTokens * 0.00000125)).toFixed(6)

    logAiSpend({
      brandId: feed.brandId,
      model,
      inputTokens,
      outputTokens,
      costUsd,
    })

    console.log(`[feed-poll] scored ${scores.length} entries for feed ${feed.id}`)
  } catch (err) {
    // Circuit breaker open or API error -- log but don't crash
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[feed-poll] Haiku scoring failed for feed ${feed.id}: ${message}`)

    await logActivity(
      feed.brandId,
      'feed_poll',
      'warn',
      `Haiku scoring failed for feed ${feed.id}: ${message}`,
      { feedId: feed.id, entryCount: entries.length }
    )
  }
}

// ─── Internal: activity log helper ───────────────────────────────────────────

async function logActivity(
  brandId: number,
  type: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const db = getDb()
    db.insert(activityLog).values({
      brandId,
      type,
      level,
      message,
      metadata: metadata as Record<string, unknown>,
      createdAt: new Date().toISOString(),
    }).run()
  } catch (err) {
    console.error('[feed-poll] Failed to log activity:', err)
  }
}
