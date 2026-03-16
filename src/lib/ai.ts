import { getDb } from '@/db'
import { aiSpendLog } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

const AI_MODE = process.env.AI_MODE ?? 'testing'
const MAX_DAILY_AI_SPEND = parseFloat(process.env.MAX_DAILY_AI_SPEND ?? '5.00')

export interface ModelConfig {
  primary: string
  critique: string
  filter: string
}

/**
 * Returns model names based on AI_MODE env var.
 * testing: uses cheaper models (~$6-11/mo)
 * production: uses more capable models (~$90-230/mo)
 */
export function getModelConfig(): ModelConfig {
  if (AI_MODE === 'production') {
    return {
      primary: 'claude-opus-4-20250514',
      critique: 'claude-sonnet-4-20250514',
      filter: 'claude-haiku-3-20250307',
    }
  }
  // Default: testing mode
  return {
    primary: 'claude-sonnet-4-20250514',
    critique: 'claude-haiku-3-20250307',
    filter: 'claude-haiku-3-20250307',
  }
}

/**
 * Check if today's AI spend is under the daily limit.
 * Returns true if spend is under limit (safe to proceed), false if over limit.
 */
export async function checkAiSpend(): Promise<boolean> {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const rows = db.select({ costUsd: aiSpendLog.costUsd })
    .from(aiSpendLog)
    .where(eq(aiSpendLog.date, today))
    .all()

  const total = rows.reduce((sum, row) => sum + parseFloat(row.costUsd), 0)
  return total < MAX_DAILY_AI_SPEND
}

interface LogAiSpendParams {
  brandId?: number
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: string
}

/**
 * Log an AI API call's cost to the ai_spend_log table.
 */
export function logAiSpend(params: LogAiSpendParams): void {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  db.insert(aiSpendLog).values({
    brandId: params.brandId ?? null,
    model: params.model,
    inputTokens: params.inputTokens,
    outputTokens: params.outputTokens,
    costUsd: params.costUsd,
    date: today,
    createdAt: new Date().toISOString(),
  }).run()
}
