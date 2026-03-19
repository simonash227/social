import { getDb } from '@/db'
import { posts, postPlatforms, postAnalytics, activityLog } from '@/db/schema'
import { eq, and, lte, isNotNull, sql } from 'drizzle-orm'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformMetrics {
  success: boolean
  platform_post_id?: string
  post_url?: string
  post_metrics?: {
    views: number
    likes: number
    comments: number
    shares: number
  }
  post_metrics_source?: string
  post_metrics_error?: string
}

type PostAnalyticsResponse = PlatformMetrics[]

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchPostAnalytics(requestId: string): Promise<PostAnalyticsResponse | null> {
  try {
    const res = await fetch(
      `https://api.upload-post.com/api/uploadposts/post-analytics/${requestId}`,
      { headers: { Authorization: `Apikey ${process.env.UPLOAD_POST_API_KEY}` } }
    )
    if (!res.ok) {
      console.warn(`[collect-analytics] fetchPostAnalytics non-200 for requestId=${requestId}: ${res.status}`)
      return null
    }
    return res.json() as Promise<PostAnalyticsResponse>
  } catch (err) {
    console.warn(`[collect-analytics] fetchPostAnalytics error for requestId=${requestId}:`, err)
    return null
  }
}

// ─── Exported computation helpers ─────────────────────────────────────────────

/**
 * Compute a normalized engagement score 0-100.
 * Guards against views=null/0 to prevent division by zero (ANLY-02).
 */
export function calcEngagementScore(metrics: {
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
}): number {
  const views = metrics.views ?? 0
  if (views === 0) return 0

  const weighted =
    (metrics.likes ?? 0) * 1 +
    (metrics.comments ?? 0) * 3 +
    (metrics.shares ?? 0) * 2

  return Math.min(100, Math.round((weighted / views) * 1000))
}

/**
 * Classify a post's performance tier relative to brand+platform cohort percentiles (ANLY-03).
 */
export function classifyTier(
  score: number,
  p25: number,
  p75: number
): 'top' | 'average' | 'under' {
  if (score > p75) return 'top'
  if (score < p25) return 'under'
  return 'average'
}

// ─── Main cron worker ─────────────────────────────────────────────────────────

/**
 * Collect analytics for all eligible published posts (48h+ old).
 * Uses a mutex on globalThis to prevent overlapping cron ticks (ANLY-01).
 */
