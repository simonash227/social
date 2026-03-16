import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

// GET /api/health — validates infrastructure on Railway
// Returns { status, checks: { sqlite, satori, cron, volume } }
export async function GET() {
  const checks: Record<string, unknown> = {}

  // ------------------------------------------------------------------
  // 1. Volume mount check
  // ------------------------------------------------------------------
  const volumePath = process.env.RAILWAY_VOLUME_MOUNT_PATH
  if (volumePath) {
    try {
      const exists = fs.existsSync(volumePath)
      let writable = false
      if (exists) {
        const testFile = path.join(volumePath, '.write-test')
        try {
          fs.writeFileSync(testFile, 'ok')
          fs.unlinkSync(testFile)
          writable = true
        } catch {
          writable = false
        }
      }
      checks.volume = { pass: exists && writable, path: volumePath, exists, writable }
    } catch (err) {
      checks.volume = { pass: false, error: String(err) }
    }
  } else {
    checks.volume = {
      pass: false,
      error: 'RAILWAY_VOLUME_MOUNT_PATH not set (expected in Railway environment)',
    }
  }

  // ------------------------------------------------------------------
  // 2. SQLite check — open DB on volume (or local fallback), WAL mode, CRUD
  // ------------------------------------------------------------------
  const dbDir = volumePath ?? path.join(process.cwd(), 'data')
  const dbPath = path.join(dbDir, 'app.db')
  try {
    // Ensure directory exists (local dev fallback)
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

    const Database = (await import('better-sqlite3')).default
    const db = new Database(dbPath)

    // WAL mode + safety pragmas
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('busy_timeout = 5000')

    // Integrity check
    const integrity = db.pragma('integrity_check') as Array<{ integrity_check: string }>
    const integrityOk = integrity[0]?.integrity_check === 'ok'

    // CRUD smoke test
    db.exec(
      `CREATE TABLE IF NOT EXISTS _health_check (id INTEGER PRIMARY KEY, ts TEXT NOT NULL)`
    )
    const now = new Date().toISOString()
    db.prepare('INSERT INTO _health_check (ts) VALUES (?)').run(now)
    const row = db.prepare('SELECT ts FROM _health_check ORDER BY id DESC LIMIT 1').get() as
      | { ts: string }
      | undefined
    db.close()

    checks.sqlite = {
      pass: integrityOk && row?.ts === now,
      path: dbPath,
      journalMode: 'WAL',
      integrityCheck: integrityOk ? 'ok' : 'FAILED',
      crudOk: row?.ts === now,
    }
  } catch (err) {
    checks.sqlite = { pass: false, error: String(err) }
  }

  // ------------------------------------------------------------------
  // 3. Satori + sharp check — render JSX vnode to PNG
  // ------------------------------------------------------------------
  try {
    const satori = (await import('satori')).default
    const sharp = (await import('sharp')).default

    // Load Inter WOFF font
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.woff')
    const fontData = fs.readFileSync(fontPath)

    // Minimal vnode — Satori uses plain object format, not JSX.
    // Cast to any to satisfy ReactNode type — Satori accepts plain vnodes at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vnode: any = {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: '#000',
          color: '#fff',
          fontSize: 48,
          fontFamily: 'Inter',
        },
        children: 'Railway Health Check',
      },
    }

    const svg = await satori(vnode, {
      width: 400,
      height: 200,
      fonts: [{ name: 'Inter', data: fontData, weight: 400, style: 'normal' }],
    })

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()
    const isPng = pngBuffer[0] === 0x89 && pngBuffer[1] === 0x50

    checks.satori = {
      pass: isPng,
      pngBytes: pngBuffer.length,
      pngHeaderValid: isPng,
    }
  } catch (err) {
    checks.satori = { pass: false, error: String(err) }
  }

  // ------------------------------------------------------------------
  // 4. Cron check — verify instrumentation.ts registered the scheduler
  // ------------------------------------------------------------------
  const cronRegistered = !!(globalThis as any).__cronRegistered
  checks.cron = {
    pass: cronRegistered,
    registered: cronRegistered,
    note: cronRegistered
      ? 'Cron singleton active via instrumentation.ts'
      : 'Cron not yet registered (may indicate instrumentation.ts did not run)',
  }

  // ------------------------------------------------------------------
  // Aggregate status
  // ------------------------------------------------------------------
  const allPass = Object.values(checks).every((c) => (c as any).pass === true)

  return NextResponse.json(
    {
      status: allPass ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        railway: !!process.env.RAILWAY_ENVIRONMENT,
      },
      checks,
    },
    { status: 200 }
  )
}
