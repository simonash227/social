'use server'

import { getDb } from '@/db'
import { brands, feedSources, feedEntries } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

export interface FeedWithStats {
  id: number
  brandId: number
  url: string
  type: 'rss' | 'youtube' | 'reddit' | 'google_news'
  pollInterval: number | null
  relevanceThreshold: number | null
  targetPlatforms: string[] | null
  consecutiveFailures: number
  enabled: number
  createdAt: string
  totalEntries: number
  relevantEntries: number
  processedEntries: number
}

function detectFeedType(url: string, defaultType: 'rss' | 'youtube' | 'reddit' | 'google_news'): 'rss' | 'youtube' | 'reddit' | 'google_news' {
  if (url.includes('youtube.com/feeds/videos.xml')) return 'youtube'
  if (url.includes('reddit.com/r/') && url.endsWith('.rss')) return 'reddit'
  if (url.includes('news.google.com/rss')) return 'google_news'
  return defaultType
}

export async function addFeed(
  brandId: number,
  url: string,
  type: 'rss' | 'youtube' | 'reddit' | 'google_news'
): Promise<{ id?: number; error?: string }> {
  if (!url || !url.trim()) {
    return { error: 'URL is required' }
  }
  const trimmedUrl = url.trim()
  if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
    return { error: 'URL must start with http:// or https://' }
  }

  const detectedType = detectFeedType(trimmedUrl, type)

  try {
    const db = getDb()
    const result = await db
      .insert(feedSources)
      .values({
        brandId,
        url: trimmedUrl,
        type: detectedType,
        pollInterval: 5,
        relevanceThreshold: 6,
        targetPlatforms: null,
        enabled: 1,
      })
      .returning({ id: feedSources.id })
      .get()

    revalidatePath(`/brands/${brandId}/feeds`)
    return { id: result.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add feed'
    return { error: message }
  }
}

export async function updateFeed(
  feedId: number,
  updates: {
    pollInterval?: number
    relevanceThreshold?: number
    targetPlatforms?: string[]
    enabled?: number
  }
): Promise<{ error?: string }> {
  try {
    const db = getDb()

    // Look up brandId for revalidation
    const feed = await db
      .select({ brandId: feedSources.brandId })
      .from(feedSources)
      .where(eq(feedSources.id, feedId))
      .get()

    if (!feed) {
      return { error: 'Feed not found' }
    }

    await db
      .update(feedSources)
      .set(updates)
      .where(eq(feedSources.id, feedId))

    revalidatePath(`/brands/${feed.brandId}/feeds`)
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update feed'
    return { error: message }
  }
}

export async function deleteFeed(feedId: number): Promise<{ error?: string }> {
  try {
    const db = getDb()

    // Look up brandId first for revalidation
    const feed = await db
      .select({ brandId: feedSources.brandId })
      .from(feedSources)
      .where(eq(feedSources.id, feedId))
      .get()

    if (!feed) {
      return { error: 'Feed not found' }
    }

    // Delete all feed entries for this feed source first
    await db.delete(feedEntries).where(eq(feedEntries.feedSourceId, feedId))

    // Delete the feed source
    await db.delete(feedSources).where(eq(feedSources.id, feedId))

    revalidatePath(`/brands/${feed.brandId}/feeds`)
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete feed'
    return { error: message }
  }
}

export async function getBrandFeeds(brandId: number): Promise<FeedWithStats[]> {
  const db = getDb()

  const feeds = await db
    .select()
    .from(feedSources)
    .where(eq(feedSources.brandId, brandId))
    .all()

  const feedsWithStats: FeedWithStats[] = await Promise.all(
    feeds.map(async (feed) => {
      const threshold = feed.relevanceThreshold ?? 6

      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(feedEntries)
        .where(eq(feedEntries.feedSourceId, feed.id))
        .get()

      const relevantResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(feedEntries)
        .where(
          sql`${feedEntries.feedSourceId} = ${feed.id} AND ${feedEntries.relevanceScore} >= ${threshold}`
        )
        .get()

      const processedResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(feedEntries)
        .where(
          sql`${feedEntries.feedSourceId} = ${feed.id} AND ${feedEntries.processedAt} IS NOT NULL`
        )
        .get()

      return {
        ...feed,
        totalEntries: totalResult?.count ?? 0,
        relevantEntries: relevantResult?.count ?? 0,
        processedEntries: processedResult?.count ?? 0,
      }
    })
  )

  return feedsWithStats
}

export async function updateAutomationLevel(
  brandId: number,
  level: 'manual' | 'semi' | 'mostly' | 'full'
): Promise<{ error?: string }> {
  try {
    const db = getDb()

    await db
      .update(brands)
      .set({ automationLevel: level })
      .where(eq(brands.id, brandId))

    revalidatePath(`/brands/${brandId}/feeds`)
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update automation level'
    return { error: message }
  }
}
