---
phase: 00-infrastructure-validation-spike
plan: 01
subsystem: infra
tags: [next.js, sqlite, better-sqlite3, satori, sharp, node-cron, railway, tsx]

# Dependency graph
requires: []
provides:
  - "Next.js 15 project scaffold with App Router + TypeScript + Tailwind"
  - "5 standalone validation scripts (scripts/validate/01-05) covering all INFRA requirements"
  - "SQLite WAL mode validation pattern (becomes production DB init)"
  - "node-cron singleton guard pattern (becomes instrumentation.ts pattern)"
  - "Satori+sharp PNG rendering pipeline validation"
  - "Inter font (WOFF format) for Satori rendering"
affects:
  - 00-infrastructure-validation-spike (plan 02 -- Railway deploy validation)
  - 01-scaffolding-database-auth (uses patterns established here)

# Tech tracking
tech-stack:
  added:
    - "next@^15.0.0"
    - "react@^19.0.0"
    - "better-sqlite3@^12.8.0 (prebuilt binaries for Node 22 Win32/x64)"
    - "drizzle-orm@^0.30.0"
    - "satori@^0.10.0"
    - "sharp@^0.33.0"
    - "node-cron@^3.0.3"
    - "tsx@^4.19.0 (for running validation scripts)"
    - "@fontsource/inter (devDependency -- source of WOFF font file)"
  patterns:
    - "SQLite WAL mode initialization: pragma journal_mode=WAL, foreign_keys=ON, busy_timeout=5000, integrity_check"
    - "node-cron singleton guard: globalThis.__cronRegistered flag + NEXT_RUNTIME !== 'nodejs' early return"
    - "Satori rendering: object vnode format (not JSX), WOFF font required (not WOFF2 or variable TTF)"
    - "async main() wrapper in tsx scripts for CJS top-level await compatibility"

key-files:
  created:
    - "scripts/validate/01-sqlite-wal.ts -- INFRA-01: SQLite WAL + integrity + -wal/-shm files"
    - "scripts/validate/02-better-sqlite3-nextjs.ts -- INFRA-02: native module load + CRUD"
    - "scripts/validate/03-cron-singleton.ts -- INFRA-03: cron singleton + NEXT_RUNTIME guard"
    - "scripts/validate/04-satori-sharp.ts -- INFRA-04: Satori SVG + sharp PNG pipeline"
    - "scripts/validate/05-upload-post.ts -- INFRA-05: API key auth + analytics endpoint"
    - "package.json -- project scaffold with all dependencies"
    - "tsconfig.json -- Next.js 15 App Router TypeScript config"
    - "next.config.ts -- minimal config (native modules auto-externalized)"
    - ".env.local.example -- UPLOAD_POST_API_KEY + DB_PATH"
    - ".node-version -- pinned to 22 for Railway Railpack"
    - "public/fonts/Inter-Regular.woff -- Inter font for Satori (WOFF format)"
    - "public/fonts/Inter-Regular.ttf -- Inter variable TTF (downloaded, not used by Satori)"
    - "src/app/layout.tsx -- minimal Next.js layout stub"
    - "src/app/page.tsx -- minimal Next.js home page stub"
  modified:
    - ".gitignore -- added data/, test-output/, .env.local, .next/"

key-decisions:
  - "Used better-sqlite3 v12.8.0 instead of v9.6.0: v12.8.0 has prebuilt binaries for Node 22 on Windows; v9.6.0 had no prebuilts and requires Visual Studio C++ build tools"
  - "Used Inter WOFF format instead of TTF or WOFF2: Satori 0.10.x only supports OTF/TTF/WOFF -- WOFF2 throws 'Unsupported OpenType signature'; Inter variable TTF from google/fonts throws 'Cannot read properties of undefined'; WOFF from @fontsource/inter works correctly"
  - "Added async main() wrapper to validation scripts: tsx compiled to CJS by default, which doesn't support top-level await; wrapping in async main() is the minimal fix without changing project-wide module format"
  - "Added @fontsource/inter as devDependency: reliable source for WOFF format font files; curl download from rsms/inter GitHub was corrupted by CRLF conversion on Windows"

