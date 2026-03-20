import { getDb } from '@/db'
import { brandLearnings } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { sql } from 'drizzle-orm'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LearningStats {
  learningId: number
  withCount: number
  withAvgEngagement: number
  withoutCount: number
  withoutAvgEngagement: number
  engagementDelta: number
  confidence: 'high' | 'medium' | 'low'
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function deriveConfidence(postCount: number, deltaMagnitude: number): 'high' | 'medium' | 'low' {
  if (postCount >= 20 && deltaMagnitude >= 5) return 'high'
  if (postCount >= 10 && deltaMagnitude >= 2) return 'medium'
  return 'low'
}

function average(scores: number[]): number {
  if (scores.length === 0) return 0
  return scores.reduce((sum, s) => sum + s, 0) / scores.length
}

// ─── computeLearningStats ─────────────────────────────────────────────────────

/**
 * Compute A/B engagement stats for a single learning.
 * "with" group: posts that had this learning active during generation.
 * "without" group: posts that did not.
 * Uses json_each for correct JSON array membership queries.
 */
export function computeLearningStats(brandId: number, learningId: number): LearningStats {
  const db = getDb()

  // -- "with" group: posts where active_learning_ids contains learningId --
  const withRows = db.all<{ engagementScore: number }>(
    sql`
      SELECT pa.engagement_score AS "engagementScore"
      FROM post_analytics pa
      INNER JOIN posts p ON pa.post_id = p.id
      INNER JOIN json_each(pa.active_learning_ids) jl ON jl.value = ${learningId}
      WHERE p.brand_id = ${brandId}
        AND pa.engagement_score IS NOT NULL
    `
  )

  // -- "without" group: posts where active_learning_ids is null or does not contain learningId --
  const withoutRows = db.all<{ engagementScore: number }>(
    sql`
      SELECT pa.engagement_score AS "engagementScore"
      FROM post_analytics pa
      INNER JOIN posts p ON pa.post_id = p.id
      WHERE p.brand_id = ${brandId}
        AND pa.engagement_score IS NOT NULL
        AND (
          pa.active_learning_ids IS NULL
          OR NOT EXISTS (
            SELECT 1 FROM json_each(pa.active_learning_ids) jl2
            WHERE jl2.value = ${learningId}
          )
        )
    `
  )

  const withScores = withRows.map(r => r.engagementScore)
  const withoutScores = withoutRows.map(r => r.engagementScore)

  const withAvg = Math.round(average(withScores))
  const withoutAvg = Math.round(average(withoutScores))
  const delta = Math.round(withAvg - withoutAvg)
  const confidence = deriveConfidence(withScores.length, Math.abs(delta))

  return {
    learningId,
    withCount: withScores.length,
    withAvgEngagement: withAvg,
    withoutCount: withoutScores.length,
    withoutAvgEngagement: withoutAvg,
    engagementDelta: delta,
    confidence,
  }
}

// ─── autoDeactivateLearnings ──────────────────────────────────────────────────

/**
 * Auto-deactivate learnings that have accumulated enough posts (>= threshold)
 * but show no positive engagement lift (delta <= 0).
 * Returns the count of learnings deactivated.
 */
export function autoDeactivateLearnings(options?: { threshold?: number }): number {
  const threshold = options?.threshold ?? 20
  const db = getDb()

  // Query all active approved learnings across all brands
  const activeLearnings = db
    .select({
      id: brandLearnings.id,
      brandId: brandLearnings.brandId,
    })
    .from(brandLearnings)
    .where(
      and(
        eq(brandLearnings.isActive, 1),
        eq(brandLearnings.status, 'approved')
      )
    )
    .all()

  let deactivatedCount = 0

  for (const learning of activeLearnings) {
    const stats = computeLearningStats(learning.brandId, learning.id)

    if (stats.withCount >= threshold && stats.engagementDelta <= 0) {
      db.update(brandLearnings)
        .set({
          isActive: 0,
          status: 'auto_deactivated',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(brandLearnings.id, learning.id))
        .run()

      console.log(
        `[learning-validator] deactivated learning ${learning.id} ` +
        `(brandId=${learning.brandId}, withCount=${stats.withCount}, delta=${stats.engagementDelta})`
      )

      deactivatedCount++
    }
  }

  return deactivatedCount
}
