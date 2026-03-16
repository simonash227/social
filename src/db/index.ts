import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'
import path from 'node:path'
import fs from 'node:fs'

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? './data'
const DB_PATH = path.join(DATA_DIR, 'app.db')

function openDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const sqlite = new Database(DB_PATH)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')
  const integrity = sqlite.pragma('integrity_check', { simple: true })
  if (integrity !== 'ok') {
    throw new Error(`SQLite integrity check failed: ${integrity}`)
  }
  return sqlite
}

// Module-level singleton
let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (!_db) {
    const sqlite = openDb()
    _db = drizzle(sqlite, { schema })
    // Run pending migrations at first connection
    migrate(_db, { migrationsFolder: path.join(process.cwd(), 'src/db/migrations') })
  }
  return _db
}
