/**
 * INFRA-05: Validate Upload-Post API key authentication and analytics endpoint reachability
 *
 * Run: npx tsx scripts/validate/05-upload-post.ts
 * Exit 0 = pass or skip, Exit 1 = fail
 *
 * Set UPLOAD_POST_API_KEY in .env.local before running.
 * If key is not set, prints [SKIP] and exits 0.
 */

import fs from 'node:fs'
import path from 'node:path'

const start = Date.now()

function elapsed() {
  return `${Date.now() - start}ms`
}

function pass(msg: string) {
  console.log(`[PASS] ${msg}`)
}

function fail(msg: string) {
  console.error(`[FAIL] ${msg}`)
  process.exit(1)
}

function skip(msg: string) {
  console.log(`[SKIP] ${msg}`)
}

function info(msg: string) {
  console.log(`[INFO] ${msg}`)
}

console.log(`\n=== INFRA-05: Upload-Post API Validation ===`)
console.log(`Started: ${new Date().toISOString()}\n`)

// Load .env.local if present (simple parser -- not using dotenv to keep script self-contained)
const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const value = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
  info(`.env.local loaded from ${envPath}`)
}

const apiKey = process.env.UPLOAD_POST_API_KEY

if (!apiKey || apiKey === 'your_key_here') {
  skip(`UPLOAD_POST_API_KEY not set -- set in .env.local to validate`)
  skip(`  Copy .env.local.example to .env.local and add your Upload-Post API key`)
  console.log(`\n[SKIP] INFRA-05: Upload-Post validation skipped (no API key) -- exit 0`)
  process.exit(0)
}

pass(`UPLOAD_POST_API_KEY found (${apiKey.length} chars, starts with '${apiKey.slice(0, 4)}...')`)

const BASE_URL = 'https://api.upload-post.com'
const HEADERS = { 'x-api-key': apiKey, 'Content-Type': 'application/json' }

async function main() {
  // -------------------------------------------------------------------------
  // Step 1: GET /api/uploadposts/accounts -- validate API key works
  // -------------------------------------------------------------------------
  console.log('\n--- Step 1: Validate API key via accounts endpoint ---')

  let accountsData: any
  try {
    const accountsRes = await fetch(`${BASE_URL}/api/uploadposts/accounts`, {
      method: 'GET',
      headers: HEADERS,
    })

    if (accountsRes.status === 401 || accountsRes.status === 403) {
      fail(`API key rejected: ${accountsRes.status} ${accountsRes.statusText}`)
    }

    if (!accountsRes.ok) {
      const body = await accountsRes.text()
      fail(`Accounts endpoint error: ${accountsRes.status} ${accountsRes.statusText}\nBody: ${body}`)
    }

    accountsData = await accountsRes.json()

    if (!Array.isArray(accountsData)) {
      fail(`Expected array from accounts endpoint, got: ${typeof accountsData}`)
    }

    pass(`API key valid -- accounts endpoint returned ${accountsData.length} account(s)`)

    if (accountsData.length > 0) {
      const platforms = accountsData
        .map((a: any) => a.platform ?? a.type ?? JSON.stringify(a).slice(0, 30))
        .join(', ')
      pass(`Platforms found: ${platforms}`)
    } else {
      info(`No accounts connected yet (valid response, just empty array)`)
    }
  } catch (err) {
    if ((err as Error).message.startsWith('[FAIL]')) {
      process.exit(1)
    }
    fail(`Accounts endpoint request failed: ${err}`)
  }

  // -------------------------------------------------------------------------
  // Step 2: GET /api/uploadposts/post-analytics/{id} -- validate endpoint exists
  // -------------------------------------------------------------------------
  console.log('\n--- Step 2: Validate analytics endpoint accepts request_id lookups ---')

  const DUMMY_ID = 'test-dummy-id-validation-spike'

  let analyticsStatus: number = 0
  let analyticsBody: string = ''
  try {
    const analyticsRes = await fetch(
      `${BASE_URL}/api/uploadposts/post-analytics/${DUMMY_ID}`,
      {
        method: 'GET',
        headers: HEADERS,
      }
    )

    analyticsStatus = analyticsRes.status
    analyticsBody = await analyticsRes.text()

    // 200 = found (unlikely for dummy ID)
    // 404 = not found (expected for dummy ID -- endpoint works, ID just doesn't exist)
    // 400 = bad request (endpoint exists, ID format rejected)
    // 401/403 = auth failure (unexpected since we passed Step 1)
    // 405 = method not allowed (endpoint doesn't exist at all)
    if (analyticsStatus === 401 || analyticsStatus === 403) {
      fail(`Analytics endpoint rejected API key: ${analyticsStatus} (unexpected, key worked for accounts)`)
    }
    if (analyticsStatus === 405) {
      fail(`Analytics endpoint returned 405 Method Not Allowed -- endpoint may not exist`)
    }

    pass(`Analytics endpoint reachable (status: ${analyticsStatus})`)
    info(`Response body shape: ${analyticsBody.slice(0, 200)}`)

    if (analyticsStatus === 200) {
      info(`Response is 200 -- trying to parse as JSON for schema discovery`)
      try {
        const parsed = JSON.parse(analyticsBody)
        info(`Schema keys: ${Object.keys(parsed).join(', ')}`)
      } catch {
        info(`Response is not JSON -- raw body above`)
      }
    } else if (analyticsStatus === 404) {
      pass(`404 expected for dummy ID -- endpoint exists and accepts request_id path parameter`)
    } else {
      info(`Status ${analyticsStatus} -- endpoint exists (see body above for details)`)
    }
  } catch (err) {
    if ((err as Error).message.startsWith('[FAIL]')) {
      process.exit(1)
    }
    fail(`Analytics endpoint request failed: ${err}`)
  }

  const accountCount = Array.isArray(accountsData) ? accountsData.length : 0
  console.log(`\n[PASS] Upload-Post API key valid, ${accountCount} accounts found, analytics endpoint reachable (status: ${analyticsStatus}) (${elapsed()})`)
  console.log(`Completed: ${new Date().toISOString()}\n`)
}

main().catch(err => {
  console.error('[FAIL] Unexpected error:', err)
  process.exit(1)
})
