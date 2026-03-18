# Phase 1: Scaffolding + Database + Auth - Research

**Researched:** 2026-03-16
**Domain:** Next.js 15.5, drizzle-orm/better-sqlite3, session auth, shadcn/ui v4, Cloudflare R2, circuit breaker
**Confidence:** HIGH (all critical findings verified against official docs or installed package versions)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Use drizzle-orm with better-sqlite3 driver (validated in Phase 0)
- Schema-first: define all tables upfront in `src/db/schema.ts`, even if some are empty until later phases
- Tables needed now: brands, social_accounts, feed_sources, posts, post_platforms, feed_entries, activity_log, ai_spend_log
- Use drizzle-kit for migrations (`drizzle-kit generate` + `drizzle-kit migrate`)
- DB opens at `/data/app.db` (Railway volume) or `./data/app.db` (local dev) via `RAILWAY_VOLUME_MOUNT_PATH` env var
- WAL mode + integrity check on startup (pattern validated in Phase 0)
- Single password stored as `AUTH_PASSWORD` env var
- Session via HTTP-only secure cookie with random token stored in a `sessions` table
- Middleware checks session cookie on every request, redirects to `/login` if invalid
- No registration page — just a login form
- Session expires after 30 days of inactivity
- Cron jobs initialized in a server-side module loaded on first API request (not instrumentation.ts — standalone bug confirmed in Phase 0)
- Use globalThis singleton guard pattern for cron
- Phase 1 cron jobs: DB backup (daily), AI spend reset (daily)
- `src/lib/upload-post.ts` — Upload-Post API client
- `src/lib/ai.ts` — Claude API client with AI_MODE switching
- `src/lib/r2.ts` — Cloudflare R2 client
- Each client reads from env vars, throws clear errors if missing
- Circuit breaker: tracks consecutive failures per service, pauses after N failures, auto-resets after cooldown
- Single-page brand form (create and edit use same form)
- Required fields on create: name, niche, voice/tone description
- Optional fields: target audience, goals, topics, dos/donts, example posts, platform notes, CTA text, bio template, bio link, banned hashtags
- Visual style: primary/secondary colors (color pickers), logo URL, watermark position (dropdown), watermark opacity (slider 0-100%)
- Warmup date: date picker for new accounts
- Delete brand: confirmation dialog with brand name typed to confirm
- Brand cards: grid showing name, niche, connected accounts count, color swatch preview
- "Connect Account" opens Upload-Post dashboard in new tab
- Fetch and display connected accounts from Upload-Post API
- Show: platform icon, username, connection status
- Auto-mark disconnected after 5 consecutive publish failures
- Left sidebar navigation: Home, Brands, Calendar, Activity Log, Settings
- Top bar: current brand name, AI_MODE indicator badge, system health dot
- Brand switcher dropdown in sidebar, "All Brands" at top
- Sidebar collapses to icons on mobile
- Use shadcn/ui components: Sidebar, Card, Button, Input, Select, Dialog, DropdownMenu, Badge, Avatar
- Dark mode only
- Daily DB backup: cron copies SQLite to R2 with date-stamped key, keeps last 7
- AI spend tracking: log each API call cost, sum daily, hard stop at MAX_DAILY_AI_SPEND
- Input sanitization: strip HTML tags, invisible unicode, excessive whitespace
- Circuit breaker: per-service failure counter, configurable threshold (default 5), cooldown (default 5 min)

### Claude's Discretion

