import { calcEngagementScore, classifyTier } from '../src/lib/collect-analytics'

let passed = 0
let failed = 0

function check(label: string, actual: unknown, expected: unknown) {
  if (actual === expected) {
    console.log(`[PASS] ${label}`)
    passed++
  } else {
    console.log(`[FAIL] ${label} -- expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)}`)
    failed++
  }
}

async function main() {
  console.log('=== calcEngagementScore tests ===')

  // 1. views=0 -> returns 0 (ANLY-02 guard)
  check(
    'calcEngagementScore: views=0 returns 0',
    calcEngagementScore({ views: 0, likes: 10, comments: 5, shares: 2 }),
    0
  )

  // 2. views=null -> returns 0
  check(
    'calcEngagementScore: views=null returns 0',
    calcEngagementScore({ views: null, likes: 10, comments: 5, shares: 2 }),
    0
  )

  // 3. views=1000, likes=50, comments=10, shares=5
  // weighted = 50*1 + 10*3 + 5*2 = 50 + 30 + 10 = 90
  // score = Math.min(100, Math.round(90/1000 * 1000)) = Math.min(100, 90) = 90
  check(
    'calcEngagementScore: views=1000 likes=50 comments=10 shares=5 -> 90',
    calcEngagementScore({ views: 1000, likes: 50, comments: 10, shares: 5 }),
    90
  )

  // 4. views=100, likes=100, comments=100, shares=100
  // weighted = 100*1 + 100*3 + 100*2 = 100 + 300 + 200 = 600
  // score = Math.min(100, Math.round(600/100 * 1000)) = Math.min(100, 6000) = 100 (capped)
  check(
    'calcEngagementScore: capped at 100',
    calcEngagementScore({ views: 100, likes: 100, comments: 100, shares: 100 }),
    100
  )

  // 5. All metrics null -> returns 0
  check(
    'calcEngagementScore: all null returns 0',
    calcEngagementScore({ views: null, likes: null, comments: null, shares: null }),
    0
  )

  // 6. views=500, likes=0, comments=0, shares=0 -> returns 0 (no engagement)
  // weighted = 0*1 + 0*3 + 0*2 = 0
  // score = Math.min(100, Math.round(0/500 * 1000)) = 0
  check(
    'calcEngagementScore: views=500 all-zero engagement returns 0',
    calcEngagementScore({ views: 500, likes: 0, comments: 0, shares: 0 }),
    0
  )

  console.log('\n=== classifyTier tests ===')

  // 1. score=80, p25=20, p75=60 -> 'top' (score > p75)
  check(
    'classifyTier: score=80 > p75=60 -> top',
    classifyTier(80, 20, 60),
    'top'
  )

  // 2. score=10, p25=20, p75=60 -> 'under' (score < p25)
  check(
    'classifyTier: score=10 < p25=20 -> under',
    classifyTier(10, 20, 60),
    'under'
  )

  // 3. score=40, p25=20, p75=60 -> 'average'
  check(
    'classifyTier: score=40 between p25=20 and p75=60 -> average',
    classifyTier(40, 20, 60),
    'average'
  )

  // 4. score=60, p25=20, p75=60 -> 'average' (at p75 boundary, not above)
  check(
    'classifyTier: score=60 at p75=60 boundary -> average',
    classifyTier(60, 20, 60),
    'average'
  )

  // 5. score=20, p25=20, p75=60 -> 'average' (at p25 boundary, not below)
  check(
    'classifyTier: score=20 at p25=20 boundary -> average',
    classifyTier(20, 20, 60),
    'average'
  )

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`)

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
