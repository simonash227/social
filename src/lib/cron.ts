import { getDb } from '@/db'
import { activityLog, aiSpendLog } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import cron from 'node-cron'

/**
 * Initialize Phase 1 cron jobs with a globalThis singleton guard.
 * Call this from the health endpoint (or any early-loading API route) to
 * ensure cron jobs are registered on the first request. Safe to call
 * multiple times — subsequent calls are no-ops.
 */
export function initCron(): void {
  if ((globalThis as Record<string, unknown>).__cronRegistered) return
  ;(globalThis as Record<string, unknown>).__cronRegistered = true

  // ── 1. Daily DB backup at 3:00 AM ───────────────────────────────────────
  cron.schedule('0 3 * * *', async () => {
    try {
      const { runDbBackup } = await import('./r2')
      await runDbBackup()
      const db = getDb()
      await db.insert(activityLog).values({
        type: 'backup',
        level: 'info',
        message: 'Daily backup completed',
        createdAt: new Date().toISOString(),
      }).run()
    } catch (err) {
      console.error('[cron] DB backup failed:', err)
      try {
        const db = getDb()
        await db.insert(activityLog).values({
          type: 'backup',
          level: 'error',
          message: `Daily backup failed: ${err instanceof Error ? err.message : String(err)}`,
          createdAt: new Date().toISOString(),
        }).run()
      } catch (logErr) {
        console.error('[cron] Failed to log backup error:', logErr)
      }
    }
  })

  // ── 2. AI spend daily summary at midnight ───────────────────────────────
  cron.schedule('0 0 * * *', async () => {
    try {
      const db = getDb()
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const dateStr = yesterday.toISOString().slice(0, 10) // YYYY-MM-DD

      const rows = await db
        .select({ costUsd: aiSpendLog.costUsd })
        .from(aiSpendLog)
        .where(eq(aiSpendLog.date, dateStr))
        .all()

      const total = rows.reduce((sum, row) => sum + parseFloat(row.costUsd), 0)

      await db.insert(activityLog).values({
        type: 'ai_spend',
        level: 'info',
        message: `AI spend for ${dateStr}: $${total.toFixed(4)} USD`,
        createdAt: new Date().toISOString(),
      }).run()
    } catch (err) {
      console.error('[cron] AI spend summary failed:', err)
    }
  })

  console.log('[cron] Phase 1 jobs registered (backup, ai-spend-summary)')
}