- Exact drizzle schema column types and indexes
- Middleware implementation details
- Component file organization within src/
- Tailwind theme configuration
- Error page designs
- Loading state implementations

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-06 | Daily SQLite database backup to Cloudflare R2 | R2 uses @aws-sdk/client-s3 v3 with S3Client endpoint `https://{ACCOUNT_ID}.r2.cloudflarestorage.com`; PutObjectCommand for upload; node-cron schedule; keep-7 logic is a simple ListObjectsV2 + DeleteObject pattern |
| INFRA-07 | Circuit breaker pauses API calls after N consecutive failures and logs alert | Custom class with 3 states (CLOSED/OPEN/HALF_OPEN); per-service instance via Map; no library needed for this simple use case |
| INFRA-08 | Daily AI spend tracking with MAX_DAILY_AI_SPEND hard stop | SQLite ai_spend_log table; sum by date query; compare to env var before each call; reset cron job at midnight |
| INFRA-09 | Input sanitization utility strips HTML/invisible text from feed content | Pure TypeScript regex replacements; strip HTML tags, invisible Unicode (\u200b, \uFEFF etc.), normalize whitespace |
| AUTH-01 | User can log in with a password (AUTH_PASSWORD env var + session cookie) | Server Action handles form submit; bcryptjs compare (not bcrypt — no native module issues); create session row in SQLite; set httpOnly cookie; `(await cookies()).set()` is the Next.js 15 pattern |
| AUTH-02 | Unauthenticated requests are redirected to login page | middleware.ts with `export const config = { runtime: 'nodejs' }` (stable in Next.js 15.5.12); reads session cookie from request; validates token against sessions table using better-sqlite3; redirects to /login if invalid |
| AUTH-03 | User session persists across browser refresh | Session stored in SQLite sessions table; cookie has 30-day maxAge; middleware refreshes expiry on each valid request |
| BRAND-01 | User can create a brand with name, niche, voice/tone, target audience, goals | drizzle-orm insert into brands table; Server Action with form validation; redirect to brand detail on success |
| BRAND-02 | User can edit brand profile: topics, dos/donts, example posts, platform notes | Same brand form component with pre-populated values; drizzle update; text({ mode: 'json' }) for array fields |
| BRAND-03 | User can configure brand visual style: colors, logo URL, watermark position/opacity | Brand form visual style section; color stored as text (#hex); watermark position as text enum; opacity as integer (0-100) |
| BRAND-04 | User can set brand CTA text, bio templates, bio link, banned hashtags | Brand form fields; banned_hashtags as JSON text column |
| BRAND-05 | User can set warmup date for new brand accounts | Date picker; warmup_date as text ISO string in brands table |
| BRAND-06 | User can delete a brand (with confirmation) | Dialog component with typed-name confirmation; Server Action deletes brand and cascades to social_accounts |
| ACCT-01 | User can connect social accounts to a brand via Upload-Post | "Connect Account" button opens `https://app.upload-post.com` in new tab; no OAuth flow in our app |
| ACCT-02 | User can view connected accounts with platform, username, and status | Fetch `GET /uploadposts/users` from Upload-Post API; returns profiles array with username, connected_platforms, status |
| ACCT-03 | System auto-marks accounts as disconnected after persistent publish failures | failure_count tracked in social_accounts table; cron or post-publish check: if failure_count >= 5, set status='disconnected' |
| DASH-04 | Dashboard shell: sidebar, brand switcher, AI_MODE indicator, system health badge | shadcn/ui Sidebar component; next-themes with defaultTheme="dark" and enableSystem={false}; AI_MODE from env var rendered server-side |
</phase_requirements>

---

## Summary

Phase 1 builds all foundational infrastructure that every subsequent phase depends on. The good news is that most of the technology stack is already validated (Next.js 15.5.12 is installed, better-sqlite3 v12.8.0 is installed, Dockerfile is proven) and the key Phase 0 patterns are reusable.

The three most nuanced areas requiring careful implementation are: (1) **Auth middleware** — Next.js 15.5 introduced stable Node.js runtime support for middleware via `export const config = { runtime: 'nodejs' }`, which means better-sqlite3 can be used directly in `middleware.ts` for session token validation against the database, eliminating any need for stateless JWT or Edge-compatible workarounds; (2) **shadcn/ui initialization** — the project uses Tailwind v4 (already in package.json), and the shadcn CLI must be run for an existing project via `npx shadcn@latest init` before adding components; (3) **drizzle-kit configuration** — the `drizzle.config.ts` must point at the local dev DB path (`./data/app.db`) and the runtime `migrate()` function handles startup schema application.

**Primary recommendation:** Initialize shadcn/ui first (one-time setup), then implement DB schema + WAL init + programmatic migrations, then auth (login form + middleware), then the dashboard shell, then brand CRUD, then API clients and cron infrastructure. This ordering ensures each layer is testable before the next is built.

---

## Standard Stack

### Core (already installed in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | ^15.0.0 (15.5.12) | App framework | Project foundation; App Router + Server Actions for auth |
| drizzle-orm | ^0.30.0 | Type-safe ORM | Project decision; validated in Phase 0 |
| better-sqlite3 | ^12.8.0 | SQLite driver | Validated in Phase 0; synchronous API suits single-process app |
| node-cron | ^3.0.3 | Cron scheduling | Validated in Phase 0; in Next.js 15 serverExternalPackages |

### New Installs for Phase 1

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-kit | latest | Migration generation and CLI | Required for `drizzle-kit generate` and schema management |
| bcryptjs | ^2.4.3 | Password hashing | Pure JS — no native module issues in Next.js bundler; bcrypt (C++) has known compatibility problems with Next.js server actions and middleware |
| @types/bcryptjs | ^2.4.x | TypeScript types for bcryptjs | Type safety |
| @aws-sdk/client-s3 | ^3.x | Cloudflare R2 client | Official AWS SDK v3 is supported by R2's S3-compatible API |
| next-themes | ^0.x | Dark mode provider | shadcn/ui standard approach; `defaultTheme="dark"` + `enableSystem={false}` for dark-only |

### shadcn/ui Components to Install

Run after `npx shadcn@latest init`:

```bash
npx shadcn@latest add sidebar card button input select dialog dropdown-menu badge avatar
```

Also install the color picker component (shadcn does not have one built-in — use `<input type="color">` HTML element directly, styled with Tailwind).

### Installation

```bash
npm install drizzle-kit bcryptjs @types/bcryptjs @aws-sdk/client-s3 next-themes
npx shadcn@latest init
npx shadcn@latest add sidebar card button input select dialog dropdown-menu badge avatar
```

**Note:** On React 19 + npm, add `--legacy-peer-deps` if peer dep conflicts appear during shadcn add.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bcryptjs | bcrypt | bcrypt is faster but requires native C++ bindings — causes compilation issues in Next.js server action bundling; bcryptjs pure JS is always compatible |
| @aws-sdk/client-s3 | node-fetch + Cloudflare R2 HTTP API | AWS SDK handles request signing, retries; hand-rolling request signing for S3 is complex and error-prone |
| custom session table | iron-session or jose JWT | Session table approach lets us query active sessions, invalidate all sessions, track login activity — more control for a personal tool |
| next-themes | CSS-only dark mode | next-themes with shadcn/ui is the documented standard; prevents hydration mismatches |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx          # Login form page
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Dashboard shell with sidebar
│   │   ├── page.tsx              # Home / cross-brand overview
│   │   ├── brands/
│   │   │   ├── page.tsx          # Brand grid
│   │   │   ├── new/page.tsx      # Create brand form
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Brand detail + accounts
│   │   │       └── edit/page.tsx # Edit brand form
│   │   └── settings/page.tsx     # Settings page
│   └── api/
│       ├── health/route.ts       # Existing — keep
│       ├── auth/
│       │   ├── login/route.ts    # POST — validate password, create session
│       │   └── logout/route.ts   # POST — delete session cookie
│       └── brands/
│           └── route.ts          # GET list, POST create
├── components/
│   ├── ui/                       # shadcn/ui generated components
│   ├── app-sidebar.tsx           # Sidebar with nav + brand switcher
│   ├── top-bar.tsx               # AI_MODE badge + health dot
│   ├── brand-form.tsx            # Shared create/edit form
│   ├── brand-card.tsx            # Card for brand grid
│   └── theme-provider.tsx        # next-themes wrapper
├── db/
│   ├── index.ts                  # DB singleton (opens connection, runs migrations)
│   ├── schema.ts                 # All table definitions
│   └── migrations/               # Generated by drizzle-kit (output dir)
├── lib/
│   ├── auth.ts                   # createSession, deleteSession, verifySession
│   ├── circuit-breaker.ts        # CircuitBreaker class
│   ├── upload-post.ts            # Upload-Post API client
│   ├── ai.ts                     # Claude API client
│   ├── r2.ts                     # Cloudflare R2 client
│   └── sanitize.ts               # Input sanitization utility
└── middleware.ts                  # Session cookie check, redirect to /login
```

### Pattern 1: Database Singleton + WAL + Programmatic Migration

**What:** Open the SQLite connection once per process, enable WAL and pragmas, then run drizzle migrations from the generated `src/db/migrations/` folder at startup.
**When to use:** In `src/db/index.ts` — imported by every API route that needs DB access.

```typescript
// Source: https://orm.drizzle.team/docs/migrations + Phase 0 findings
// src/db/index.ts
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
```

### Pattern 2: Auth Middleware with Node.js Runtime (Next.js 15.5+)

**What:** middleware.ts reads the session token from the cookie, queries the sessions table in SQLite directly, and redirects to /login if no valid session exists.
**When to use:** `middleware.ts` in project root — runs on every request matched by config.

**CRITICAL:** `export const config = { runtime: 'nodejs' }` is required to use better-sqlite3 in middleware. This is STABLE as of Next.js 15.5.0 (project is on 15.5.12).

```typescript
// Source: https://nextjs.org/blog/next-15-5#nodejs-middleware-stable
// middleware.ts (project root, same level as next.config.ts)
import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/db'
import { sessions } from '@/db/schema'
import { eq, and, gt } from 'drizzle-orm'

export const config = {
  runtime: 'nodejs', // Stable in Next.js 15.5 — enables better-sqlite3
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ],
}

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const db = getDb()
  const session = db.select().from(sessions)
    .where(and(
      eq(sessions.token, token),
      gt(sessions.expiresAt, new Date().toISOString())
    ))
    .get()

  if (!session) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('session')
    return response
  }

  return NextResponse.next()
}
```

### Pattern 3: Session Creation with bcryptjs + Async cookies()

**What:** Login Server Action validates the password using bcryptjs, inserts a session row, and sets an httpOnly cookie.
**When to use:** `POST /api/auth/login` route or a Server Action.

```typescript
// Source: https://nextjs.org/docs/app/building-your-application/authentication
// src/lib/auth.ts
import 'server-only'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { getDb } from '@/db'
import { sessions } from '@/db/schema'
import { eq } from 'drizzle-orm'

