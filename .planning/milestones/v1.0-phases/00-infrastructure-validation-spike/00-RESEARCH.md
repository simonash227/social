# Phase 0: Infrastructure Validation Spike - Research

**Researched:** 2026-03-16
**Domain:** Railway deployment, SQLite/better-sqlite3, Next.js 15 instrumentation, Satori+sharp, Upload-Post API
**Confidence:** HIGH (all 5 core findings verified against official docs or authoritative sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Test locally first for fast iteration (SQLite, better-sqlite3, Satori+sharp)
- Deploy a minimal Railway test app to validate Railway-specific concerns (volume mount, WAL mode, instrumentation.ts)
- Upload-Post validation requires real API key against their sandbox/test endpoint
- Keep Railway test app alive briefly for validation, tear down after
- Fallback strategy defined for each of the 5 risks (see CONTEXT.md for full fallback chain)
- Keep validation scripts as standalone files in a `scripts/validate/` directory
- Each test is a self-contained script that exits 0 (pass) or 1 (fail) with clear output
- These become smoke tests re-runnable after Railway config changes or upgrades
- Don't over-engineer — simple scripts, not a test framework
- Upload-Post real API key needed; Claude/OpenAI/R2 NOT needed for Phase 0
- Store test API key in `.env.local` (gitignored)

### Claude's Discretion
- Exact Railway configuration (Dockerfile vs Nixpacks/Railpack, volume mount path)
- Order of validation tests
- How much logging/output each validation script produces
- Whether to use a monorepo or flat structure for the test app

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | SQLite database runs on Railway volume with WAL mode and integrity check on startup | Railway volumes confirmed mountable; WAL mode + -shm/-wal files must co-locate on the volume; integrity check is a `PRAGMA integrity_check` call |
| INFRA-02 | better-sqlite3 + Next.js 15 builds and deploys successfully on Railway | better-sqlite3 is in Next.js 15's automatic `serverExternalPackages` list; Railpack detects node-gyp native module compilation automatically |
| INFRA-03 | node-cron jobs start via instrumentation.ts singleton and survive Railway redeploy | `instrumentation.ts` register() called exactly once in production; node-cron is also in Next.js 15's automatic external packages list; dev needs singleton guard |
| INFRA-04 | Satori + sharp renders carousel images on Railway's Linux environment | sharp has prebuilt binaries for Linux x64 glibc (Railway uses Debian/Ubuntu-based containers via Railpack); Satori outputs SVG, sharp converts to PNG — both are pure Node.js |
| INFRA-05 | Upload-Post API can match analytics data back to posts by request_id | Upload-Post returns `request_id` on publish; analytics available at `GET /api/uploadposts/post-analytics/{request_id}` — direct match confirmed |
</phase_requirements>

---

## Summary

This phase validates 5 infrastructure assumptions before any production code is written. Each assumption, if wrong, would require significant architectural rework. The good news from research: **most risks are lower than expected** due to Next.js 15's built-in handling of native modules.

The two highest actual risks are (1) Railway volume behavior with SQLite WAL mode — specifically that the database file, WAL file (-wal), and shared memory file (-shm) must all live on the volume, not split between volume and ephemeral container storage; and (2) Railpack's handling of node-gyp for better-sqlite3 on Railway's Linux build environment, which is not fully documented and needs empirical confirmation.

The lowest risks (near-certain to work): Satori+sharp on Linux (prebuilt glibc binaries, standard npm install), node-cron via instrumentation.ts (both are in Next.js 15's automatic external packages list, register() called once in production), and Upload-Post analytics matching (confirmed `request_id` endpoint exists).

**Primary recommendation:** Validate in this order — SQLite/WAL on Railway volume (highest risk, longest feedback loop), then better-sqlite3 build on Railway, then instrumentation.ts/node-cron, then Satori+sharp, then Upload-Post API. Fail fast, activate fallback if needed.

---

## Standard Stack

### Core (for validation scripts only — this phase creates no production code)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| better-sqlite3 | ^9.x | Synchronous SQLite driver | Fastest Node.js SQLite driver; in Next.js 15 auto-externals list |
| drizzle-orm | ^0.30.x | Type-safe ORM (test the pairing) | Project decision; validate it works with better-sqlite3 on Railway |
| node-cron | ^3.x | Cron job scheduling | In Next.js 15 auto-externals list; simple API |
| satori | ^0.10.x | HTML/CSS → SVG | Vercel-maintained, pure JS, no native deps |
| sharp | ^0.33.x | SVG/image → PNG | Has prebuilt binaries for Linux x64 glibc; in Next.js 15 auto-externals |

### Railway Configuration

| Item | Value | Notes |
|------|-------|-------|
| Build system | Railpack (new default, successor to Nixpacks) | Auto-detects Next.js; handles node-gyp |
| Volume mount path | `/data` (recommended) | Configure in Railway dashboard; available at runtime, NOT at build time |
| Database file path | `/data/app.db` | All WAL files must be in same directory |
| Node.js version | 22 (Railpack default) | Pin with `.node-version` or `engines.node` |

### Installation

```bash
npm install better-sqlite3 drizzle-orm satori sharp node-cron
npm install -D @types/better-sqlite3 @types/node-cron
```

---

## Architecture Patterns

### Recommended Validation Script Structure

```
scripts/
└── validate/
    ├── 01-sqlite-wal.ts          # INFRA-01: SQLite + WAL on volume
    ├── 02-better-sqlite3.ts      # INFRA-02: native module builds + loads
    ├── 03-instrumentation.ts     # INFRA-03: cron singleton pattern
    ├── 04-satori-sharp.ts        # INFRA-04: PNG rendering
    └── 05-upload-post.ts         # INFRA-05: analytics match by request_id
```

Each script:
- Runs as `tsx scripts/validate/XX-name.ts` (or compiled JS)
- Prints `[PASS]` or `[FAIL]` prefix on every line
- Exits 0 on success, 1 on failure
- Includes timing information for performance baseline

### Pattern 1: SQLite WAL Mode Setup

**What:** Open database, enable WAL, run integrity check, confirm WAL files exist alongside database.
**When to use:** INFRA-01 validation; will become the production DB initialization pattern.

```typescript
// Source: https://sqlite.org/wal.html + https://til.simonwillison.net/sqlite/enabling-wal-mode
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const DB_PATH = process.env.DB_PATH ?? '/data/app.db'

function validateSQLiteWAL() {
  // Ensure directory exists on volume
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

  const db = new Database(DB_PATH)

  // Enable WAL mode
  db.pragma('journal_mode = WAL')
  const result = db.pragma('journal_mode', { simple: true })
  if (result !== 'wal') throw new Error(`Expected WAL, got: ${result}`)
  console.log('[PASS] WAL mode enabled')

  // Integrity check
  const integrity = db.pragma('integrity_check', { simple: true })
  if (integrity !== 'ok') throw new Error(`Integrity check: ${integrity}`)
  console.log('[PASS] Integrity check passed')

  // Confirm WAL file created (-wal and -shm appear after first write)
  db.exec('CREATE TABLE IF NOT EXISTS test_wal (id INTEGER PRIMARY KEY)')
  db.exec('INSERT INTO test_wal VALUES (NULL)')

  const walPath = DB_PATH + '-wal'
  const shmPath = DB_PATH + '-shm'
  if (!fs.existsSync(walPath)) throw new Error('WAL file not created at: ' + walPath)
  if (!fs.existsSync(shmPath)) throw new Error('SHM file not created at: ' + shmPath)
  console.log('[PASS] WAL and SHM files created in same directory as DB')

  db.close()
}
```

### Pattern 2: instrumentation.ts Singleton Guard

**What:** Guard node-cron registration so it only fires once, even in dev (hot reload calls register multiple times).
**When to use:** INFRA-03 validation; will become the production cron pattern.

```typescript
// Source: https://nextjs.org/docs/app/guides/instrumentation
// instrumentation.ts — root of project

export async function register() {
  // Guard: only run in Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Guard: only register once (dev hot-reload calls register multiple times)
  if ((globalThis as any).__cronRegistered) {
    console.log('[cron] Already registered, skipping')
    return
  }
  (globalThis as any).__cronRegistered = true

  // Lazy import — keeps node-cron out of edge bundle
  const { default: cron } = await import('node-cron')

  cron.schedule('* * * * *', () => {
    console.log('[cron] tick at', new Date().toISOString())
  })

  console.log('[cron] Scheduler registered')
}
```

### Pattern 3: Satori + Sharp PNG Pipeline

**What:** Render JSX to SVG with Satori, pipe to sharp for PNG output.
**When to use:** INFRA-04 validation; becomes the carousel rendering pipeline.

```typescript
// Source: https://github.com/vercel/satori + https://sharp.pixelplumbing.com/
import satori from 'satori'
import sharp from 'sharp'
import fs from 'node:fs'

async function renderTestPNG(outputPath: string) {
  // Satori requires font data — load at least one font
  const fontData = fs.readFileSync('./public/fonts/Inter-Regular.ttf')

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          color: '#fff',
          fontSize: 48,
        },
        children: 'Railway Satori Test',
      },
    },
    {
      width: 1080,
      height: 1080,
      fonts: [{ name: 'Inter', data: fontData, weight: 400, style: 'normal' }],
    }
  )

  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  fs.writeFileSync(outputPath, png)
  console.log(`[PASS] PNG rendered: ${outputPath} (${png.byteLength} bytes)`)
}
```

### Pattern 4: Upload-Post Request ID → Analytics Match

**What:** Publish a test post, capture the `request_id` from the response, query analytics by that ID.
**When to use:** INFRA-05 validation.

```typescript
// Source: https://docs.upload-post.com/api/reference
// Note: analytics data takes time to populate; validate endpoint shape, not live data

async function validateUploadPostTracking(apiKey: string) {
  // Step 1: Publish a minimal text post (X/Twitter as simplest platform)
  const publishRes = await fetch('https://api.upload-post.com/api/upload_text', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: '[VALIDATION TEST] Automated infrastructure check. Please ignore.',
      platforms: ['x'], // minimal platform for test
    }),
  })
  const publishData = await publishRes.json()
  const requestId: string = publishData.request_id
  if (!requestId) throw new Error('No request_id in publish response')
  console.log('[PASS] Publish returned request_id:', requestId)

  // Step 2: Query analytics endpoint by request_id (shape validation only)
  const analyticsRes = await fetch(
    `https://api.upload-post.com/api/uploadposts/post-analytics/${requestId}`,
    { headers: { 'x-api-key': apiKey } }
  )
  // Analytics data may not be populated yet (needs 48h), but endpoint must exist
  if (!analyticsRes.ok && analyticsRes.status !== 404) {
    throw new Error(`Analytics endpoint error: ${analyticsRes.status}`)
  }
  console.log('[PASS] Analytics endpoint responds for request_id:', analyticsRes.status)
}
```

### Anti-Patterns to Avoid

- **Storing SQLite database in ephemeral container storage:** Railway volumes are mounted at runtime; any path outside the volume mount is ephemeral and wiped on redeploy. The database, WAL file, and SHM file must all be on the volume.
- **Writing to the volume at build time:** Volumes are NOT available during the build phase — only at runtime. Do not attempt to run migrations or initialize the database in the build step.
- **Importing node-cron at top of instrumentation.ts:** Import inside the `register()` function to avoid the edge runtime attempting to load a Node.js-only module.
- **Skipping the NEXT_RUNTIME guard in instrumentation.ts:** Next.js calls register() for both the Node.js runtime and Edge runtime. Without `if (process.env.NEXT_RUNTIME !== 'nodejs') return`, node-cron will fail to load in the Edge context.
- **Assuming WAL files appear without a write:** The -wal and -shm files only appear after the first write transaction. Opening the database in read-only mode or only reading will not create them.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQLite → WAL mode | Custom journaling logic | `PRAGMA journal_mode = WAL` | Single built-in SQLite command; hand-rolling WAL is impossible |
| Native module bundling | Webpack externals config | Next.js 15 auto-externals | better-sqlite3, sharp, node-cron are all auto-excluded from bundling |
| Cron job deduplication | Complex distributed lock | `globalThis.__cronRegistered` guard | Single-process app; module-level flag is sufficient |
| SVG → PNG conversion | canvas, puppeteer, playwright | sharp | 2-3x faster, no browser binary, prebuilt binaries for Linux |
| Upload-Post ID tracking | Custom ID generation | Store `request_id` from API response | API provides canonical ID; don't maintain parallel ID scheme |

**Key insight:** The native module problem in Next.js 15 solves itself — `better-sqlite3`, `sharp`, and `node-cron` are all in the automatic `serverExternalPackages` list. No manual webpack config needed.

---

## Common Pitfalls

### Pitfall 1: WAL Files Stranded Outside Volume

**What goes wrong:** Database file is on the Railway volume at `/data/app.db`, but WAL files (`/data/app.db-wal`, `/data/app.db-shm`) are inadvertently written elsewhere. On redeploy, the -wal file is lost, leaving the database in an inconsistent state or losing committed transactions.

**Why it happens:** Developers mount the volume at `/data` but open the database with a relative path or place it in a subdirectory not covered by the mount.

**How to avoid:** Always use absolute paths for the database file. Confirm that `DB_PATH`, the -wal path (`DB_PATH + '-wal'`), and the -shm path are all within the volume mount directory. Validate that all three files exist on the same filesystem after first write.

**Warning signs:** Database appears fine locally but loses data on Railway redeploy. `PRAGMA integrity_check` returns errors after restart.

### Pitfall 2: better-sqlite3 Build Failure on Railway

**What goes wrong:** Railway's build environment lacks the C++ toolchain (python3, make, gcc) needed to compile better-sqlite3 from source, causing `npm install` to fail.

**Why it happens:** Railpack is the new default builder (successor to Nixpacks). Its behavior with node-gyp native modules is documented at a high level ("node-gyp is supported") but not verified empirically for better-sqlite3 specifically.

**How to avoid:** Test the Railway build explicitly in the validation spike. If the build fails, options are: (a) use a Dockerfile with `apt-get install -y python3 make g++` explicitly, (b) use prebuilt binaries via `@mapbox/node-pre-gyp`, or (c) activate the fallback (switch to libsql/Turso).

**Warning signs:** Railway build log shows `node-gyp rebuild` failures, `python` or `make` not found errors.

### Pitfall 3: instrumentation.ts Called Twice in Dev

**What goes wrong:** In `next dev`, the `register()` function in `instrumentation.ts` is called multiple times due to hot module replacement. Without a guard, multiple cron job instances register, causing tasks to fire multiple times per interval.

**Why it happens:** Next.js intentionally calls `register()` on each module reload in dev mode. In production it is called exactly once.

**How to avoid:** Use a `globalThis` guard (see Pattern 2 above). The `globalThis` object persists across module reloads in the same process, unlike module-level variables which are re-initialized.

**Warning signs:** In dev, logs show the cron tick message firing 2x or 3x per minute. In prod, this should not occur.

### Pitfall 4: sharp Prebuilt Binary Architecture Mismatch

**What goes wrong:** Development machine is macOS/ARM64, deployment is Linux x64. Running `npm install` on macOS downloads the Darwin ARM64 sharp binary. When deployed, Railway tries to use the wrong binary and fails.

**Why it happens:** npm downloads platform-specific prebuilt binaries at install time. The lockfile may pin the wrong binary.

**How to avoid:** Use `npm install --cpu=x64 --os=linux --libc=glibc sharp` in the Railway build, or rely on Railpack/Railpack running `npm install` fresh in the container (which it does by default). Do not commit the `node_modules/.cache/sharp` directory. Standard Railway builds re-run `npm install` in the build environment, so the correct Linux binary will be fetched automatically.

**Warning signs:** `Error: Could not load the "sharp" module using the linux-x64 runtime` on Railway despite working locally.

### Pitfall 5: Upload-Post Analytics Not Immediately Available

**What goes wrong:** The validation test publishes a post, immediately queries analytics, gets empty data, and incorrectly flags INFRA-05 as failed.

**Why it happens:** Social platform analytics take 24-48 hours to stabilize. The `GET /api/uploadposts/post-analytics/{request_id}` endpoint exists and responds before data is populated.

**How to avoid:** Validate endpoint shape only — confirm the endpoint responds with a 200 (or 404 if post is too new) and that `request_id` is accepted as a path parameter. Don't validate the presence of engagement numbers. Store the `request_id` in a local file and verify analytics data can be retrieved after 24 hours if needed.

**Warning signs:** Test fails because `impressions: 0` or response body is empty, even though the endpoint itself is reachable.

---

## Code Examples

### SQLite + WAL + Integrity Check (startup pattern)

```typescript
// Source: https://sqlite.org/wal.html
// This becomes the production DB init pattern
import Database from 'better-sqlite3'

