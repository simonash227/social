/**
 * INFRA-03: Validate node-cron singleton guard pattern (simulating instrumentation.ts)
 *
 * Run: npx tsx scripts/validate/03-cron-singleton.ts
 * Exit 0 = pass, Exit 1 = fail
 */

import cron from 'node-cron'

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

console.log(`\n=== INFRA-03: node-cron Singleton Guard Validation ===`)
console.log(`Started: ${new Date().toISOString()}\n`)

// -------------------------------------------------------------------------
// Simulate the instrumentation.ts singleton pattern
// -------------------------------------------------------------------------

// Track how many times cron.schedule() would be called
let cronScheduleCallCount = 0

// Intercept cron.schedule to count calls without actually starting jobs
const originalSchedule = cron.schedule.bind(cron)
;(cron as any).schedule = function (expression: string, callback: () => void, options?: object) {
  cronScheduleCallCount++
  // Don't actually start the job — this is a guard test only
  // Return a mock task object with destroy() to be safe
  return { stop: () => {}, destroy: () => {} }
}

// Declare type for globalThis with our custom flag
declare global {
  // eslint-disable-next-line no-var
  var __cronRegistered: boolean | undefined
}

// Reset state for clean test
globalThis.__cronRegistered = undefined

// -------------------------------------------------------------------------
// The register() function — mirrors instrumentation.ts singleton pattern
// -------------------------------------------------------------------------
async function register(runtime?: string) {
  // Guard 1: only run in Node.js runtime (not Edge)
  const nextRuntime = runtime ?? process.env.NEXT_RUNTIME
  if (nextRuntime !== 'nodejs') {
    console.log(`  [register called with runtime=${nextRuntime ?? 'undefined'} — skipping]`)
    return
  }

  // Guard 2: only register once (dev hot-reload calls register multiple times)
  if (globalThis.__cronRegistered) {
    console.log(`  [cron] Already registered, skipping`)
    return
  }
  globalThis.__cronRegistered = true

  // Register the cron job (lazy import pattern — in real instrumentation.ts this is a dynamic import)
  cron.schedule('* * * * *', () => {
    console.log('[cron] tick at', new Date().toISOString())
  })

  console.log(`  [cron] Scheduler registered`)
}

async function main() {
  // -------------------------------------------------------------------------
  // Test 1: NEXT_RUNTIME guard — when runtime is not 'nodejs', register() returns early
  // -------------------------------------------------------------------------
  console.log('--- Test 1: NEXT_RUNTIME guard ---')

  globalThis.__cronRegistered = undefined
  cronScheduleCallCount = 0

  await register('edge')
  await register('edge')

  if (cronScheduleCallCount !== 0) {
    fail(`NEXT_RUNTIME guard failed: cron.schedule called ${cronScheduleCallCount} times when runtime='edge' (expected 0)`)
  }
  pass(`NEXT_RUNTIME guard works: cron.schedule called 0 times when runtime='edge'`)

  // -------------------------------------------------------------------------
  // Test 2: Singleton guard — call register() 3 times, only 1 cron registration
  // -------------------------------------------------------------------------
  console.log('\n--- Test 2: Singleton guard (simulate 3 hot-reload calls) ---')

  globalThis.__cronRegistered = undefined
  cronScheduleCallCount = 0

  await register('nodejs') // First call — should register
  await register('nodejs') // Second call — should skip (already registered)
  await register('nodejs') // Third call — should skip (already registered)

  if (cronScheduleCallCount !== 1) {
    fail(`Singleton guard failed: cron.schedule called ${cronScheduleCallCount} times (expected exactly 1)`)
  }
  pass(`Singleton guard works: cron.schedule called exactly once across 3 register() invocations`)

  // -------------------------------------------------------------------------
  // Test 3: globalThis persists the flag (simulates module reload behavior)
  // -------------------------------------------------------------------------
  console.log('\n--- Test 3: globalThis flag persistence ---')

  // Flag should still be set from Test 2
  if (!globalThis.__cronRegistered) {
    fail(`globalThis.__cronRegistered was lost (expected true)`)
  }
  pass(`globalThis.__cronRegistered persists: ${globalThis.__cronRegistered}`)

  // Additional register() call — must not increment counter
  const countBefore = cronScheduleCallCount
  await register('nodejs')
  if (cronScheduleCallCount !== countBefore) {
    fail(`Unexpected cron.schedule call when flag was already set`)
  }
  pass(`No additional cron registration when flag already set`)

  // -------------------------------------------------------------------------
  // Test 4: Verify cron module is accessible and validate() works
  // -------------------------------------------------------------------------
  console.log('\n--- Test 4: cron expression validation ---')

  const validExpressions = ['* * * * *', '0 9 * * 1', '0 */6 * * *']
  const invalidExpressions = ['not-a-cron', '* * * *', '60 * * * *']

  for (const expr of validExpressions) {
    if (!cron.validate(expr)) {
      fail(`cron.validate('${expr}') returned false (expected true)`)
    }
    pass(`cron.validate('${expr}') = true`)
  }

  for (const expr of invalidExpressions) {
    if (cron.validate(expr)) {
      fail(`cron.validate('${expr}') returned true (expected false)`)
    }
    pass(`cron.validate('${expr}') = false (correctly rejected)`)
  }

  // Restore original schedule
  ;(cron as any).schedule = originalSchedule

  console.log(`\n[PASS] INFRA-03: node-cron singleton validation complete (${elapsed()})`)
  console.log(`Completed: ${new Date().toISOString()}\n`)
}

main().catch(err => {
  console.error('[FAIL] Unexpected error:', err)
  process.exit(1)
})