const SESSION_DAYS = 30

export async function createSession(): Promise<void> {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  const db = getDb()
  db.insert(sessions).values({
    token,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  }).run()

  // CRITICAL: cookies() is async in Next.js 15
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  })
}

export async function validatePassword(input: string): Promise<boolean> {
  const stored = process.env.AUTH_PASSWORD
  if (!stored) throw new Error('AUTH_PASSWORD env var not set')

  // If stored starts with $2b, it's a bcrypt hash; otherwise compare plaintext
  if (stored.startsWith('$2')) {
    return bcrypt.compare(input, stored)
  }
  return input === stored
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (token) {
    const db = getDb()
    db.delete(sessions).where(eq(sessions.token, token)).run()
  }
  cookieStore.delete('session')
}
```

### Pattern 4: Drizzle Schema Definition (SQLite column types)

**What:** All tables defined in one file using drizzle-orm sqlite-core types.
**When to use:** `src/db/schema.ts` — source of truth for all table definitions.

```typescript
// Source: https://orm.drizzle.team/docs/column-types/sqlite
import {
  integer,
  text,
  sqliteTable,
} from 'drizzle-orm/sqlite-core'

// Recommended patterns:
// - integer().primaryKey({ autoIncrement: true }) for IDs
// - text().notNull() for required strings
// - integer({ mode: 'timestamp_ms' }) for timestamps stored as epoch ms
// - text({ mode: 'json' }).$type<string[]>() for JSON arrays
// - text({ enum: ['a','b','c'] }) for constrained string values
// - .$defaultFn(() => new Date().toISOString()) for created_at as ISO string