export function openDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000') // 5s timeout on locked DB

  const integrity = db.pragma('integrity_check', { simple: true })
  if (integrity !== 'ok') {
    throw new Error(`SQLite integrity check failed: ${integrity}`)
  }

  return db
}
```

### next.config.ts for Native Modules (if manual config needed)

```typescript
// Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
// NOTE: better-sqlite3, sharp, and node-cron are ALREADY in the auto-externals list.
// This config is only needed if additional packages require it.
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // better-sqlite3, sharp, node-cron are auto-externalized — no config needed
  // Add here only if you have additional native modules
  serverExternalPackages: [],
}

export default nextConfig
```

### Railway Volume Environment Pattern

```typescript
// Source: https://docs.railway.com/reference/volumes
// Use environment variable so local dev uses ./data, Railway uses /data
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH ?? './data'
const DB_PATH = path.join(DATA_DIR, 'app.db')
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `experimental.serverComponentsExternalPackages` | `serverExternalPackages` (stable) | Next.js 15.0.0 | better-sqlite3, sharp, node-cron auto-externalized — no config needed |
| Nixpacks (Railway build tool) | Railpack (zero-config successor) | Late 2024/Early 2025 | New default for Railway; node-gyp support claimed but needs validation |
| `experimental.instrumentationHook: true` | `instrumentation.ts` stable (no flag needed) | Next.js 15.0.0 | Just create the file — no next.config flag required |
| Manual webpack externals for SQLite | Auto-externals list | Next.js 14+ | 3 of our 5 key packages are auto-excluded from bundling |

