import { NextResponse } from 'next/server'
import { initCron } from '@/lib/cron'
import { getDb } from '@/db'

// GET /api/health — production-ready health endpoint.
// Triggers cron initialization on first request (singleton guard in initCron).
// Kept public (excluded from auth middleware) for Railway health checks.
export async function GET() {
  // Initialize cron jobs on first request
  initCron()

  const checks: Record<string, unknown> = {}

  // ── 1. Database ──────────────────────────────────────────────────────────
  try {
    getDb()
    checks.database = { pass: true }
  } catch (err) {
    checks.database = { pass: false, error: String(err) }
  }

  // ── 2. Cron ─────────────────────────────────────────────────────────────
  checks.cron = {
    pass: !!(globalThis as Record<string, unknown>).__cronRegistered,
    registered: !!(globalThis as Record<string, unknown>).__cronRegistered,
  }

  // ── 3. AI Mode ──────────────────────────────────────────────────────────
  checks.ai_mode = {
    pass: true,
    value: process.env.AI_MODE ?? 'testing',
  }

  // ── 4. Environment Variables (presence check only, never values) ─────────
  const requiredEnvVars = [
    'AUTH_PASSWORD',
    'UPLOAD_POST_API_KEY',
    'R2_ACCOUNT_ID',
    'ANTHROPIC_API_KEY',
    'MAX_DAILY_AI_SPEND',
  ]
  const envStatus: Record<string, boolean> = {}
  for (const key of requiredEnvVars) {
    envStatus[key] = !!process.env[key]
  }
  const allEnvPresent = Object.values(envStatus).every(Boolean)
  checks.env_vars = {
    pass: allEnvPresent,
    present: envStatus,
  }

  const allPass = Object.values(checks).every((c) => (c as { pass: boolean }).pass === true)

  return NextResponse.json(
    {
      status: allPass ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        aiMode: process.env.AI_MODE ?? 'testing',
      },
      checks,
    },
    { status: 200 }
  )
}
