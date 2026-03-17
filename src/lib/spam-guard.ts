import { getDb } from '@/db'
import { posts, postPlatforms, brands } from '@/db/schema'
import { and, eq, gte, isNotNull, lt, sql } from 'drizzle-orm'

// ─── Daily platform caps ───────────────────────────────────────────────────────
const PLATFORM_DAILY_CAPS: Record<string, number> = {
  twitter:   5,
  x:         5,
  instagram: 3,
  linkedin:  2,
  tiktok:    3,
}

const DEFAULT_DAILY_CAP = 5

// ─── Helper: count today's posts for a brand+platform ─────────────────────────
function countTodayPosts(
  db: ReturnType<typeof getDb>,
  brandId: number,
  platform: string,
  todayStr: string, // YYYY-MM-DD
): number {
  // Count posts with status IN ('published', 'scheduled') for brand+platform today.
  // A post is "today" if the date portion of scheduledAt OR publishedAt equals todayStr.
  const rows = db
    .select({ id: posts.id })
    .from(posts)
    .innerJoin(postPlatforms, eq(postPlatforms.postId, posts.id))
    .where(
      and(
        eq(posts.brandId, brandId),
        eq(postPlatforms.platform, platform),
        sql`(
          (${posts.status} IN ('published', 'scheduled'))
          AND (
            (${posts.scheduledAt} IS NOT NULL AND substr(${posts.scheduledAt}, 1, 10) = ${todayStr})
            OR
            (${posts.publishedAt} IS NOT NULL AND substr(${posts.publishedAt}, 1, 10) = ${todayStr})
          )
        )`,
      ),
    )
    .all()

  return rows.length
}

// ─── Helper: get last post time for a brand+platform ──────────────────────────
function getLastPostTime(
  db: ReturnType<typeof getDb>,
  brandId: number,
  platform: string,
): string | null {
  const rows = db
    .select({
      scheduledAt: posts.scheduledAt,
      publishedAt:  posts.publishedAt,
    })
    .from(posts)
    .innerJoin(postPlatforms, eq(postPlatforms.postId, posts.id))
    .where(
      and(
        eq(posts.brandId, brandId),
        eq(postPlatforms.platform, platform),
        sql`${posts.status} IN ('published', 'scheduled')`,
      ),
    )
    .all()

  let latest: string | null = null
  for (const row of rows) {
    // Use the later of scheduledAt or publishedAt as the "post time"
    const candidates = [row.scheduledAt, row.publishedAt].filter(Boolean) as string[]
    for (const ts of candidates) {
      if (!latest || ts > latest) latest = ts
    }
  }
  return latest
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface SpamGuardResult {
  allowed: boolean
  reason?: string
}

/**
 * Check all spam guard rules before auto-scheduling a post.
 *
 * @param brandId   - The brand to check
 * @param platform  - The target platform (e.g. 'twitter', 'instagram')
 * @param sourceUrl - Optional source URL (used for cross-platform stagger and topic dedup)
 */
export async function checkSpamGuard(
  brandId: number,
  platform: string,
  sourceUrl?: string,
): Promise<SpamGuardResult> {
  const db = getDb()
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10) // YYYY-MM-DD

  // ── (a) Warmup cap (SPAM-04) ───────────────────────────────────────────────
  const brand = db
    .select({ warmupDate: brands.warmupDate })
    .from(brands)
    .where(eq(brands.id, brandId))
    .get()

  if (brand?.warmupDate) {
    const warmupMs = new Date(brand.warmupDate).getTime()
    const diffDays = Math.floor((now.getTime() - warmupMs) / (1000 * 60 * 60 * 24))
    let warmupCap: number | null = null

    if (diffDays < 7) {
      warmupCap = 1  // week 0: max 1/day
    } else if (diffDays < 14) {
      warmupCap = 2  // week 1: max 2/day
    }
    // week 2+: no warmup cap (null)

    if (warmupCap !== null) {
      const todayCount = countTodayPosts(db, brandId, platform, todayStr)
      if (todayCount >= warmupCap) {
        return { allowed: false, reason: `warmup cap ${warmupCap}/day` }
      }
    }
  }

  // ── (b) Daily platform cap (SPAM-01) ──────────────────────────────────────
  const dailyCap = PLATFORM_DAILY_CAPS[platform.toLowerCase()] ?? DEFAULT_DAILY_CAP
  const todayCount = countTodayPosts(db, brandId, platform, todayStr)
  if (todayCount >= dailyCap) {
    return { allowed: false, reason: `daily cap ${dailyCap}/day for ${platform}` }
  }

  // ── (c) Minimum 1-hour gap (SPAM-02) ──────────────────────────────────────
  const lastPostTime = getLastPostTime(db, brandId, platform)
  if (lastPostTime) {
    const lastMs = new Date(lastPostTime).getTime()
    const diffMs = now.getTime() - lastMs
    if (diffMs < 60 * 60 * 1000) {
      const minutesAgo = Math.round(diffMs / 60000)
      return { allowed: false, reason: `minimum 1-hour gap not met (last post ${minutesAgo}m ago)` }
    }
  }

  // ── (d) Cross-platform stagger (SPAM-03) ──────────────────────────────────
  if (sourceUrl) {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const recentCross = db
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.brandId, brandId),
          eq(posts.sourceUrl, sourceUrl),
          sql`${posts.status} IN ('published', 'scheduled')`,
          sql`(
            (${posts.scheduledAt} IS NOT NULL AND ${posts.scheduledAt} >= ${oneHourAgo})
            OR
            (${posts.publishedAt} IS NOT NULL AND ${posts.publishedAt} >= ${oneHourAgo})
          )`,
        ),
      )
      .all()

    if (recentCross.length > 0) {
      return { allowed: false, reason: 'cross-platform stagger: same source scheduled within last 60 minutes' }
    }
  }

  // ── (e) Topic dedup within 48-hour window (SPAM-05) ───────────────────────
  if (sourceUrl) {
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
    const duplicate = db
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.brandId, brandId),
          eq(posts.sourceUrl, sourceUrl),
          gte(posts.createdAt, fortyEightHoursAgo),
        ),
      )
      .get()

    if (duplicate) {
      return { allowed: false, reason: 'topic dedup: same source used within 48 hours' }
    }
  }

  // ── (f) Link ratio (SPAM-06) ──────────────────────────────────────────────
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const allRecentPosts = db
    .select({ sourceUrl: posts.sourceUrl })
    .from(posts)
    .where(
      and(
        eq(posts.brandId, brandId),
        gte(posts.createdAt, sevenDaysAgo),
      ),
    )
    .all()

  if (allRecentPosts.length > 0) {
    const linkPosts = allRecentPosts.filter(p => p.sourceUrl !== null).length
    const linkRatio = linkPosts / allRecentPosts.length
    if (linkRatio > 0.35) {
      return { allowed: false, reason: `link ratio exceeded (${Math.round(linkRatio * 100)}% > 35%)` }
    }
  }

  return { allowed: true }
}