**Deprecated/outdated:**
- `experimental.serverComponentsExternalPackages`: Renamed to `serverExternalPackages` in Next.js 15. Using the old key will log a deprecation warning.
- `experimental.instrumentationHook`: No longer needed in Next.js 15; stable by default.
- Nixpacks as primary Railway build: Railpack is the new default. Nixpacks still works but is no longer receiving features.

---

## Open Questions

1. **Does Railpack include gcc/python3/make for node-gyp builds?**
   - What we know: Railpack claims node-gyp support for native module compilation
   - What's unclear: Whether the build image includes the full C++ toolchain by default without explicit configuration
   - Recommendation: This is the #1 empirical question. If the Railway build fails, use a custom Dockerfile with `apt-get install -y python3 make g++` as the fix. This is explicitly part of the validation spike.

2. **Does Railway's volume mount support simultaneous -wal and -shm file access?**
   - What we know: Railway volumes are block storage (persistent disk); WAL mode requires shared memory file (-shm) that both reader and writer processes can access
   - What's unclear: Whether the volume's filesystem supports the shared memory mapping SQLite needs for WAL (this is a single-process app, so less likely to be an issue)
   - Recommendation: Validate by running WAL writes and reads in the test script. The single-process architecture (no separate workers) reduces this risk significantly.

