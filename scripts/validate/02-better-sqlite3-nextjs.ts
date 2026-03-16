/**
 * INFRA-02: Validate better-sqlite3 loads, executes queries, and data round-trips
 *
 * Run: npx tsx scripts/validate/02-better-sqlite3-nextjs.ts
 * Exit 0 = pass, Exit 1 = fail
 */

import Database from 'better-sqlite3'
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

console.log(`\n=== INFRA-02: better-sqlite3 + Next.js Validation ===`)
console.log(`Started: ${new Date().toISOString()}\n`)

// Verify module loaded
try {
  const betterSqlite3Path = require.resolve('better-sqlite3')
  pass(`better-sqlite3 module resolved at: ${path.relative(process.cwd(), betterSqlite3Path)}`)
} catch (err) {
  fail(`Could not resolve better-sqlite3 module: ${err}`)
}

// Create in-memory database
let db: InstanceType<typeof Database>
try {
  db = new Database(':memory:')
  pass(`In-memory database created (:memory:)`)
} catch (err) {
  fail(`Could not create in-memory database: ${err}`)
  process.exit(1)
}

// Create table
try {
  db!.exec(`
    CREATE TABLE users (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT    NOT NULL,
      email TEXT    NOT NULL UNIQUE,
      score REAL    DEFAULT 0.0
    )
  `)
  pass(`Table 'users' created with INTEGER, TEXT, REAL columns`)
} catch (err) {
  fail(`Could not create table: ${err}`)
}

// Insert rows
const insertStmt = db!.prepare('INSERT INTO users (name, email, score) VALUES (?, ?, ?)')

const testData = [
  { name: 'Alice', email: 'alice@example.com', score: 9.5 },
  { name: 'Bob', email: 'bob@example.com', score: 7.2 },
  { name: 'Charlie', email: 'charlie@example.com', score: 8.8 },
]

try {
  const insertMany = db!.transaction((rows: typeof testData) => {
    for (const row of rows) {
      insertStmt.run(row.name, row.email, row.score)
    }
  })
  insertMany(testData)
  pass(`Inserted ${testData.length} rows via transaction`)
} catch (err) {
  fail(`Could not insert rows: ${err}`)
}

// Query and verify data round-trip
try {
  const rows = db!.prepare('SELECT * FROM users ORDER BY id').all() as typeof testData & { id: number }[]

  if (rows.length !== testData.length) {
    fail(`Expected ${testData.length} rows, got ${rows.length}`)
  }
  pass(`Row count correct: ${rows.length}`)

  for (let i = 0; i < testData.length; i++) {
    const expected = testData[i]
    const actual = rows[i]

    if (actual.name !== expected.name) {
      fail(`Row ${i}: expected name '${expected.name}', got '${actual.name}'`)
    }
    if (actual.email !== expected.email) {
      fail(`Row ${i}: expected email '${expected.email}', got '${actual.email}'`)
    }
    if (Math.abs(actual.score - expected.score) > 0.0001) {
      fail(`Row ${i}: expected score ${expected.score}, got ${actual.score}`)
    }
  }
  pass(`Data round-trip verified: all ${testData.length} rows match expected values`)
} catch (err) {
  if ((err as Error).message.startsWith('[FAIL]')) throw err
  fail(`Could not query rows: ${err}`)
}

// Test prepared statement reuse and parameter binding
try {
  const selectByEmail = db!.prepare('SELECT name, score FROM users WHERE email = ?')
  const alice = selectByEmail.get('alice@example.com') as { name: string; score: number } | undefined

  if (!alice) {
    fail(`Could not find alice@example.com`)
  }
  if (alice!.name !== 'Alice' || alice!.score !== 9.5) {
    fail(`alice data mismatch: ${JSON.stringify(alice)}`)
  }
  pass(`Prepared statement reuse and parameter binding work correctly`)
} catch (err) {
  if ((err as Error).message.startsWith('[FAIL]')) throw err
  fail(`Prepared statement test failed: ${err}`)
}

// Test aggregate query
try {
  const avg = db!.prepare('SELECT AVG(score) as avg_score FROM users').get() as { avg_score: number }
  const expectedAvg = testData.reduce((s, r) => s + r.score, 0) / testData.length

  if (Math.abs(avg.avg_score - expectedAvg) > 0.0001) {
    fail(`AVG(score) mismatch: expected ${expectedAvg}, got ${avg.avg_score}`)
  }
  pass(`Aggregate query (AVG) correct: ${avg.avg_score.toFixed(3)}`)
} catch (err) {
  if ((err as Error).message.startsWith('[FAIL]')) throw err
  fail(`Aggregate query failed: ${err}`)
}

// Close
db!.close()
pass(`Database closed cleanly`)

// Native module info
const pkg = require('better-sqlite3/package.json')
pass(`better-sqlite3 version: ${pkg.version}`)

console.log(`\n[PASS] INFRA-02: better-sqlite3 validation complete (${elapsed()})`)
console.log(`Completed: ${new Date().toISOString()}\n`)
