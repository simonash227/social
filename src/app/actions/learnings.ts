'use server'

import { getDb } from '@/db'
import { brandLearnings, posts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import type { LearningStats } from '@/lib/learning-validator'

// ─── approveLearning ──────────────────────────────────────────────────────────

export async function approveLearning(learningId: number): Promise<{ error?: string }> {
  try {
    const db = getDb()
    db.update(brandLearnings)
      .set({ status: 'approved', isActive: 1, updatedAt: new Date().toISOString() })
      .where(eq(brandLearnings.id, learningId))
      .run()
    revalidatePath('/brands/[id]/learnings', 'page')
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to approve learning'
    return { error: message }
  }
}

// ─── rejectLearning ───────────────────────────────────────────────────────────

export async function rejectLearning(learningId: number): Promise<{ error?: string }> {
  try {
    const db = getDb()
    db.update(brandLearnings)
      .set({ status: 'rejected', isActive: 0, updatedAt: new Date().toISOString() })
      .where(eq(brandLearnings.id, learningId))
      .run()
    revalidatePath('/brands/[id]/learnings', 'page')
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reject learning'
    return { error: message }
  }
}

// ─── toggleLearning ───────────────────────────────────────────────────────────

export async function toggleLearning(learningId: number, isActive: boolean): Promise<{ error?: string }> {
  try {
    const db = getDb()
    db.update(brandLearnings)
      .set({ isActive: isActive ? 1 : 0, updatedAt: new Date().toISOString() })
      .where(eq(brandLearnings.id, learningId))
      .run()
    revalidatePath('/brands/[id]/learnings', 'page')
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to toggle learning'
    return { error: message }
  }
}

// ─── runManualAnalysis ────────────────────────────────────────────────────────

export async function runManualAnalysis(brandId: number): Promise<{ error?: string }> {
  try {
    const { analyzeAllPlatformsForBrand } = await import('@/lib/learning-engine')
    await analyzeAllPlatformsForBrand(brandId, { force: true })
    revalidatePath('/brands/' + brandId + '/learnings')
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to run analysis'
    return { error: message }
  }
}

// ─── pinGoldenExample ─────────────────────────────────────────────────────────

export async function pinGoldenExample(postId: number, brandId: number): Promise<{ error?: string }> {
  try {
    const db = getDb()
    db.update(posts)
      .set({ isGoldenPinned: 1 })
      .where(eq(posts.id, postId))
      .run()
    revalidatePath('/brands/' + brandId + '/golden-examples')
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to pin golden example'
    return { error: message }
  }
}

// ─── unpinGoldenExample ───────────────────────────────────────────────────────

export async function unpinGoldenExample(postId: number, brandId: number): Promise<{ error?: string }> {
  try {
    const db = getDb()
    db.update(posts)
      .set({ isGoldenPinned: 0 })
      .where(eq(posts.id, postId))
      .run()
    revalidatePath('/brands/' + brandId + '/golden-examples')
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to unpin golden example'
    return { error: message }
  }
}

// ─── getLearningEffectiveness ─────────────────────────────────────────────────

export async function getLearningEffectiveness(brandId: number): Promise<Record<number, LearningStats>> {
  const db = getDb()
  const { computeLearningStats } = await import('@/lib/learning-validator')

  const learnings = db
    .select({ id: brandLearnings.id, status: brandLearnings.status })
    .from(brandLearnings)
    .where(eq(brandLearnings.brandId, brandId))
    .all()

  const result: Record<number, LearningStats> = {}
  for (const l of learnings) {
    if (l.status === 'approved' || l.status === 'auto_deactivated') {
      result[l.id] = computeLearningStats(brandId, l.id)
    }
  }
  return result
}
