import { getDb } from '@/db'
import { brandLearnings, postAnalytics, posts } from '@/db/schema'
import { eq, and, or, isNull, isNotNull, desc, sql } from 'drizzle-orm'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrandLearning {
  id: number
  brandId: number
  platform: string | null
  type: string
  description: string
  confidence: string
  supportingPostIds: number[] | null
  isActive: number
  validatedAt: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface GoldenExample {
  postId: number
  content: string
  engagementScore: number
  platform: string
  collectedAt: string
  isGoldenPinned: number
}

// ─── loadLearnings ────────────────────────────────────────────────────────────

/**
 * Load approved, active learnings for a brand+platform.
 * Returns up to 5, confidence-ordered (high → medium → low), then by validatedAt DESC.
 * CRITICAL: Both isActive=1 AND status='approved' are required — isActive alone is not enough.
 */
export function loadLearnings(brandId: number, platform: string): BrandLearning[] {
  const db = getDb()

  const rows = db
    .select()
    .from(brandLearnings)
    .where(
      and(
        eq(brandLearnings.brandId, brandId),
        eq(brandLearnings.isActive, 1),
        eq(brandLearnings.status, 'approved'),
        or(
          isNull(brandLearnings.platform),
          eq(brandLearnings.platform, platform)
        )
      )
    )
    .orderBy(
      // Confidence ordering: high=0, medium=1, low=2
      sql`CASE ${brandLearnings.confidence}
        WHEN 'high' THEN 0
        WHEN 'medium' THEN 1
        ELSE 2
      END`,
      desc(brandLearnings.validatedAt)
    )
    .limit(5)
    .all()

  return rows as BrandLearning[]
}

// ─── loadGoldenExamples ───────────────────────────────────────────────────────

/**
 * Load golden example posts for a brand+platform.
 * Returns up to 5 posts: pinned-first, then recent top (last 30 days), then historic top.
 * Only includes posts at or above the 90th percentile engagement score.
 * Excludes variant losers (variantOf IS NOT NULL is excluded in query).
 */
export function loadGoldenExamples(brandId: number, platform: string): GoldenExample[] {
  const db = getDb()

  // Query all published posts with engagement scores for this brand+platform
  // Exclude variant losers (variantOf IS NOT NULL means it's a variant — skip non-winners)
  const rows = db
    .select({
      postId: posts.id,
      content: posts.content,
      engagementScore: postAnalytics.engagementScore,
      platform: postAnalytics.platform,
      collectedAt: postAnalytics.collectedAt,
      isGoldenPinned: posts.isGoldenPinned,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .innerJoin(postAnalytics, eq(postAnalytics.postId, posts.id))
    .where(
      and(
        eq(posts.brandId, brandId),
        eq(posts.status, 'published'),
        eq(postAnalytics.platform, platform),
        isNotNull(postAnalytics.engagementScore),
        isNull(posts.variantOf)
      )
    )
    .all()

  if (rows.length === 0) return []

  // Calculate 90th percentile threshold
  const scores = rows
    .map(r => r.engagementScore ?? 0)
    .sort((a, b) => a - b)

  const p90Index = Math.floor(scores.length * 0.90)
  const p90Threshold = scores[p90Index] ?? 0

  // Cutoff date for "recent" = last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Split into three groups
  const pinned: GoldenExample[] = []
  const recentTop: GoldenExample[] = []
  const historicTop: GoldenExample[] = []

  for (const row of rows) {
    const score = row.engagementScore ?? 0
    const example: GoldenExample = {
      postId: row.postId,
      content: row.content,
      engagementScore: score,
      platform: row.platform,
      collectedAt: row.collectedAt,
      isGoldenPinned: row.isGoldenPinned,
    }

    if (row.isGoldenPinned === 1) {
      pinned.push(example)
    } else if (score >= p90Threshold && (row.publishedAt ?? '') >= thirtyDaysAgo) {
      recentTop.push(example)
    } else if (score >= p90Threshold) {
      historicTop.push(example)
    }
  }

  // Sort recent by collectedAt DESC (most recent first)
  recentTop.sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))
  // Sort historic by engagementScore DESC
  historicTop.sort((a, b) => b.engagementScore - a.engagementScore)

  return [...pinned, ...recentTop, ...historicTop].slice(0, 5)
}
