'use server'

import { getDb } from '@/db'
import { socialAccounts, activityLog } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { listProfiles } from '@/lib/upload-post'
import { revalidatePath } from 'next/cache'

/**
 * Sync social accounts from Upload-Post API for a brand.
 * - Fetches all profiles from Upload-Post
 * - Inserts new accounts (brand x platform x username)
 * - Re-connects previously disconnected accounts if still active in Upload-Post
 * - Returns count of accounts synced/updated
 */
export async function syncAccounts(
  brandId: number
): Promise<{ synced: number; error?: string }> {
  let profiles
  try {
    profiles = await listProfiles()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { synced: 0, error: `Failed to fetch profiles from Upload-Post: ${message}` }
  }

  const db = getDb()
  let synced = 0

  for (const profile of profiles) {
    for (const platform of profile.connected_platforms) {
      const existing = await db
        .select()
        .from(socialAccounts)
        .where(
          and(
            eq(socialAccounts.brandId, brandId),
            eq(socialAccounts.platform, platform),
            eq(socialAccounts.username, profile.username)
          )
        )
        .get()

      if (!existing) {
        await db.insert(socialAccounts).values({
          brandId,
          platform,
          username: profile.username,
          status: 'connected',
          failureCount: 0,
          uploadPostUsername: profile.username,
          createdAt: new Date().toISOString(),
        }).run()
        synced++
      } else if (existing.status === 'disconnected' && profile.status === 'active') {
        await db
          .update(socialAccounts)
          .set({ status: 'connected', failureCount: 0 })
          .where(eq(socialAccounts.id, existing.id))
          .run()
        synced++
      }
    }
  }

  await db.insert(activityLog).values({
    brandId,
    type: 'account',
    level: 'info',
    message: `Synced ${synced} account(s) from Upload-Post`,
    createdAt: new Date().toISOString(),
  }).run()

  revalidatePath(`/brands/${brandId}`)
  return { synced }
}

/**
 * Mark a social account as disconnected and log the event.
 */
export async function markAccountDisconnected(accountId: number): Promise<void> {
  const db = getDb()

  const account = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, accountId))
    .get()

  await db
    .update(socialAccounts)
    .set({ status: 'disconnected' })
    .where(eq(socialAccounts.id, accountId))
    .run()

  await db.insert(activityLog).values({
    brandId: account?.brandId ?? null,
    type: 'account',
    level: 'warn',
    message: `Account ${accountId} marked as disconnected`,
    createdAt: new Date().toISOString(),
  }).run()
}

/**
 * Increment failure count for a social account.
 * Automatically marks the account disconnected after 5 consecutive failures.
 * Called by the publish cron (Phase 5) on each publish failure.
 */
export async function incrementFailureCount(accountId: number): Promise<void> {
  const db = getDb()

  const account = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.id, accountId))
    .get()

  if (!account) return

  const newCount = account.failureCount + 1

  await db
    .update(socialAccounts)
    .set({ failureCount: newCount })
    .where(eq(socialAccounts.id, accountId))
    .run()

  if (newCount >= 5) {
    await markAccountDisconnected(accountId)
  }
}