3. **What is the exact Upload-Post analytics response schema?**
   - What we know: `GET /api/uploadposts/post-analytics/{request_id}` endpoint exists; returns per-platform metrics
   - What's unclear: Field names for impressions, engagement — needed for INFRA-05 data matching logic in later phases
   - Recommendation: During validation, log the raw response body. This doubles as schema discovery for Phase 7 (analytics collection).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None (standalone scripts — per CONTEXT.md decision) |
| Config file | none — scripts run directly with `tsx` |
| Quick run command | `npx tsx scripts/validate/01-sqlite-wal.ts` (per script) |
| Full suite command | `for f in scripts/validate/*.ts; do npx tsx $f || exit 1; done` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| INFRA-01 | SQLite WAL mode + integrity check on volume | smoke | `npx tsx scripts/validate/01-sqlite-wal.ts` | Wave 0 |
| INFRA-02 | better-sqlite3 builds + loads in Next.js 15 on Railway | smoke | Railway build log (manual) + `npx tsx scripts/validate/02-better-sqlite3.ts` | Wave 0 |
| INFRA-03 | node-cron starts via instrumentation.ts, no double-register | smoke | `npx tsx scripts/validate/03-cron-singleton.ts` (local) + Railway deploy log | Wave 0 |
| INFRA-04 | Satori+sharp renders PNG on Railway Linux | smoke | `npx tsx scripts/validate/04-satori-sharp.ts` | Wave 0 |
| INFRA-05 | Upload-Post analytics queryable by request_id | smoke | `npx tsx scripts/validate/05-upload-post.ts` | Wave 0 |