export const brands = sqliteTable('brands', {
  id:          integer().primaryKey({ autoIncrement: true }),
  name:        text().notNull(),
  niche:       text().notNull(),
  voiceTone:   text('voice_tone').notNull(),
  // ... all optional fields as nullable text
  topics:      text({ mode: 'json' }).$type<string[]>(),
  bannedHashtags: text('banned_hashtags', { mode: 'json' }).$type<string[]>(),
  primaryColor:  text('primary_color'),
  secondaryColor: text('secondary_color'),
  watermarkPosition: text('watermark_position', {
    enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right']
  }),
  watermarkOpacity: integer('watermark_opacity'),
  warmupDate:  text('warmup_date'),
  createdAt:   text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt:   text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// Sessions table for auth
export const sessions = sqliteTable('sessions', {
  id:        integer().primaryKey({ autoIncrement: true }),
  token:     text().notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})
```

### Pattern 5: Circuit Breaker Class

**What:** Per-service state machine that counts failures and opens the circuit after N consecutive failures, allowing calls again after a cooldown period.
**When to use:** Wrap `upload-post.ts`, `ai.ts` API calls.

```typescript
// src/lib/circuit-breaker.ts
type State = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreakerOptions {
  threshold?: number    // failures before OPEN (default: 5)
  cooldown?: number     // ms before trying again (default: 300_000 = 5 min)
}

export class CircuitBreaker {
  private state: State = 'CLOSED'
  private failures = 0
  private openedAt: number | null = null

  constructor(
    private readonly service: string,
    private readonly opts: CircuitBreakerOptions = {}
  ) {}

  private get threshold() { return this.opts.threshold ?? 5 }
  private get cooldown() { return this.opts.cooldown ?? 300_000 }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - (this.openedAt ?? 0)
      if (elapsed < this.cooldown) {
        throw new Error(`[circuit-breaker] ${this.service} is OPEN (${Math.round((this.cooldown - elapsed) / 1000)}s remaining)`)
      }
      this.state = 'HALF_OPEN'
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure()
      throw err
    }
  }

  private onSuccess() {
    this.failures = 0
    this.openedAt = null
    this.state = 'CLOSED'
  }

  private onFailure() {
    this.failures++
    if (this.failures >= this.threshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN'
      this.openedAt = Date.now()
      console.error(`[circuit-breaker] ${this.service} circuit OPENED after ${this.failures} failures`)
    }
  }
}

// Singleton registry — one breaker per service
const breakers = new Map<string, CircuitBreaker>()

export function getBreaker(service: string, opts?: CircuitBreakerOptions): CircuitBreaker {
  if (!breakers.has(service)) {
    breakers.set(service, new CircuitBreaker(service, opts))
  }
  return breakers.get(service)!
}
```

### Pattern 6: Cloudflare R2 Client

**What:** AWS SDK v3 S3Client configured for R2's S3-compatible endpoint.
**When to use:** `src/lib/r2.ts` — imported by DB backup cron and future image storage.

```typescript
// Source: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'
import fs from 'node:fs'

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2 credentials not set (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)')
  }

  return new S3Client({
    region: 'auto',  // Required by SDK, ignored by R2
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export async function uploadToR2(bucket: string, key: string, body: Buffer | string): Promise<void> {
  const client = getR2Client()
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
  }))
}
```

### Pattern 7: Upload-Post API Client

**What:** Typed fetch wrapper for the Upload-Post API.
**When to use:** `src/lib/upload-post.ts` — for listing accounts and later publishing.

```typescript
// Source: https://docs.upload-post.com/api/reference + openapi.json
// Base URL: https://api.upload-post.com/api
// Auth header: Authorization: Apikey {key}
// Key endpoints discovered:
//   GET /uploadposts/users         — list all profiles (returns { profiles: [], limit, plan })
//   GET /uploadposts/users/{username} — single profile
//   GET /uploadposts/me            — verify API key + account info
//   POST /upload_text              — publish text post (returns { request_id })
//   POST /upload_photos            — publish image post

interface UploadPostProfile {
  username: string
  connected_platforms: string[]
  status: string
  created_at: string
}

