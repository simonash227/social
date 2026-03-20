import { getDb } from '@/db'
import {
  feedEntries,
  feedSources,
  brands,
  posts,
  postPlatforms,
  socialAccounts,
  activityLog,
} from '@/db/schema'
import { and, eq, isNotNull, isNull, gte, sql } from 'drizzle-orm'
import { extractFromUrl } from '@/lib/extract'
import { checkSpamGuard } from '@/lib/spam-guard'
import { generateContent, refineAndGate } from '@/app/actions/generate'
import { scheduleToNextSlot } from '@/app/actions/schedule'

// ─── Types ────────────────────────────────────────────────────────────────────

// Platform hashtag limits: [min, max]
const HASHTAG_LIMITS: Record<string, [number, number]> = {
  twitter:   [0, 3],
  x:         [0, 3],
  instagram: [5, 15],
  linkedin:  [3, 5],
  tiktok:    [3, 5],
}

// ─── Hashtag enforcement helper ───────────────────────────────────────────────

/**
 * Enforce platform hashtag limits.
 * If over max: trim hashtags from end until within range.
 * If under min: do NOT add (would be spam with random hashtags).
 */
function enforceHashtags(platform: string, content: string): string {
  const limits = HASHTAG_LIMITS[platform.toLowerCase()]
  if (!limits) return content

  const [, max] = limits

  // Extract all hashtags and their positions
  const hashtagRegex = /#\w+/g
  const hashtags = [...content.matchAll(hashtagRegex)]

  if (hashtags.length <= max) {
    // Already within limits -- no trimming needed
    return content
  }

  // Over max: remove hashtags from end until at max
  // Work through hashtags in reverse order and remove the excess
  let result = content
  let count = hashtags.length

  // Iterate hashtags from the end
  for (let i = hashtags.length - 1; i >= 0 && count > max; i--) {
    const tag = hashtags[i][0]
    const idx = result.lastIndexOf(tag)
    if (idx !== -1) {
      // Remove the hashtag and any leading whitespace before it
      result = result.slice(0, idx).trimEnd() + result.slice(idx + tag.length)
      count--
    }
  }

  return result.trim()
}

// ─── Content mix dedup helper ─────────────────────────────────────────────────

/**
 * Extract top N keywords from a title string (words > 4 chars, normalized).
 */
function extractKeywords(title: string, n = 3): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4)
    .slice(0, n)
}

/**
 * Check if this entry's content has already been covered for this brand within 48 hours.
 * Returns: { skip: true, reason: string } | { skip: false }
 */
async function checkContentMix(
  brandId: number,
  entryUrl: string,
  entryTitle: string | null,
): Promise<{ skip: boolean; reason?: string }> {
  const db = getDb()
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  // 1. Exact URL match in last 48h
  const urlMatch = db
    .select({ id: posts.id })
    .from(posts)
    .where(
      and(
        eq(posts.brandId, brandId),
        eq(posts.sourceUrl, entryUrl),
        gte(posts.createdAt, fortyEightHoursAgo),
      ),
    )
    .get()

  if (urlMatch) {
    return { skip: true, reason: 'Skipped -- topic already covered within 48h (exact URL match)' }
  }

  // 2. Keyword overlap check (>50% of top 3 keywords found in recent post titles)
  if (entryTitle) {
    const entryKeywords = extractKeywords(entryTitle)
    if (entryKeywords.length > 0) {
      const recentPosts = db
        .select({ sourceText: posts.sourceText, content: posts.content })
        .from(posts)
        .where(
          and(
            eq(posts.brandId, brandId),
            gte(posts.createdAt, fortyEightHoursAgo),
          ),
        )
        .all()

      for (const post of recentPosts) {
        const textToSearch = (post.content + ' ' + (post.sourceText ?? '')).toLowerCase()
        const matches = entryKeywords.filter(kw => textToSearch.includes(kw))
        if (entryKeywords.length > 0 && matches.length / entryKeywords.length > 0.5) {
          return {
            skip: true,
            reason: `Skipped -- topic already covered within 48h (keyword overlap: ${matches.join(', ')})`,
          }
        }
      }
    }
  }

  return { skip: false }
}