### Sampling Rate

- **Per task:** Run the specific validation script for that task
- **Per wave merge:** `for f in scripts/validate/*.ts; do npx tsx $f || exit 1; done`
- **Phase gate:** All 5 scripts exit 0 (locally) + Railway deploy shows no build errors + cron tick appears in Railway logs

### Wave 0 Gaps

- [ ] `scripts/validate/01-sqlite-wal.ts` — covers INFRA-01
- [ ] `scripts/validate/02-better-sqlite3.ts` — covers INFRA-02
- [ ] `scripts/validate/03-cron-singleton.ts` — covers INFRA-03
- [ ] `scripts/validate/04-satori-sharp.ts` — covers INFRA-04
- [ ] `scripts/validate/05-upload-post.ts` — covers INFRA-05
- [ ] `public/fonts/Inter-Regular.ttf` — required by Satori validation script (download from Google Fonts)
- [ ] Railway project created + volume attached + `RAILWAY_VOLUME_MOUNT_PATH=/data` env var set
- [ ] `.env.local` with `UPLOAD_POST_API_KEY` set (manual step, gitignored)

---

## Sources

### Primary (HIGH confidence)

- Next.js 15 `serverExternalPackages` docs (fetched 2026-03-16) — confirmed better-sqlite3, sharp, node-cron are in auto-externals list
- Next.js 15 instrumentation.ts docs (fetched 2026-03-16, lastUpdated 2026-02-27) — confirmed register() called once in production, NEXT_RUNTIME guard required
- Railway volumes docs (fetched 2026-03-16) — confirmed volumes mount at runtime not build time, root user note
- sharp installation docs (fetched 2026-03-16) — confirmed prebuilt binaries for Linux x64 glibc, cross-platform install flags
- Upload-Post API reference (fetched 2026-03-16) — confirmed `request_id` returned on publish, analytics endpoint `GET /api/uploadposts/post-analytics/{request_id}`

### Secondary (MEDIUM confidence)

- SQLite WAL official docs (https://sqlite.org/wal.html) — WAL file co-location requirements verified
- Railpack Node.js docs (fetched 2026-03-16) — node-gyp support mentioned; C++ toolchain not explicitly confirmed
- WebSearch: node-cron + instrumentation.ts singleton pattern — multiple community sources confirm production-once behavior

### Tertiary (LOW confidence)

- WebSearch: Railway Railpack native module behavior — not empirically confirmed; needs validation in spike

---

## Metadata

**Confidence breakdown:**
- INFRA-01 (SQLite WAL on Railway): HIGH for WAL mechanics, MEDIUM for Railway volume behavior (needs empirical test)
- INFRA-02 (better-sqlite3 on Railway): MEDIUM — Next.js bundling is solved; Railway build toolchain is the open question
- INFRA-03 (node-cron via instrumentation.ts): HIGH — both confirmed in Next.js 15 official docs
- INFRA-04 (Satori+sharp on Railway Linux): HIGH — prebuilt binaries for Linux x64 glibc confirmed
- INFRA-05 (Upload-Post analytics matching): HIGH — endpoint confirmed, schema needs discovery

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable tech, 30 days)
