'use server'

import { getDb } from '@/db'
import { posts, postPlatforms, schedulingSlots, socialAccounts, brands } from '@/db/schema'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

// ─── Schedule / Reschedule ────────────────────────────────────────────────────

/**
 * Schedule a post for publishing at the given ISO-8601 timestamp.
 * Sets status to 'scheduled'.
 */
export async function schedulePost(postId: number, scheduledAt: string): Promise<{ error?: string }> {
  try {
    const db = getDb()
    await db.update(posts)
      .set({ status: 'scheduled', scheduledAt })
      .where(eq(posts.id, postId))
      .run()
    revalidatePath('/calendar')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to schedule post' }
  }
}

/**
 * Reschedule a post (e.g. from calendar drag-and-drop) to a new time.
 * Updates scheduledAt and updatedAt.
 */
export async function reschedulePost(postId: number, newScheduledAt: string): Promise<{ error?: string }> {
  try {
    const db = getDb()
    await db.update(posts)
      .set({ scheduledAt: newScheduledAt })
      .where(eq(posts.id, postId))
      .run()
    revalidatePath('/calendar')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to reschedule post' }
  }
}

// ─── Scheduling Slots CRUD ────────────────────────────────────────────────────

/**
 * Get all scheduling slots for a brand, ordered by platform, hour, minute.
 */
export async function getSchedulingSlots(brandId: number): Promise<typeof schedulingSlots.$inferSelect[]> {
  const db = getDb()
  return db
    .select()
    .from(schedulingSlots)
    .where(eq(schedulingSlots.brandId, brandId))
    .orderBy(asc(schedulingSlots.platform), asc(schedulingSlots.hour), asc(schedulingSlots.minute))
    .all()
}

/**
 * Replace all scheduling slots for a brand with a new set.
 * Wraps delete + insert in a transaction pattern.
 */
export async function saveSchedulingSlots(
  brandId: number,
  slots: Array<{ platform: string; hour: number; minute: number }>
): Promise<{ error?: string }> {
  try {
    const db = getDb()

    // Delete all existing slots for this brand
    await db.delete(schedulingSlots)
      .where(eq(schedulingSlots.brandId, brandId))
      .run()

    // Insert new slots
    if (slots.length > 0) {
      await db.insert(schedulingSlots)
        .values(slots.map(s => ({
          brandId,
          platform: s.platform,
          hour: s.hour,
          minute: s.minute,
        })))
        .run()
    }

    revalidatePath('/calendar')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save scheduling slots' }
  }
}

// ─── Schedule to next slot ────────────────────────────────────────────────────

/**
 * Find the next available scheduling slot for a brand + platform, apply +/-15 min jitter,
 * and set the post's scheduledAt accordingly.
 *
 * Returns an error string if no slots are configured for this brand+platform.
 */
export async function scheduleToNextSlot(
  postId: number,
  brandId: number,
  platform: string
): Promise<{ scheduledAt?: string; error?: string }> {
  try {
    const db = getDb()

    const slots = await db
      .select()
      .from(schedulingSlots)
      .where(and(
        eq(schedulingSlots.brandId, brandId),
        eq(schedulingSlots.platform, platform),
      ))
      .orderBy(asc(schedulingSlots.hour), asc(schedulingSlots.minute))
      .all()

    if (slots.length === 0) {
      return { error: `No scheduling slots configured for ${platform} on this brand` }
    }

    const now = new Date()
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes()

    // Find the next slot after now (today), or wrap to tomorrow's first slot
    let targetSlot = slots.find(s => s.hour * 60 + s.minute > nowMinutes) ?? slots[0]
    const isNextDay = !slots.find(s => s.hour * 60 + s.minute > nowMinutes)

    const target = new Date(now)
    target.setUTCHours(targetSlot.hour, targetSlot.minute, 0, 0)
    if (isNextDay) {
      target.setUTCDate(target.getUTCDate() + 1)
    }

    // Apply +/-15 min jitter
    const jitterMs = (Math.random() * 30 - 15) * 60 * 1000
    const scheduledAt = new Date(target.getTime() + jitterMs).toISOString()

    await db.update(posts)
      .set({ status: 'scheduled', scheduledAt })
      .where(eq(posts.id, postId))
      .run()

    revalidatePath('/calendar')
    return { scheduledAt }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to schedule to next slot' }
  }
}

// ─── Calendar Events ──────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string
  title: string
  start: string
  color: string
  extendedProps: {
    status: string
    platforms: string[]
    brandName: string
    contentType: string
  }
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3b82f6',   // blue
  published: '#22c55e',   // green
  failed:    '#ef4444',   // red
}

/**
 * Get calendar events for FullCalendar.
 * If brandId is provided, filter to that brand only; otherwise return all brands.
 */
export async function getCalendarEvents(brandId?: number): Promise<CalendarEvent[]> {
  const db = getDb()

  // Query posts with scheduled/published/failed status
  const postRows = await db
    .select({
      id: posts.id,
      content: posts.content,
      status: posts.status,
      scheduledAt: posts.scheduledAt,
      publishedAt: posts.publishedAt,
      brandId: posts.brandId,
      brandName: brands.name,
    })
    .from(posts)
    .innerJoin(brands, eq(posts.brandId, brands.id))
    .where(
      brandId
        ? and(
            inArray(posts.status, ['scheduled', 'published', 'failed']),
            eq(posts.brandId, brandId)
          )
        : inArray(posts.status, ['scheduled', 'published', 'failed'])
    )
    .all()

  if (postRows.length === 0) return []

  // Fetch platforms for all found posts
  const postIds = postRows.map(p => p.id)
  const platformRows = await db
    .select({ postId: postPlatforms.postId, platform: postPlatforms.platform })
    .from(postPlatforms)
    .where(inArray(postPlatforms.postId, postIds))
    .all()

  // Build platform map
  const platformsByPost: Record<number, string[]> = {}
  for (const row of platformRows) {
    if (!platformsByPost[row.postId]) platformsByPost[row.postId] = []
    platformsByPost[row.postId].push(row.platform)
  }

  return postRows.map(post => ({
    id: String(post.id),
    title: post.content.slice(0, 60) + (post.content.length > 60 ? '...' : ''),
    start: post.scheduledAt ?? post.publishedAt ?? new Date().toISOString(),
    color: STATUS_COLORS[post.status] ?? '#6b7280',
    extendedProps: {
      status: post.status,
      platforms: platformsByPost[post.id] ?? [],
      brandName: post.brandName,
      contentType: 'text',
    },
  }))
}