// ─── Save post helper (non-server-action) ─────────────────────────────────────

interface AutoPostInput {
  brandId: number
  feedEntryId: number
  sourceUrl: string
  sourceText: string
  platformContents: Record<string, string>
  qualityData: Record<string, { score: number }>
  status: 'draft' | 'scheduled'
  activeLearningIds?: number[] | null
  variantGroup?: string | null
  variantOf?: number | null
}

interface AutoPostResult {
  postId: number
  error?: string
}

/**
 * Insert a post and its platform records.
 * Unlike saveGeneratedPosts, this does NOT call redirect() or revalidatePath()
 * since it runs in a cron (non-request) context.
 * Returns the inserted post ID for subsequent scheduling.
 */
function saveAsAutoPost(input: AutoPostInput): AutoPostResult {
  const db = getDb()
  const { brandId, feedEntryId, sourceUrl, sourceText, platformContents, qualityData, status, activeLearningIds, variantGroup, variantOf } = input

  const platformKeys = Object.keys(platformContents)
  if (platformKeys.length === 0) {
    return { postId: 0, error: 'No platform content to save' }
  }

  try {
    const primaryPlatform = platformKeys[0]
    const primaryContent = platformContents[primaryPlatform]

    const postResult = db
      .insert(posts)
      .values({
        brandId,
        sourceUrl: sourceUrl || null,
        sourceText: sourceText || null,
        content: primaryContent,
        status,
        qualityScore: qualityData[primaryPlatform]?.score ?? null,
        feedEntryId,
        postActiveLearningIds: activeLearningIds ?? null,
        variantGroup: variantGroup ?? null,
        variantOf: variantOf ?? null,
        createdAt: new Date().toISOString(),
      })
      .returning({ id: posts.id })
      .get()

    for (const [platform, content] of Object.entries(platformContents)) {
      db.insert(postPlatforms).values({
        postId: postResult.id,
        platform,
        content,
        status: 'pending',
      }).run()
    }

    return { postId: postResult.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { postId: 0, error: message }
  }
}

// ─── Activity log helper ──────────────────────────────────────────────────────

function logActivity(
  brandId: number,
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: Record<string, unknown>,
): void {
  try {
    const db = getDb()
    db.insert(activityLog).values({
      brandId,
      type: 'auto_generate',
      level,
      message,
      metadata: metadata as Record<string, unknown>,
      createdAt: new Date().toISOString(),
    }).run()
  } catch (err) {
    console.error('[auto-generate] Failed to log activity:', err)
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Process up to 5 queued feed entries through the full quality pipeline,
 * routing output based on brand automation level.
 *
 * Uses a globalThis mutex to prevent overlapping cron ticks.
 */
export async function autoGenerate(): Promise<void> {
  const g = globalThis as Record<string, unknown>
  if (g.__autoGenerateRunning) {
    console.log('[auto-generate] skipping tick -- previous run still in progress')
    return
  }

  g.__autoGenerateRunning = true

  try {
    const db = getDb()

    // ── 1. Query eligible feed entries ────────────────────────────────────────
    //    - relevanceScore IS NOT NULL (has been scored by Haiku)
    //    - processedAt IS NULL (not yet processed)
    //    - Join feedSources for brandId, targetPlatforms, relevanceThreshold
    //    - Join brands for automationLevel
    //    - brands.automationLevel != 'manual'
    //    - relevanceScore >= feedSource.relevanceThreshold (or >= 6 if null)
    //    - Limit to 5 per run

    const eligible = db
      .select({
        entryId: feedEntries.id,
        entryUrl: feedEntries.url,
        entryTitle: feedEntries.title,
        relevanceScore: feedEntries.relevanceScore,
        feedSourceId: feedSources.id,
        brandId: feedSources.brandId,
        targetPlatforms: feedSources.targetPlatforms,
        relevanceThreshold: feedSources.relevanceThreshold,
        automationLevel: brands.automationLevel,
      })
      .from(feedEntries)
      .innerJoin(feedSources, eq(feedEntries.feedSourceId, feedSources.id))
      .innerJoin(brands, eq(feedSources.brandId, brands.id))
      .where(
        and(
          isNotNull(feedEntries.relevanceScore),
          isNull(feedEntries.processedAt),
          // Skip manual brands
          sql`${brands.automationLevel} != 'manual'`,
          // Score >= threshold (or >= 6 if threshold is null)
          sql`${feedEntries.relevanceScore} >= COALESCE(${feedSources.relevanceThreshold}, 6)`,
        ),
      )
      .limit(5)
      .all()

    if (eligible.length === 0) {
      console.log('[auto-generate] no eligible entries to process')
      return
    }

    console.log(`[auto-generate] processing ${eligible.length} entries`)

    // ── 2. Mark all entries as processing BEFORE generation (prevent double-pick)
    const nowIso = new Date().toISOString()
    for (const entry of eligible) {
      db.update(feedEntries)
        .set({ processedAt: nowIso })
        .where(eq(feedEntries.id, entry.entryId))
        .run()
    }

    // ── 3. Process each entry ─────────────────────────────────────────────────
    for (const entry of eligible) {
      try {
        await processEntry(entry)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[auto-generate] failed to process entry ${entry.entryId}:`, err)
        logActivity(entry.brandId, 'error', `Auto-generate failed for entry ${entry.entryId}: ${message}`, {
          entryId: entry.entryId,
          url: entry.entryUrl,
        })
      }
    }
  } finally {
    g.__autoGenerateRunning = false
  }
}

// ─── Internal: process single entry ──────────────────────────────────────────

interface EligibleEntry {
  entryId: number
  entryUrl: string
  entryTitle: string | null
  relevanceScore: number | null
  feedSourceId: number
  brandId: number
  targetPlatforms: string[] | null
  relevanceThreshold: number | null
  automationLevel: 'manual' | 'semi' | 'mostly' | 'full' | null
}

async function processEntry(entry: EligibleEntry): Promise<void> {
  const { entryId, entryUrl, entryTitle, brandId, automationLevel } = entry

  // ── a. Content mix dedup check ────────────────────────────────────────────
  const mixCheck = await checkContentMix(brandId, entryUrl, entryTitle)
  if (mixCheck.skip) {
    console.log(`[auto-generate] entry ${entryId}: ${mixCheck.reason}`)
    logActivity(brandId, 'info', mixCheck.reason!, { entryId, url: entryUrl })
    return
  }

  // ── b. Extract content from URL ───────────────────────────────────────────
  const extracted = await extractFromUrl(entryUrl)
  const sourceText = extracted.text ?? ''

  if (extracted.error && !sourceText) {
    console.warn(`[auto-generate] entry ${entryId}: extraction failed: ${extracted.error}`)
    logActivity(brandId, 'warn', `Content extraction failed for entry ${entryId}: ${extracted.error}`, {
      entryId,
      url: entryUrl,
    })
    // Continue with URL-only context (graceful degradation)
  }

  // ── c. Determine target platforms ────────────────────────────────────────
  let platforms = entry.targetPlatforms ?? []

  if (platforms.length === 0) {
    // Fall back to all connected social accounts for the brand
    const db = getDb()
    const accounts = db
      .select({ platform: socialAccounts.platform })
      .from(socialAccounts)
      .where(
        and(
          eq(socialAccounts.brandId, brandId),
          eq(socialAccounts.status, 'connected'),
        ),
      )
      .all()
    platforms = accounts.map(a => a.platform)
  }

  if (platforms.length === 0) {
    console.log(`[auto-generate] entry ${entryId}: no platforms configured for brand ${brandId}, skipping`)
    logActivity(brandId, 'warn', `Skipped entry ${entryId}: no target platforms`, { entryId, url: entryUrl })
    return
  }

  // ── d-variant. Multi-variant path ────────────────────────────────────────
  {
    const db = getDb()
    const brand = db.select().from(brands).where(eq(brands.id, brandId)).get()

    if (brand?.enableVariants === 1) {
      const { checkAiSpend } = await import('@/lib/ai')
      const underLimit = await checkAiSpend()

      if (!underLimit) {
        logActivity(brandId, 'warn', 'Multi-variant skipped: daily spend limit reached, falling back to single-variant', { entryId, url: entryUrl })
        // Fall through to single-variant path below
      } else {
        const { generateVariants } = await import('@/lib/variant-generator')
        const variantResult = await generateVariants(brandId, platforms, sourceText, entryUrl)

        if (variantResult.error) {
          logActivity(brandId, 'warn', `Multi-variant generation failed, falling back to single: ${variantResult.error}`, { entryId, url: entryUrl })
          // Fall through to single-variant path below
        } else {
          const variantGroup = variantResult.variantGroup
          const activeLearningIds = variantResult.activeLearningIds

          // Apply hashtag enforcement to winner content
          const winnerContents: Record<string, string> = {}
          for (const [platform, content] of Object.entries(variantResult.winner.platformContents)) {
            winnerContents[platform] = enforceHashtags(platform, content)
          }

          // Build winner quality data
          const winnerQualityData: Record<string, { score: number }> = {}
          for (const platform of Object.keys(winnerContents)) {
            winnerQualityData[platform] = { score: variantResult.winner.qualityScore }
          }

          // Route winner through same automation-level logic
          const level = automationLevel ?? 'semi'
          const winnerQualityScore = variantResult.winner.qualityScore
          let winnerStatus: 'draft' | 'scheduled' = 'draft'

          if (level === 'full' && winnerQualityScore >= 5) {
            winnerStatus = 'scheduled'
          } else if (level === 'mostly' && winnerQualityScore >= 7) {
            winnerStatus = 'scheduled'
          }

          // Save winner
          const winnerResult = saveAsAutoPost({
            brandId,
            feedEntryId: entryId,
            sourceUrl: entryUrl,
            sourceText,
            platformContents: winnerContents,
            qualityData: winnerQualityData,
            status: winnerStatus,
            activeLearningIds: activeLearningIds.length > 0 ? activeLearningIds : null,
            variantGroup,
            variantOf: null,
          })

          if (winnerResult.error) {
            logActivity(brandId, 'error', `Multi-variant winner save failed: ${winnerResult.error}`, { entryId, url: entryUrl })
            return
          }

          const winnerId = winnerResult.postId

          // If winner should be scheduled, run spam guard and schedule
          if (winnerStatus === 'scheduled') {
            const guard = await checkSpamGuard(brandId, platforms[0], entryUrl)
            if (!guard.allowed) {
              logActivity(brandId, 'warn', `Spam guard blocked auto-schedule for winner post: ${guard.reason}. Saved as draft.`, { entryId, postId: winnerId, url: entryUrl })
            } else {
              const slotResult = await scheduleToNextSlot(winnerId, brandId, platforms[0])
              if (slotResult.error) {
                logActivity(brandId, 'warn', `No scheduling slot for winner post: ${slotResult.error}`, { entryId, postId: winnerId, url: entryUrl })
              } else {
                logActivity(brandId, 'info', `Auto-scheduled variant winner post ${winnerId} at ${slotResult.scheduledAt}`, { entryId, postId: winnerId, url: entryUrl, scheduledAt: slotResult.scheduledAt })
              }
            }
          }

          logActivity(brandId, 'info', `Multi-variant winner post ${winnerId} created (score: ${winnerQualityScore}/10, temp: ${variantResult.winner.temperature})`, {
            entryId,
            postId: winnerId,
            url: entryUrl,
            qualityScore: winnerQualityScore,
            temperature: variantResult.winner.temperature,
            variantGroup,
          })

          // Save losers as drafts linked to winner
          for (const loser of variantResult.losers) {
            const loserContents: Record<string, string> = {}
            for (const [platform, content] of Object.entries(loser.platformContents)) {
              loserContents[platform] = enforceHashtags(platform, content)
            }

            const loserQualityData: Record<string, { score: number }> = {}
            for (const platform of Object.keys(loserContents)) {
              loserQualityData[platform] = { score: loser.qualityScore }
            }

            const loserResult = saveAsAutoPost({
              brandId,
              feedEntryId: entryId,
              sourceUrl: entryUrl,
              sourceText,
              platformContents: loserContents,
              qualityData: loserQualityData,
              status: 'draft',
              activeLearningIds: null,
              variantGroup,
              variantOf: winnerId,
            })

            if (loserResult.error) {
              logActivity(brandId, 'warn', `Multi-variant loser save failed: ${loserResult.error}`, { entryId, url: entryUrl })
            }
          }

          console.log(`[auto-generate] entry ${entryId} done (multi-variant) -- winner: ${winnerId}, losers: ${variantResult.losers.length}`)
          return
        }
      }
    }
  }
  // ── d. Run quality pipeline ───────────────────────────────────────────────
  const generationResult = await generateContent(brandId, platforms, sourceText, entryUrl)
  if (generationResult.error) {
    console.error(`[auto-generate] entry ${entryId}: generation failed: ${generationResult.error}`)
    logActivity(brandId, 'error', `Generation failed for entry ${entryId}: ${generationResult.error}`, {
      entryId,
      url: entryUrl,
      platforms,
    })
    return
  }

  const refinedResult = await refineAndGate(brandId, generationResult)
  if (refinedResult.error) {
    console.error(`[auto-generate] entry ${entryId}: refine failed: ${refinedResult.error}`)
    logActivity(brandId, 'error', `Quality pipeline failed for entry ${entryId}: ${refinedResult.error}`, {
      entryId,
      url: entryUrl,
    })
    return
  }

  // ── e. Hashtag enforcement ────────────────────────────────────────────────
  const enforcedPlatforms: typeof refinedResult.platforms = {}
  for (const [platform, data] of Object.entries(refinedResult.platforms)) {
    enforcedPlatforms[platform] = {
      ...data,
      content: enforceHashtags(platform, data.content),
    }
  }

  // ── f. Automation level routing ───────────────────────────────────────────
  const level = automationLevel ?? 'semi'

  // Build a map of platform -> { content, qualityScore, discarded }
  const platformsToProcess: Record<string, { content: string; qualityScore: number; discarded: boolean }> = {}
  for (const [platform, data] of Object.entries(enforcedPlatforms)) {
    platformsToProcess[platform] = {
      content: data.content,
      qualityScore: data.qualityScore ?? 0,
      discarded: data.discarded === true,
    }
  }

  // Separate platforms into:
  // - toDraft: save as draft
  // - toSchedule: run spam guard and schedule
  // - toDiscard: skip entirely
  const toDraft: Record<string, string> = {}
  const toSchedule: Record<string, string> = {}
  const toDiscard: Record<string, string> = {}

  for (const [platform, data] of Object.entries(platformsToProcess)) {
    if (data.discarded) {
      toDiscard[platform] = data.content
      continue
    }

    if (level === 'semi') {
      // Always draft
      toDraft[platform] = data.content
    } else if (level === 'mostly') {
      // Schedule if ALL scores >= 7, otherwise draft; discard if discarded
      if (data.qualityScore >= 7) {
        toSchedule[platform] = data.content
      } else {
        toDraft[platform] = data.content
      }
    } else if (level === 'full') {
      // Schedule if score >= 5, discard if < 5
      if (data.qualityScore >= 5) {
        toSchedule[platform] = data.content
      } else {
        toDiscard[platform] = data.content
      }
    }
  }

  // For 'mostly': if ANY toSchedule platform has a non-qualifying partner,
  // we already moved it to toDraft above -- no extra logic needed

  const qualityData: Record<string, { score: number }> = {}
  for (const [platform, data] of Object.entries(platformsToProcess)) {
    qualityData[platform] = { score: data.qualityScore }
  }

  // ── g. Save drafts ────────────────────────────────────────────────────────
  if (Object.keys(toDraft).length > 0) {
    const draftResult = saveAsAutoPost({
      brandId,
      feedEntryId: entryId,
      sourceUrl: entryUrl,
      sourceText,
      platformContents: toDraft,
      qualityData,
      status: 'draft',
      activeLearningIds: generationResult.activeLearningIds ?? null,
    })

    if (draftResult.error) {
      console.error(`[auto-generate] entry ${entryId}: failed to save drafts: ${draftResult.error}`)
    } else {
      logActivity(brandId, 'info', `Auto-generated draft post ${draftResult.postId} from entry ${entryId}`, {
        entryId,
        postId: draftResult.postId,
        url: entryUrl,
        platforms: Object.keys(toDraft),
        qualityScores: Object.fromEntries(
          Object.keys(toDraft).map(p => [p, qualityData[p]?.score ?? 0])
        ),
        status: 'draft',
      })
    }
  }

  // ── h. Schedule posts with spam guard ────────────────────────────────────
  if (Object.keys(toSchedule).length > 0) {
    let firstScheduledAt: string | null = null
    let firstPlatformDone = false

    const scheduleResult = saveAsAutoPost({
      brandId,
      feedEntryId: entryId,
      sourceUrl: entryUrl,
      sourceText,
      platformContents: toSchedule,
      qualityData,
      status: 'draft', // Start as draft; update to scheduled per platform below
      activeLearningIds: generationResult.activeLearningIds ?? null,
    })

    if (scheduleResult.error) {
      console.error(`[auto-generate] entry ${entryId}: failed to save schedule post: ${scheduleResult.error}`)
    } else {
      const postId = scheduleResult.postId

      for (const platform of Object.keys(toSchedule)) {
        // Spam guard check before scheduling
        const guard = await checkSpamGuard(brandId, platform, entryUrl)

        if (!guard.allowed) {
          // Spam guard blocked -- save this platform as draft instead
          console.log(`[auto-generate] entry ${entryId}: spam guard blocked ${platform}: ${guard.reason}`)
          logActivity(brandId, 'warn',
            `Spam guard blocked auto-schedule for ${platform}: ${guard.reason}. Saved as draft.`, {
              entryId,
              postId,
              url: entryUrl,
              platform,
            })

          // Update platform status to remain pending (already pending = draft equivalent)
          // No status change needed since the platform record starts as 'pending'
          continue
        }

        // Cross-platform stagger: if a previous platform was already scheduled,
        // wait at least 30 min (via a future scheduling slot offset).
        // We achieve this by waiting for the first platform to schedule, then
        // for subsequent platforms, we check whether the scheduled time is far enough apart.
        // Since scheduleToNextSlot adds +/-15 min jitter to the next slot naturally,
        // we implement the stagger by deferring subsequent platforms by at least 30 min.

        if (!firstPlatformDone) {
          // First platform: schedule normally
          const slotResult = await scheduleToNextSlot(postId, brandId, platform)

          if (slotResult.error) {
            console.warn(`[auto-generate] entry ${entryId}: no slot for ${platform}: ${slotResult.error}`)
            logActivity(brandId, 'warn', `No scheduling slot for ${platform}: ${slotResult.error}`, {
              entryId,
              postId,
              url: entryUrl,
              platform,
            })
          } else {
            firstScheduledAt = slotResult.scheduledAt ?? null
            firstPlatformDone = true

            logActivity(brandId, 'info', `Auto-scheduled post ${postId} for ${platform} at ${slotResult.scheduledAt}`, {
              entryId,
              postId,
              url: entryUrl,
              platform,
              scheduledAt: slotResult.scheduledAt,
              status: 'scheduled',
            })
          }
        } else {
          // Subsequent platforms: ensure at least 30 min stagger from first scheduled time
          // We achieve this by adding a 30-60 min random offset to the post's scheduledAt
          const db = getDb()

          if (firstScheduledAt) {
            const firstMs = new Date(firstScheduledAt).getTime()
            const staggerMs = (30 + Math.random() * 30) * 60 * 1000 // 30-60 min
            const staggeredAt = new Date(firstMs + staggerMs).toISOString()

            // Insert platform-specific record is already done by saveAsAutoPost,
            // but we need to update the post's scheduledAt for this platform entry.
            // Since all platforms share the same post, we schedule the post at the
            // first time and track subsequent platforms by updating postPlatforms records.
            // For simplicity with the current data model: use a separate post per platform
            // is complex -- instead, we schedule the post at the staggered time and
            // log the platform-specific scheduling.

            // Update post scheduled time to staggered time for subsequent platforms
            // Note: This sets the SAME post's scheduledAt which could conflict with the first platform.
            // The correct approach is: only update if the staggered time is LATER than current scheduledAt.
            const currentPost = db
              .select({ scheduledAt: posts.scheduledAt })
              .from(posts)
              .where(eq(posts.id, postId))
              .get()

            const currentScheduledAt = currentPost?.scheduledAt ?? null
            if (!currentScheduledAt || staggeredAt > currentScheduledAt) {
              await db.update(posts)
                .set({ scheduledAt: staggeredAt, status: 'scheduled' })
                .where(eq(posts.id, postId))
                .run()
            }

            logActivity(brandId, 'info',
              `Auto-scheduled post ${postId} for ${platform} at ${staggeredAt} (30-60min stagger)`, {
                entryId,
                postId,
                url: entryUrl,
                platform,
                scheduledAt: staggeredAt,
                staggerMinutes: Math.round(staggerMs / 60000),
                status: 'scheduled',
              })
          } else {
            // First platform had no slot, try scheduling this one as the "first"
            const slotResult = await scheduleToNextSlot(postId, brandId, platform)

            if (slotResult.error) {
              console.warn(`[auto-generate] entry ${entryId}: no slot for ${platform}: ${slotResult.error}`)
              logActivity(brandId, 'warn', `No scheduling slot for ${platform}: ${slotResult.error}`, {
                entryId, postId, url: entryUrl, platform,
              })
            } else {
              firstScheduledAt = slotResult.scheduledAt ?? null
              firstPlatformDone = true
              logActivity(brandId, 'info', `Auto-scheduled post ${postId} for ${platform} at ${slotResult.scheduledAt}`, {
                entryId, postId, url: entryUrl, platform, scheduledAt: slotResult.scheduledAt, status: 'scheduled',
              })
            }
          }
        }
      }
    }
  }

  // ── i. Log discarded platforms ────────────────────────────────────────────
  for (const [platform] of Object.entries(toDiscard)) {
    const data = platformsToProcess[platform]
    logActivity(brandId, 'warn',
      `Platform ${platform} discarded from entry ${entryId}: quality score ${data.qualityScore}/10`, {
        entryId,
        url: entryUrl,
        platform,
        qualityScore: data.qualityScore,
      })
  }

  console.log(
    `[auto-generate] entry ${entryId} done -- ` +
    `drafted: ${Object.keys(toDraft).length}, ` +
    `scheduled: ${Object.keys(toSchedule).length}, ` +
    `discarded: ${Object.keys(toDiscard).length}`
  )
}