export async function collectAnalytics(): Promise<void> {
  const g = globalThis as Record<string, unknown>
  if (g.__analyticsRunning) {
    console.log('[collect-analytics] skipping tick -- previous run still in progress')
    return
  }

  g.__analyticsRunning = true

  try {
    const db = getDb()

    // Threshold: 48 hours ago
    const threshold48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

    // Find eligible postPlatforms: published post, published platform, has requestId, post 48h+ old
    const eligiblePlatforms = await db
      .select({
        postPlatformId: postPlatforms.id,
        postId: postPlatforms.postId,
        platform: postPlatforms.platform,
        requestId: postPlatforms.requestId,
        brandId: posts.brandId,
      })
      .from(postPlatforms)
      .innerJoin(posts, eq(postPlatforms.postId, posts.id))
      .where(
        and(
          eq(posts.status, 'published'),
          isNotNull(posts.publishedAt),
          lte(posts.publishedAt, threshold48h),
          eq(postPlatforms.status, 'published'),
          isNotNull(postPlatforms.requestId)
        )
      )
      .all()

    if (eligiblePlatforms.length === 0) {
      console.log('[collect-analytics] no eligible posts to collect analytics for')
      return
    }

    console.log(`[collect-analytics] found ${eligiblePlatforms.length} eligible post-platforms`)

    // Group by requestId to avoid duplicate API calls for same requestId
    const requestIdMap = new Map<string, typeof eligiblePlatforms[number][]>()
    for (const ep of eligiblePlatforms) {
      if (!ep.requestId) continue
      const existing = requestIdMap.get(ep.requestId) ?? []
      existing.push(ep)
      requestIdMap.set(ep.requestId, existing)
    }

    let collectedCount = 0
    const affectedCohorts = new Set<string>() // "brandId:platform"

    for (const [requestId, platforms] of requestIdMap.entries()) {
      const analyticsData = await fetchPostAnalytics(requestId)
      if (!analyticsData) continue

      // analyticsData is an array of per-platform results
      const results = Array.isArray(analyticsData) ? analyticsData : []

      for (const platformResult of results) {
        if (platformResult.post_metrics_error) {
          // Log warn and skip
          try {
            const ep = platforms[0] // use first entry for brandId context
            await db.insert(activityLog).values({
              brandId: ep.brandId,
              type: 'analytics',
              level: 'warn',
              message: `Analytics error for requestId=${requestId}: ${platformResult.post_metrics_error}`,
              createdAt: new Date().toISOString(),
            }).run()
          } catch (logErr) {
            console.warn('[collect-analytics] failed to log warn:', logErr)
          }
          continue
        }

        if (!platformResult.post_metrics) continue

        // Find matching postPlatform by platform name (or use the first one if only one)
        // The API returns results per platform -- match by platform_post_id or just use first
        // Since the requestId maps to a specific postPlatform entry, use that
        const ep = platforms[0]
        const metrics = platformResult.post_metrics

        const engagementScore = calcEngagementScore({
          views: metrics.views ?? null,
          likes: metrics.likes ?? null,
          comments: metrics.comments ?? null,
          shares: metrics.shares ?? null,
        })

        const now = new Date().toISOString()

        // Upsert: check if row exists first, then insert or update
        const existing = await db
          .select({ id: postAnalytics.id })
          .from(postAnalytics)
          .where(
            and(
              eq(postAnalytics.postId, ep.postId),
              eq(postAnalytics.platform, ep.platform)
            )
          )
          .get()

        if (existing) {
          await db
            .update(postAnalytics)
            .set({
              views: metrics.views ?? null,
              likes: metrics.likes ?? null,
              comments: metrics.comments ?? null,
              shares: metrics.shares ?? null,
              engagementScore,
              collectedAt: now,
            })
            .where(eq(postAnalytics.id, existing.id))
            .run()
        } else {
          await db.insert(postAnalytics).values({
            postId: ep.postId,
            platform: ep.platform,
            views: metrics.views ?? null,
            likes: metrics.likes ?? null,
            comments: metrics.comments ?? null,
            shares: metrics.shares ?? null,
            engagementScore,
            collectedAt: now,
            createdAt: now,
          }).run()
        }

        collectedCount++
        affectedCohorts.add(`${ep.brandId}:${ep.platform}`)
      }

      // If no platform results matched, log success for the requestId anyway
      if (results.length > 0) {
        const ep = platforms[0]
        await db.insert(activityLog).values({
          brandId: ep.brandId,
          type: 'analytics',
          level: 'info',
          message: `Collected analytics for requestId=${requestId} (${collectedCount} metrics)`,
          createdAt: new Date().toISOString(),
        }).run()
      }
    }

    // ── Reclassify tiers for all affected brand+platform cohorts ──────────────
    const cohortCount = affectedCohorts.size

    for (const cohortKey of affectedCohorts) {
      const [brandIdStr, platform] = cohortKey.split(':')
      const brandId = parseInt(brandIdStr, 10)

      // Fetch all postAnalytics rows for this brand+platform cohort
      const cohortRows = await db
        .select({
          id: postAnalytics.id,
          engagementScore: postAnalytics.engagementScore,
        })
        .from(postAnalytics)
        .innerJoin(posts, eq(postAnalytics.postId, posts.id))
        .where(
          and(
            eq(posts.brandId, brandId),
            eq(postAnalytics.platform, platform)
          )
        )
        .all()

      // If fewer than 4 posts in cohort, set all to 'average'
      if (cohortRows.length < 4) {
        for (const row of cohortRows) {
          await db
            .update(postAnalytics)
            .set({ performerTier: 'average' })
            .where(eq(postAnalytics.id, row.id))
            .run()
        }
        continue
      }

      // Exclude zero-score posts from percentile calc (no impressions), classify them as 'under'
      const scoredRows = cohortRows.filter(r => (r.engagementScore ?? 0) > 0)
      const zeroRows = cohortRows.filter(r => (r.engagementScore ?? 0) === 0)

      // Mark zero-score posts as 'under'
      for (const row of zeroRows) {
        await db
          .update(postAnalytics)
          .set({ performerTier: 'under' })
          .where(eq(postAnalytics.id, row.id))
          .run()
      }

      if (scoredRows.length === 0) continue

      // Sort ascending
      const scores = scoredRows.map(r => r.engagementScore ?? 0).sort((a, b) => a - b)
      const len = scores.length
      const p25 = scores[Math.floor(len * 0.25)]
      const p75 = scores[Math.floor(len * 0.75)]

      for (const row of scoredRows) {
        const tier = classifyTier(row.engagementScore ?? 0, p25, p75)
        await db
          .update(postAnalytics)
          .set({ performerTier: tier })
          .where(eq(postAnalytics.id, row.id))
          .run()
      }
    }

    // ── Threshold-gated learning trigger ─────────────────────────────────────
    // If a brand had 2+ platform cohorts reclassified, trigger learning analysis.
    // analyzeForBrand() internally checks the 7-day gate and 30-post minimum.
    const brandCohortCounts = new Map<number, number>()
    for (const cohortKey of affectedCohorts) {
      const brandId = parseInt(cohortKey.split(':')[0], 10)
      brandCohortCounts.set(brandId, (brandCohortCounts.get(brandId) ?? 0) + 1)
    }

    for (const [brandId, count] of brandCohortCounts) {
      if (count >= 2) {
        try {
          const { analyzeAllPlatformsForBrand } = await import('./learning-engine')
          await analyzeAllPlatformsForBrand(brandId)
        } catch (err) {
          console.error(`[collect-analytics] learning trigger failed for brand ${brandId}:`, err)
        }
      }
    }

    // ── Log summary ───────────────────────────────────────────────────────────
    await db.insert(activityLog).values({
      type: 'analytics',
      level: 'info',
      message: `Collected analytics for ${collectedCount} posts, reclassified ${cohortCount} cohorts`,
      createdAt: new Date().toISOString(),
    }).run()

    console.log(`[collect-analytics] done: ${collectedCount} posts collected, ${cohortCount} cohorts reclassified`)
  } finally {
    (globalThis as Record<string, unknown>).__analyticsRunning = false
  }
}
