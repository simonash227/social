import { getDb } from '@/db'
import { posts, postPlatforms, socialAccounts, activityLog } from '@/db/schema'
import { eq, and, lte, isNull, or } from 'drizzle-orm'
import { publishTextPost } from './upload-post'
import { incrementFailureCount } from '@/app/actions/accounts'

const RETRY_DELAY_MS = 5 * 60 * 1000  // 5 minutes
const MAX_FAILURES = 3

/**
 * Publish all posts that are due (scheduled_at <= now) with per-platform retry logic.
 * Uses a mutex on globalThis to prevent overlapping cron ticks.
 */
export async function publishDuePosts(): Promise<void> {
  const g = globalThis as Record<string, unknown>
  if (g.__publishRunning) {
    console.log('[publish] skipping tick -- previous run still in progress')
    return
  }

  g.__publishRunning = true

  try {
    const db = getDb()
    const now = new Date().toISOString()

    // Find all scheduled posts where scheduled_at <= now
    const duePosts = await db
      .select()
      .from(posts)
      .where(and(
        eq(posts.status, 'scheduled'),
        lte(posts.scheduledAt!, now),
      ))
      .all()

    for (const post of duePosts) {
      await processPost(post, now)
    }
  } finally {
    g.__publishRunning = false
  }
}

type Post = typeof posts.$inferSelect
type PostPlatform = typeof postPlatforms.$inferSelect

async function processPost(post: Post, now: string): Promise<void> {
  const db = getDb()

  // Find eligible platform rows: pending AND (retryAt IS NULL OR retryAt <= now)
  const eligiblePlatforms = await db
    .select()
    .from(postPlatforms)
    .where(and(
      eq(postPlatforms.postId, post.id),
      eq(postPlatforms.status, 'pending'),
      or(isNull(postPlatforms.retryAt), lte(postPlatforms.retryAt!, now)),
    ))
    .all()

  for (const platform of eligiblePlatforms) {
    await processPlatform(post, platform, now)
  }

  // Re-fetch all platforms to determine overall post status
  const allPlatforms = await db
    .select()
    .from(postPlatforms)
    .where(eq(postPlatforms.postId, post.id))
    .all()

  const allPublished = allPlatforms.length > 0 && allPlatforms.every(p => p.status === 'published')
  const allFailed    = allPlatforms.length > 0 && allPlatforms.every(p => p.status === 'failed')

  if (allPublished) {
    await db.update(posts)
      .set({ status: 'published', publishedAt: new Date().toISOString() })
      .where(eq(posts.id, post.id))
      .run()
  } else if (allFailed) {
    await db.update(posts)
      .set({ status: 'failed' })
      .where(eq(posts.id, post.id))
      .run()
  }
  // Otherwise leave as 'scheduled' (some platforms still pending/retrying)
}

async function processPlatform(post: Post, platform: PostPlatform, now: string): Promise<void> {
  const db = getDb()

  // Look up the social account for this brand + platform to get uploadPostUsername
  const account = await db
    .select()
    .from(socialAccounts)
    .where(and(
      eq(socialAccounts.brandId, post.brandId),
      eq(socialAccounts.platform, platform.platform),
      eq(socialAccounts.status, 'connected'),
    ))
    .get()

  if (!account?.uploadPostUsername) {
    // Cannot publish without an Upload-Post username -- log and skip
    await logActivity(post.brandId, 'publish', 'warn',
      `No Upload-Post username for ${platform.platform} (brand ${post.brandId})`,
      { postId: post.id, platform: platform.platform }
    )
    return
  }

  const content = platform.content ?? post.content

  try {
    const response = await publishTextPost({
      uploadPostUsername: account.uploadPostUsername,
      platforms: [platform.platform],
      content,
    })

    const requestId = response.request_id ?? response.job_id ?? null

    await db.update(postPlatforms)
      .set({ status: 'published', requestId: requestId as string | null })
      .where(eq(postPlatforms.id, platform.id))
      .run()

    await logActivity(post.brandId, 'publish', 'info',
      `Published post ${post.id} to ${platform.platform}`,
      { postId: post.id, platform: platform.platform, requestId }
    )
  } catch (err) {
    const newFailureCount = platform.failureCount + 1
    const message = err instanceof Error ? err.message : String(err)

    if (newFailureCount >= MAX_FAILURES) {
      // Max retries reached -- mark as failed
      await db.update(postPlatforms)
        .set({ status: 'failed', failureCount: newFailureCount })
        .where(eq(postPlatforms.id, platform.id))
        .run()
    } else {
      // Schedule retry with 5-minute backoff
      const retryAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString()
      await db.update(postPlatforms)
        .set({ failureCount: newFailureCount, retryAt })
        .where(eq(postPlatforms.id, platform.id))
        .run()
    }

    await logActivity(post.brandId, 'publish', 'error',
      `Failed to publish post ${post.id} to ${platform.platform} (attempt ${newFailureCount}/${MAX_FAILURES}): ${message}`,
      { postId: post.id, platform: platform.platform, failureCount: newFailureCount }
    )

    // Increment account-level failure count for circuit-breaker awareness
    try {
      await incrementFailureCount(account?.id ?? 0)
    } catch {
      // Non-fatal -- don't block publish retry logic
    }
  }
}

async function logActivity(
  brandId: number,
  type: string,
  level: 'info' | 'warn' | 'error',
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const db = getDb()
    await db.insert(activityLog).values({
      brandId,
      type,
      level,
      message,
      metadata: metadata as Record<string, unknown>,
      createdAt: new Date().toISOString(),
    }).run()
  } catch (err) {
    console.error('[publish] Failed to log activity:', err)
  }
}