export async function listProfiles(): Promise<UploadPostProfile[]> {
  const apiKey = process.env.UPLOAD_POST_API_KEY
  if (!apiKey) throw new Error('UPLOAD_POST_API_KEY not set')

  const res = await fetch('https://api.upload-post.com/api/uploadposts/users', {
    headers: { 'Authorization': `Apikey ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Upload-Post API error: ${res.status}`)
  const data = await res.json()
  return data.profiles ?? []
}
```

### Pattern 8: Cron Singleton via API Route (Phase 0 confirmed pattern)

**What:** Cron jobs initialized on first API request using globalThis singleton guard — NOT instrumentation.ts (confirmed broken in standalone mode).
**When to use:** Add cron init call at the top of the health API route, or create a dedicated `src/lib/cron.ts` that is imported by any API route.

```typescript
// src/lib/cron.ts — called from src/app/api/health/route.ts
import cron from 'node-cron'

export function initCron() {
  if ((globalThis as any).__cronRegistered) return
  ;(globalThis as any).__cronRegistered = true

  // Daily DB backup at 3 AM
  cron.schedule('0 3 * * *', async () => {
    const { runDbBackup } = await import('./r2')
    await runDbBackup()
  })

  // AI spend reset at midnight
  cron.schedule('0 0 * * *', async () => {
    const { resetDailyAiSpend } = await import('./ai')
    await resetDailyAiSpend()
  })

  console.log('[cron] Phase 1 jobs registered')
}
```

### Pattern 9: drizzle-kit Configuration

```typescript
// drizzle.config.ts (project root)
import { defineConfig } from 'drizzle-kit'
import path from 'node:path'

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? './data'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.join(DATA_DIR, 'app.db'),
  },
})
```

Migration workflow:
1. Edit schema in `src/db/schema.ts`
2. Run `npx drizzle-kit generate` — creates SQL migration files in `src/db/migrations/`
3. `migrate()` in `src/db/index.ts` auto-applies migrations at server startup

### Anti-Patterns to Avoid

- **Using `bcrypt` (native C++) instead of `bcryptjs`:** bcrypt requires native compilation and has documented incompatibilities with Next.js server action bundling. bcryptjs is pure JS and works everywhere.
- **Calling `cookies()` synchronously:** In Next.js 15, `cookies()` returns a Promise. Always `await cookies()` before calling `.get()` / `.set()`.
- **Using instrumentation.ts for cron:** Confirmed broken in standalone mode (Phase 0). Use globalThis singleton in API route instead.
- **Running DB migrations in the Dockerfile build step:** Railway volumes are NOT mounted at build time. Migrations must run at server startup via `migrate()`.
- **Omitting `export const config = { runtime: 'nodejs' }` from middleware:** Without this, middleware runs in Edge runtime which cannot load better-sqlite3. This runtime config is stable in Next.js 15.5.
- **Using `blob({ mode: 'json' })` for JSON arrays in SQLite:** SQLite JSON functions throw errors on BLOB columns. Use `text({ mode: 'json' })` instead.
- **Skipping `--legacy-peer-deps` during shadcn install on React 19 + npm:** shadcn components may have peer dep version conflicts; add the flag if `npx shadcn@latest add` fails.
- **@aws-sdk/client-s3 v3.729.0+ with R2:** Community-reported breaking change: checksum behavior changed in that version. Pin to a known-good version or add `requestChecksumCalculation: 'WHEN_REQUIRED'` to the S3Client config if on a newer version.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash function | bcryptjs | bcrypt has adaptive cost factor, salt generation, timing-safe compare — hand-rolling is insecure |
| SQLite migrations | Custom migration runner | drizzle-kit generate + migrate() | Handles ordering, idempotency, and tracking applied migrations |
| S3 request signing | Manual HMAC-SHA256 signing | @aws-sdk/client-s3 | Request signing for S3 is complex (canonical headers, URI encoding, date handling) |
| Component library | Custom UI components from scratch | shadcn/ui | Accessible, keyboard-navigable components; Sidebar has collapse logic already built |
| Dark mode | CSS class toggling | next-themes | Handles SSR/hydration mismatch, localStorage persistence, system preference detection |
| Session token generation | Math.random() | `crypto.randomBytes(32).toString('hex')` | Math.random() is not cryptographically secure; Node.js crypto.randomBytes is |
| Cron scheduling | setInterval loops | node-cron | Cron expression parsing, missed-run handling, process lifecycle — validated in Phase 0 |

**Key insight:** The auth system is intentionally simple (single user, single password, session table) but must NOT cut corners on cryptographic functions — use bcryptjs and crypto.randomBytes even for a personal tool.

---

## Common Pitfalls

### Pitfall 1: cookies() Is Async in Next.js 15

**What goes wrong:** Calling `cookies().get('session')` without await throws a type error or silently returns undefined, breaking session reads.
**Why it happens:** Next.js 15 changed `cookies()` from synchronous to async. This is a breaking change vs Next.js 14.
**How to avoid:** Always `const cookieStore = await cookies()` then `cookieStore.get(name)`.
**Warning signs:** TypeScript shows "Property 'get' does not exist on type 'Promise'" or session always appears missing.

### Pitfall 2: Middleware Missing Node.js Runtime Config

**What goes wrong:** `middleware.ts` imports `getDb()` which imports better-sqlite3, causing "Module not found" or "crypto is not defined" errors at runtime.
**Why it happens:** Middleware defaults to Edge runtime in Next.js 15, which cannot load native Node.js modules.
**How to avoid:** Add `export const config = { runtime: 'nodejs' }` to middleware.ts. This is stable as of Next.js 15.5.0.
**Warning signs:** Runtime error "better-sqlite3 is not available in Edge runtime" or similar.

### Pitfall 3: drizzle-kit Cannot Read DB at Build Time

**What goes wrong:** Running `npx drizzle-kit studio` or `drizzle-kit migrate` fails because `RAILWAY_VOLUME_MOUNT_PATH` is not set in local dev.
**Why it happens:** The drizzle.config.ts reads the env var to construct the DB path, but local dev doesn't set it.
**How to avoid:** drizzle.config.ts uses `process.env.RAILWAY_VOLUME_MOUNT_PATH ?? './data'` so local dev falls back to `./data/app.db`. Ensure `./data/` directory exists (create it or let `openDb()` create it via `mkdirSync`).
**Warning signs:** `Cannot open database at /data/app.db` when running drizzle-kit CLI locally.

### Pitfall 4: shadcn/ui Dark Mode Hydration Mismatch

**What goes wrong:** Page flickers from light to dark on first load, or server HTML shows light mode while client shows dark.
**Why it happens:** CSS class `dark` applied by next-themes only on the client, causing mismatch with server-rendered HTML.
**How to avoid:** Add `suppressHydrationWarning` to `<html>` tag in root layout. Set `defaultTheme="dark"` and `enableSystem={false}` on ThemeProvider. shadcn docs explicitly document this approach.
**Warning signs:** Console warning "Warning: Prop `className` did not match" or visible flash on page load.

### Pitfall 5: R2 SDK Checksum Breaking Change

**What goes wrong:** `PutObjectCommand` or `UploadPart` fails with a 400 error from R2 on @aws-sdk/client-s3 v3.729.0+.
**Why it happens:** AWS SDK v3.729.0 added mandatory checksum algorithms for these commands; R2's S3 compatibility does not handle the new checksum headers correctly.
**How to avoid:** Add `requestChecksumCalculation: 'WHEN_REQUIRED'` to the S3Client constructor options, or pin @aws-sdk/client-s3 to a version before 3.729.0.
**Warning signs:** R2 returns 400 Bad Request on PutObject despite valid credentials and bucket name.

### Pitfall 6: Brand Form JSON Array Fields

**What goes wrong:** Arrays (topics, bannedHashtags) are stored and retrieved incorrectly — either as [object Object] or causing drizzle type errors.
**Why it happens:** SQLite has no native array type; must use `text({ mode: 'json' })` and remember to JSON.parse on read.
**How to avoid:** Use `text({ mode: 'json' }).$type<string[]>()` in schema — drizzle automatically serializes/deserializes. Never use `blob({ mode: 'json' })` for arrays (SQLite JSON functions break on BLOB).
**Warning signs:** Query returns stringified JSON instead of parsed array, or TypeScript complains about type.

---

## Code Examples

### Session Token Validation in Middleware (Full Pattern)

```typescript
// Source: https://nextjs.org/blog/next-15-5#nodejs-middleware-stable
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Import getDb lazily to avoid circular issues
  // better-sqlite3 is synchronous — no await needed for DB call
  const { getDb } = require('@/db')
  const { sessions } = require('@/db/schema')

  const db = getDb()
  const now = new Date().toISOString()
  const session = db.select().from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
    .get()

  if (!session) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.delete('session')
    return response
  }

  return NextResponse.next()
}
```

### Drizzle Full Schema Outline

```typescript
// Source: https://orm.drizzle.team/docs/column-types/sqlite
// src/db/schema.ts — all tables defined upfront
import { integer, text, sqliteTable } from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable('sessions', {
  id:        integer().primaryKey({ autoIncrement: true }),
  token:     text().notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const brands = sqliteTable('brands', {
  id:                 integer().primaryKey({ autoIncrement: true }),
  name:               text().notNull(),
  niche:              text().notNull(),
  voiceTone:          text('voice_tone').notNull(),
  targetAudience:     text('target_audience'),
  goals:              text(),
  topics:             text({ mode: 'json' }).$type<string[]>(),
  dosList:            text('dos_list', { mode: 'json' }).$type<string[]>(),
  dontsList:          text('donts_list', { mode: 'json' }).$type<string[]>(),
  examplePosts:       text('example_posts', { mode: 'json' }).$type<string[]>(),
  platformNotes:      text('platform_notes', { mode: 'json' }).$type<Record<string, string>>(),
  ctaText:            text('cta_text'),
  bioTemplate:        text('bio_template'),
  bioLink:            text('bio_link'),
  bannedHashtags:     text('banned_hashtags', { mode: 'json' }).$type<string[]>(),
  primaryColor:       text('primary_color'),
  secondaryColor:     text('secondary_color'),
  logoUrl:            text('logo_url'),
  watermarkPosition:  text('watermark_position', { enum: ['top-left','top-right','bottom-left','bottom-right'] }),
  watermarkOpacity:   integer('watermark_opacity'),
  warmupDate:         text('warmup_date'),
  createdAt:          text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt:          text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const socialAccounts = sqliteTable('social_accounts', {
  id:           integer().primaryKey({ autoIncrement: true }),
  brandId:      integer('brand_id').notNull().references(() => brands.id),
  platform:     text().notNull(),
  username:     text().notNull(),
  status:       text({ enum: ['connected', 'disconnected'] }).notNull().default('connected'),
  failureCount: integer('failure_count').notNull().default(0),
  uploadPostUsername: text('upload_post_username'),
  createdAt:    text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// Stub tables — populated in later phases, defined now for schema completeness
export const feedSources = sqliteTable('feed_sources', {
  id:        integer().primaryKey({ autoIncrement: true }),
  brandId:   integer('brand_id').notNull().references(() => brands.id),
  url:       text().notNull(),
  type:      text({ enum: ['rss','youtube','reddit','google_news'] }).notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const posts = sqliteTable('posts', {
  id:         integer().primaryKey({ autoIncrement: true }),
  brandId:    integer('brand_id').notNull().references(() => brands.id),
  content:    text().notNull(),
  status:     text({ enum: ['draft','scheduled','published','failed'] }).notNull().default('draft'),
  requestId:  text('request_id'),   // Upload-Post request_id for analytics matching
  scheduledAt: text('scheduled_at'),
  publishedAt: text('published_at'),
  createdAt:  text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const postPlatforms = sqliteTable('post_platforms', {
  id:         integer().primaryKey({ autoIncrement: true }),
  postId:     integer('post_id').notNull().references(() => posts.id),
  platform:   text().notNull(),
  status:     text({ enum: ['pending','published','failed'] }).notNull().default('pending'),
  failureCount: integer('failure_count').notNull().default(0),
})

export const feedEntries = sqliteTable('feed_entries', {
  id:         integer().primaryKey({ autoIncrement: true }),
  feedSourceId: integer('feed_source_id').notNull().references(() => feedSources.id),
  url:        text().notNull().unique(),
  title:      text(),
  processedAt: text('processed_at'),
  createdAt:  text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const activityLog = sqliteTable('activity_log', {
  id:        integer().primaryKey({ autoIncrement: true }),
  brandId:   integer('brand_id').references(() => brands.id),
  type:      text().notNull(),
  level:     text({ enum: ['info','warn','error'] }).notNull().default('info'),
  message:   text().notNull(),
  metadata:  text({ mode: 'json' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const aiSpendLog = sqliteTable('ai_spend_log', {
  id:        integer().primaryKey({ autoIncrement: true }),
  brandId:   integer('brand_id').references(() => brands.id),
  model:     text().notNull(),
  inputTokens:  integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  costUsd:   text('cost_usd').notNull(),  // Store as text to avoid float precision issues
  date:      text().notNull(),  // YYYY-MM-DD for easy daily sum
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})
```

### shadcn Dark-Only Layout Setup

```typescript
// Source: https://ui.shadcn.com/docs/dark-mode/next
// src/app/layout.tsx
import { ThemeProvider } from '@/components/theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}   // Never follow system preference — dark only
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### Input Sanitization Utility

```typescript
// src/lib/sanitize.ts
export function sanitizeText(input: string): string {
  return input
    // Strip HTML tags
    .replace(/<[^>]*>/g, '')
    // Strip invisible Unicode characters (zero-width space, BOM, etc.)
    .replace(/[\u200B-\u200D\uFEFF\u00AD\u2028\u2029]/g, '')
    // Normalize multiple spaces/tabs to single space
    .replace(/[ \t]+/g, ' ')
    // Normalize multiple newlines to double newline max
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Edge-only middleware | Node.js runtime in middleware (`runtime: 'nodejs'`) | Next.js 15.5.0 (stable) | better-sqlite3 can now be used directly in middleware for session DB lookup |
| `cookies()` synchronous | `cookies()` async — must `await` | Next.js 15.0.0 | All server components and actions must await cookies() |
| `middleware.ts` file | `proxy.ts` file (renamed) | Next.js 16.0.0 (not yet released) | Still use `middleware.ts` in 15.x; proxy.ts is the Next.js 16 name |
| `experimental.instrumentationHook` flag | `instrumentation.ts` stable (no flag needed) | Next.js 15.0.0 | But still broken in standalone mode — confirmed in Phase 0 |
| Railpack for Railway | Dockerfile required | Phase 0 confirmed | Railpack cannot build better-sqlite3 native module; Dockerfile is the solution |
| `blob({ mode: 'json' })` for JSON in SQLite | `text({ mode: 'json' })` | Always preferred | SQLite JSON functions throw errors on BLOB columns |

**Deprecated/outdated:**
- `middleware.ts` naming: Will be renamed to `proxy.ts` in Next.js 16; keep `middleware.ts` for now (15.x is current)
- `bcrypt` (native) in Next.js: Known compatibility issues; use `bcryptjs` (pure JS)
- Nixpacks for Railway: Replaced by Railpack; but Dockerfile is required anyway for better-sqlite3

---

## Upload-Post API Quick Reference

Discovered from official OpenAPI spec:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/uploadposts/me` | GET | Validate API key + get account info |
| `/uploadposts/users` | GET | List all profiles (returns `{ profiles, limit, plan }`) |
| `/uploadposts/users/{username}` | GET | Get single profile |
| `/upload_text` | POST | Publish text post (returns `{ request_id }`) |
| `/upload_photos` | POST | Publish image post |
| `/uploadposts/post-analytics/{request_id}` | GET | Get analytics for a post |
| `/uploadposts/facebook/pages` | GET | List Facebook pages for a profile |
| `/uploadposts/linkedin/pages` | GET | List LinkedIn pages |

**Auth header:** `Authorization: Apikey {key}`
**Profile schema:** `{ username, connected_platforms: string[], status, created_at }`

---

## Open Questions

1. **Upload-Post profile `status` field values**
   - What we know: `GET /uploadposts/users` returns a `status` field per profile
   - What's unclear: Exact enum values (e.g., "active", "disconnected", "pending") — not documented in the OpenAPI spec excerpt
   - Recommendation: On first `listProfiles()` call, log the raw response to discover actual values; treat as freeform text in schema until confirmed

2. **shadcn/ui Sidebar mobile collapse behavior**
   - What we know: shadcn Sidebar component exists and supports theming
   - What's unclear: Whether the built-in Sidebar handles icon-only collapse on mobile automatically, or if custom CSS/state is needed
   - Recommendation: Install and test the Sidebar component early in implementation; if collapse behavior needs customization, it is a Claude discretion item

3. **@aws-sdk/client-s3 exact version compatibility with R2**
   - What we know: v3.729.0 has a breaking checksum change; `requestChecksumCalculation: 'WHEN_REQUIRED'` is the fix
   - What's unclear: Whether `npm install @aws-sdk/client-s3` will resolve to a version before or after 3.729.0
   - Recommendation: After install, add `requestChecksumCalculation: 'WHEN_REQUIRED'` to S3Client config proactively regardless of version

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None (standalone scripts via `tsx`, per Phase 0 pattern) |
| Config file | none — scripts run directly |
| Quick run command | `npx tsx scripts/validate/{script}.ts` |
| Full suite command | `for f in scripts/validate/*.ts; do npx tsx "$f" || exit 1; done` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-06 | DB backup uploads to R2, keeps last 7 | integration | `npx tsx scripts/validate/06-r2-backup.ts` | Wave 0 |
| INFRA-07 | Circuit breaker opens after N failures, resets after cooldown | unit | `npx tsx scripts/validate/07-circuit-breaker.ts` | Wave 0 |
| INFRA-08 | AI spend sum by date, hard stop at MAX_DAILY_AI_SPEND | unit | `npx tsx scripts/validate/08-ai-spend.ts` | Wave 0 |
| INFRA-09 | Sanitize strips HTML, invisible Unicode, excess whitespace | unit | `npx tsx scripts/validate/09-sanitize.ts` | Wave 0 |
| AUTH-01 | Login with correct password creates session cookie | smoke | `curl -X POST http://localhost:3000/api/auth/login` + inspect Set-Cookie | manual |
| AUTH-02 | Unauthenticated request to /brands → redirect 307 to /login | smoke | `curl -I http://localhost:3000/brands` | manual |
| AUTH-03 | Session cookie persists after browser refresh | smoke | manual browser test | manual |
| BRAND-01 | Create brand with required fields → appears in brand list | smoke | manual browser test | manual |
| BRAND-02 | Edit brand fields → changes persisted | smoke | manual browser test | manual |
| BRAND-03 | Color pickers update brand visual style | smoke | manual browser test | manual |
| BRAND-04 | CTA/bio/hashtag fields save and display correctly | smoke | manual browser test | manual |
| BRAND-05 | Warmup date picker saves ISO date | smoke | manual browser test | manual |
| BRAND-06 | Delete brand with typed name confirmation → brand removed | smoke | manual browser test | manual |
| ACCT-01 | "Connect Account" opens upload-post.com in new tab | smoke | manual browser test | manual |
| ACCT-02 | Connected accounts list shows platform, username, status | smoke | `npx tsx scripts/validate/10-upload-post-accounts.ts` | Wave 0 |
| ACCT-03 | Account auto-marked disconnected after 5 failures | unit | `npx tsx scripts/validate/11-account-disconnect.ts` | Wave 0 |
| DASH-04 | Dashboard shell renders with sidebar and AI_MODE badge | smoke | manual browser test | manual |

### Sampling Rate

- **Per task commit:** Run the specific validation script for that task (if automated)
- **Per wave merge:** `for f in scripts/validate/*.ts; do npx tsx "$f" || exit 1; done`
- **Phase gate:** All automated scripts exit 0 + browser smoke tests passing before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `scripts/validate/06-r2-backup.ts` — covers INFRA-06 (requires R2 env vars)
- [ ] `scripts/validate/07-circuit-breaker.ts` — covers INFRA-07 (no external deps)
- [ ] `scripts/validate/08-ai-spend.ts` — covers INFRA-08 (SQLite + env var check)
- [ ] `scripts/validate/09-sanitize.ts` — covers INFRA-09 (pure unit test)
- [ ] `scripts/validate/10-upload-post-accounts.ts` — covers ACCT-02 (requires UPLOAD_POST_API_KEY)
- [ ] `scripts/validate/11-account-disconnect.ts` — covers ACCT-03 (SQLite + logic test)
- [ ] `.env.local` additions: `AUTH_PASSWORD`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MAX_DAILY_AI_SPEND`

---

## Sources

### Primary (HIGH confidence)

- Next.js 15.5 release blog (https://nextjs.org/blog/next-15-5) — confirmed Node.js runtime in middleware is STABLE, exact config syntax, published August 2025
- Next.js authentication docs (https://nextjs.org/docs/app/building-your-application/authentication) — `(await cookies()).set()` pattern, database sessions, middleware auth pattern (lastUpdated 2026-02-27)
- Next.js middleware/proxy docs (https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — confirmed middleware defaults to Node.js runtime, `runtime: 'nodejs'` config, stable in v15.5.0 (version table verified)
- drizzle-orm SQLite get-started docs (https://orm.drizzle.team/docs/get-started/sqlite-new) — schema, drizzle.config.ts, migration commands
- drizzle-orm migrations docs (https://orm.drizzle.team/docs/migrations) — `migrate()` import from `drizzle-orm/better-sqlite3/migrator`
- drizzle-orm SQLite column types (https://orm.drizzle.team/docs/column-types/sqlite) — integer modes, text modes, JSON recommendation
- Cloudflare R2 AWS SDK v3 example (https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) — S3Client config, endpoint format, env var names
- Upload-Post OpenAPI spec (https://docs.upload-post.com/openapi.json) — endpoint list, response schema for /uploadposts/users
- shadcn/ui Tailwind v4 docs (https://ui.shadcn.com/docs/tailwind-v4) — confirmed all listed components available
- shadcn/ui dark mode docs (https://ui.shadcn.com/docs/dark-mode/next) — next-themes setup, `suppressHydrationWarning` requirement
- Installed Next.js version: 15.5.12 (verified via package.json)

### Secondary (MEDIUM confidence)

- WebSearch: bcrypt vs bcryptjs in Next.js — multiple community sources confirm bcryptjs is the standard choice for Next.js; bcrypt (native) has known server action bundling issues
- WebSearch + official R2 community: @aws-sdk/client-s3 v3.729.0 checksum breaking change confirmed in Cloudflare community forum

### Tertiary (LOW confidence)

- Upload-Post profile `status` field values — not explicitly documented; needs empirical discovery on first API call

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against official docs and installed versions
- Auth pattern: HIGH — Next.js 15.5 Node.js middleware is stable; cookies() async confirmed in official docs
- Drizzle schema: HIGH — official column type docs; SQLite JSON text mode confirmed
- shadcn/ui setup: HIGH — official docs; all required components confirmed available
- R2 client: MEDIUM-HIGH — SDK v3 pattern confirmed; checksum issue is a risk to mitigate proactively
- Upload-Post API: MEDIUM — base URL and endpoint list confirmed; profile status field values unconfirmed
- Architecture patterns: HIGH — derived from Phase 0 validated findings + official docs

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable tech, 30 days)