patterns-established:
  - "Pattern 1: SQLite init -- pragma WAL + foreign_keys + busy_timeout + integrity_check on every DB open"
  - "Pattern 2: Cron singleton -- globalThis.__cronRegistered guard before cron.schedule(), NEXT_RUNTIME check"
  - "Pattern 3: Satori rendering -- object vnode (not JSX), WOFF font data, 1080x1080 for carousel slides"
  - "Pattern 4: Validation scripts -- async main() wrapper, [PASS]/[FAIL]/[SKIP] prefixes, timing, exit codes"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05]

# Metrics
duration: 16min
completed: 2026-03-16
---

# Phase 0 Plan 01: Infrastructure Validation Scripts Summary

**Next.js 15 project scaffold + 5 standalone validation scripts proving SQLite WAL, better-sqlite3 native module, node-cron singleton guard, Satori+sharp PNG pipeline, and Upload-Post API reachability**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-16T02:13:09Z
- **Completed:** 2026-03-16T02:28:48Z
- **Tasks:** 2 completed
- **Files modified:** 16

## Accomplishments
- Next.js 15 project scaffolded (App Router, TypeScript, Tailwind) with all 5 validation dependencies
- All 4 local validation scripts (INFRA-01 through INFRA-04) pass with [PASS] output and exit 0
- Script 05 gracefully skips with [SKIP] when no API key is present (exit 0)
- SQLite WAL mode confirmed: journal_mode=wal, -wal and -shm files created alongside database
- better-sqlite3 v12.8.0 native module loads via prebuilt binary for Node 22 Windows x64
- node-cron singleton fires exactly once across 3 register() calls; NEXT_RUNTIME guard works
- Satori renders 1080x1080 JSX vnode to SVG; sharp converts to 21KB PNG with valid PNG header

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js 15 project** - `b278a54` (feat)
2. **Task 2: Create all 5 validation scripts** - `7ff2c6c` (feat)

## Files Created/Modified
- `scripts/validate/01-sqlite-wal.ts` - INFRA-01: WAL mode + integrity check + -wal/-shm creation
- `scripts/validate/02-better-sqlite3-nextjs.ts` - INFRA-02: native load, CRUD, transactions, aggregates
- `scripts/validate/03-cron-singleton.ts` - INFRA-03: globalThis guard + NEXT_RUNTIME check, cron.validate
- `scripts/validate/04-satori-sharp.ts` - INFRA-04: Satori vnode->SVG + sharp SVG->PNG + PNG magic verify
- `scripts/validate/05-upload-post.ts` - INFRA-05: API key auth + analytics endpoint, graceful skip
- `package.json` - Project with next 15, react 19, better-sqlite3, drizzle-orm, satori, sharp, node-cron
- `tsconfig.json` - Next.js 15 App Router strict TypeScript
- `next.config.ts` - Minimal config (serverExternalPackages auto-handles native modules)
- `.env.local.example` - UPLOAD_POST_API_KEY + DB_PATH template
- `.node-version` - Pinned to 22 for Railway Railpack
- `public/fonts/Inter-Regular.woff` - Inter WOFF font for Satori rendering
- `.gitignore` - data/, test-output/, .env.local, .next/ exclusions
- `src/app/layout.tsx` + `src/app/page.tsx` - Minimal App Router stubs

