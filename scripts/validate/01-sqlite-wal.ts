/**
 * INFRA-01: Validate SQLite WAL mode, integrity check, and -wal/-shm file creation
 *
 * Run: npx tsx scripts/validate/01-sqlite-wal.ts
 * Exit 0 = pass, Exit 1 = fail
 */

import Database from 'better-sqlite3'
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

const dbPath = process.env.DB_PATH ?? './data/test-validation.db'

console.log(`\n=== INFRA-01: SQLite WAL Validation ===`)
console.log(`DB path: ${dbPath}`)
console.log(`Started: ${new Date().toISOString()}\n`)

// Ensure the data directory exists
try {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  pass(`Data directory exists or created: ${path.dirname(dbPath)}`)
} catch (err) {
  fail(`Could not create data directory: ${err}`)
}

// Open the database
let db: InstanceType<typeof Database>
try {
  db = new Database(dbPath)
  pass(`Database opened: ${dbPath}`)
} catch (err) {
  fail(`Could not open database: ${err}`)
  process.exit(1)
}

// Enable WAL mode
try {
  db!.pragma('journal_mode = WAL')
  const journalMode = db!.pragma('journal_mode', { simple: true })
  if (journalMode !== 'wal') {
    fail(`Expected WAL mode, got: ${journalMode}`)
  }
  pass(`WAL mode enabled (journal_mode = ${journalMode})`)
} catch (err) {
  fail(`Could not set WAL mode: ${err}`)
}

// Enable foreign keys and busy timeout
try {
  db!.pragma('foreign_keys = ON')
  db!.pragma('busy_timeout = 5000')
  pass(`PRAGMA foreign_keys = ON, busy_timeout = 5000`)
} catch (err) {
  fail(`Could not set pragmas: ${err}`)
}

// Run integrity check
try {
  const integrity = db!.pragma('integrity_check', { simple: true })
  if (integrity !== 'ok') {
    fail(`Integrity check failed: ${integrity}`)
  }
  pass(`Integrity check passed (result: ${integrity})`)
} catch (err) {
  fail(`Could not run integrity check: ${err}`)
}

// Create a test table and insert a row to trigger WAL file creation
try {
  db!.exec('CREATE TABLE IF NOT EXISTS test_wal (id INTEGER PRIMARY KEY, created_at TEXT)')
  db!.prepare('INSERT INTO test_wal (created_at) VALUES (?)').run(new Date().toISOString())
  pass(`Test table created and row inserted (triggers WAL file creation)`)
} catch (err) {
  fail(`Could not create/insert test data: ${err}`)
}

// Verify -wal and -shm files exist
const walPath = dbPath + '-wal'
const shmPath = dbPath + '-shm'

try {
  if (!fs.existsSync(walPath)) {
    fail(`WAL file not created at: ${walPath}`)
  }
  const walSize = fs.statSync(walPath).size
  pass(`WAL file exists: ${walPath} (${walSize} bytes)`)

  if (!fs.existsSync(shmPath)) {
    fail(`SHM file not created at: ${shmPath}`)
  }
  const shmSize = fs.statSync(shmPath).size
  pass(`SHM file exists: ${shmPath} (${shmSize} bytes)`)

  pass(`All 3 files co-located in: ${path.dirname(dbPath)}`)
} catch (err) {
  fail(`WAL/SHM file check failed: ${err}`)
}

// Clean up: close db and delete test files
try {
  db!.close()
  for (const filePath of [dbPath, walPath, shmPath]) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
  pass(`Cleanup complete (removed test db and WAL files)`)
} catch (err) {
  fail(`Cleanup failed: ${err}`)
}

console.log(`\n[PASS] INFRA-01: SQLite WAL validation complete (${elapsed()})`)
console.log(`Completed: ${new Date().toISOString()}\n`)