## Decisions Made
- **better-sqlite3 v12.8.0 over v9.6.0**: Only v12.8.0 has prebuilt Win32/x64 binaries for Node 22. v9.6.0 requires C++ build tools (Visual Studio) which are not installed.
- **WOFF font format**: Satori 0.10.x rejects WOFF2 ("Unsupported OpenType signature wOF2") and the Inter variable TTF crashes. WOFF from @fontsource/inter works correctly.
- **async main() wrapper**: tsx compiles to CJS by default; top-level await is only supported in ESM. Wrapping in `async function main()` is the minimal fix preserving CJS compatibility.
- **@fontsource/inter as devDependency**: Windows CRLF handling corrupted the TTF downloaded directly from GitHub via curl. The npm package provides clean binary WOFF/WOFF2 files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] better-sqlite3 v9.6.0 has no prebuilt binaries for Node 22 on Windows**
- **Found during:** Task 1 (npm install)
- **Issue:** `npm install` failed with `node-gyp ERR! find VS` because better-sqlite3 v9.6.0 has no prebuilt Windows x64 binary for Node v22.22.0 and requires Visual Studio C++ tools
- **Fix:** Installed better-sqlite3 v12.8.0 which has prebuilt binaries (downloaded successfully from GitHub releases)
- **Files modified:** package.json, package-lock.json
- **Verification:** `node -e "require('./node_modules/better-sqlite3')"` succeeds
- **Committed in:** b278a54 (Task 1 commit)

**2. [Rule 1 - Bug] Top-level await incompatible with tsx CJS output**
- **Found during:** Task 2 (running scripts 03, 04, 05)
- **Issue:** Scripts using top-level `await` failed with "Top-level await is currently not supported with the 'cjs' output format" -- tsx defaults to CJS compilation
- **Fix:** Wrapped async code in `async function main() {}` with `.catch()` handler in scripts 03, 04, 05
- **Files modified:** scripts/validate/03-cron-singleton.ts, 04-satori-sharp.ts, 05-upload-post.ts
- **Verification:** All 5 scripts run successfully via `npx tsx`
- **Committed in:** 7ff2c6c (Task 2 commit)

**3. [Rule 1 - Bug] Satori rejects WOFF2 and variable TTF formats**
- **Found during:** Task 2 (running script 04)
- **Issue:** (a) WOFF2 throws "Unsupported OpenType signature wOF2"; (b) Inter variable TTF from google/fonts throws "Cannot read properties of undefined reading '256'"; (c) Direct curl download of Inter TTF from rsms/inter was binary-corrupted by Windows CRLF handling
- **Fix:** Installed @fontsource/inter as devDependency, copied WOFF file to public/fonts/Inter-Regular.woff, updated script 04 to search for WOFF first then TTF
- **Files modified:** scripts/validate/04-satori-sharp.ts, public/fonts/Inter-Regular.woff, package.json
- **Verification:** Script 04 produces 21KB PNG with valid PNG header
- **Committed in:** 7ff2c6c (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes were necessary for correct operation on Windows. No scope creep. Railway Linux environment may not encounter issues 1 or 3 (prebuilt Linux binaries exist for v9.6.0; curl won't corrupt binary on Linux). Plan 02 will confirm Railway-specific behavior.

## Issues Encountered
- Windows lacks Visual Studio C++ build tools required for better-sqlite3 compilation from source -- resolved by using prebuilt binary in v12.8.0
- Satori font format restrictions are not prominently documented -- WOFF2 (most common CDN format) is not supported; only WOFF/OTF/TTF

## User Setup Required
**External services require configuration for full validation of INFRA-05.**

To complete Upload-Post validation (script 05):
1. Copy `.env.local.example` to `.env.local`
2. Add your Upload-Post API key: `UPLOAD_POST_API_KEY=your_actual_key`
3. Run: `npx tsx scripts/validate/05-upload-post.ts`
4. Expected output: `[PASS] Upload-Post API key valid, N accounts found, analytics endpoint reachable`

## Next Phase Readiness
- All 5 INFRA validation scripts pass locally
- Ready for Plan 02: Railway deployment validation (SQLite on volume, better-sqlite3 build, instrumentation.ts cron, Satori+sharp on Linux)
- Pattern established: SQLite WAL init, cron singleton, Satori WOFF font -- all will be reused in Phase 1 production code
- No blockers for Plan 02

---
*Phase: 00-infrastructure-validation-spike*
*Completed: 2026-03-16*
