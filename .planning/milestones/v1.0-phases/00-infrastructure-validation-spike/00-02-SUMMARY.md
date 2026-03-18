---
phase: 00-infrastructure-validation-spike
plan: 02
subsystem: infra
tags: [railway, docker, next.js, better-sqlite3, sqlite, node-cron, satori, sharp, standalone]

# Dependency graph
requires:
  - phase: 00-infrastructure-validation-spike
    provides: "Plan 01 validation scripts, patterns, and scaffold"
provides:
  - "Railway deployment confirmed working: Dockerfile required for better-sqlite3 native compilation"
  - "SQLite WAL on Railway volume mount: persists across redeployment"
  - "node-cron initialized via health endpoint fallback (not instrumentation.ts in standalone)"
  - "Satori+sharp PNG rendering confirmed on Railway Linux (8777 bytes)"
  - "4 Railway-specific infrastructure assumptions validated and documented"
affects:
  - 01-scaffolding-database-auth (Dockerfile pattern, cron initialization strategy, Railway deploy config)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Railway Dockerfile: node:22-slim base with python3/make/g++ for better-sqlite3 native compilation"
    - "Railway networking: HOSTNAME=0.0.0.0 required in Dockerfile CMD or ENV"
    - "node-cron in standalone builds: must be in serverExternalPackages + initialized via health endpoint or custom server.js (NOT instrumentation.ts)"
    - "Next.js standalone: does NOT copy instrumentation.ts to .next/server/ -- cannot use for singleton init"
    - "Health endpoint as init fallback: first request to /api/health triggers cron scheduler registration"

key-files:
  created:
    - "Dockerfile -- multi-stage build with python3/make/g++ for better-sqlite3 native compilation on Railway"
    - "instrumentation.ts -- node-cron singleton with NEXT_RUNTIME guard (works in dev, fallback needed in standalone)"
    - "src/app/api/health/route.ts -- validates SQLite WAL, Satori+sharp, cron registration, volume mount"
    - "src/app/page.tsx -- landing page with link to /api/health"
  modified:
    - "next.config.ts -- output: 'standalone' + node-cron in serverExternalPackages"
    - "tsconfig.json -- updated by Next.js build (ES2017 target)"

key-decisions:
  - "Dockerfile required (not Railpack): better-sqlite3 needs python3/make/g++ for native compilation on Railway"
  - "HOSTNAME=0.0.0.0 required in Dockerfile for Railway networking to work"
  - "node-cron must be in serverExternalPackages explicitly (auto-externals with empty array override did not work)"
  - "Next.js standalone mode does NOT compile instrumentation.ts to .next/server/ -- node-cron must be initialized via health endpoint fallback or custom server.js"
  - "SQLite volume mount confirmed: data survived redeploy on Railway volume at /data"

patterns-established:
  - "Pattern 5: Railway Dockerfile -- node:22-slim + apt python3/make/g++ for native modules, HOSTNAME=0.0.0.0, dynamic PORT"
  - "Pattern 6: Cron in standalone Next.js -- use serverExternalPackages + health endpoint fallback for singleton init"
  - "Pattern 7: Health endpoint -- validates all infrastructure concerns (sqlite, satori, cron, volume) in a single GET /api/health"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05]

# Metrics
duration: 90min
completed: 2026-03-16
---

# Phase 0 Plan 02: Railway Infrastructure Validation Summary

**All 4 Railway infrastructure assumptions validated: SQLite WAL on volume persists across redeploy, better-sqlite3 compiles via Dockerfile, Satori+sharp renders 8777-byte PNG on Linux, node-cron ticks via health endpoint fallback**

## Performance

- **Duration:** ~90 min (including iterative Dockerfile fixes and Railway deployment cycles)
- **Started:** 2026-03-16T02:28:00Z (approx)
- **Completed:** 2026-03-16T04:09:12Z
- **Tasks:** 2 completed (Task 1: create files, Task 2: human-verify Railway deployment)
- **Files modified:** 6

## Accomplishments

- All 4 health checks returned `pass: true` on Railway (`/api/health`)
- SQLite WAL database at `/data/app.db` survived redeploy (volume mount working)
- node-cron loaded and scheduled successfully on Linux via health endpoint fallback
- Satori+sharp rendered valid 8777-byte PNG on Railway's Linux environment
- Dockerfile approach confirmed as the correct deployment strategy for this stack
- Railway test project deleted after capturing all results (spike complete, no ongoing cost)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Railway deployment files and health endpoint** - `51c21bb` (feat)
2. **Fix: Use dynamic PORT and bind to 0.0.0.0 for Railway** - `5f4cdcd` (fix -- deviation)
3. **Fix: Copy node-cron into standalone build for instrumentation.ts** - `07b58f8` (fix -- deviation)
4. **Fix: Validate cron in health endpoint (standalone mode workaround)** - `a1fd0eb` (fix -- deviation)

Task 2 (checkpoint:human-verify) required no code commit -- user confirmed all checks passing.

## Files Created/Modified

- `Dockerfile` - Multi-stage build: node:22-slim + python3/make/g++ + standalone copy; HOSTNAME=0.0.0.0
- `instrumentation.ts` - node-cron singleton with NEXT_RUNTIME + globalThis guard (works in dev; standalone needs fallback)
- `next.config.ts` - output: 'standalone', node-cron in serverExternalPackages
- `src/app/api/health/route.ts` - Validates volume mount, SQLite WAL+CRUD, Satori+sharp PNG, cron registration
- `src/app/page.tsx` - Landing page linking to /api/health
- `tsconfig.json` - Updated by Next.js build process (ES2017 target)

## Decisions Made

- **Dockerfile required, not Railpack**: better-sqlite3 requires python3/make/g++ for native compilation. Railpack does not provide these build tools. All future Railway deployments for this project should use the Dockerfile.
- **HOSTNAME=0.0.0.0**: Railway requires the server to bind to all interfaces. Added `ENV HOSTNAME=0.0.0.0` to Dockerfile runner stage. Without this, Railway could not route traffic to the container.
- **node-cron in serverExternalPackages**: Auto-externals (empty array override in next.config.ts) did not bundle node-cron correctly for standalone. Explicit inclusion in `serverExternalPackages` is required.
- **instrumentation.ts does not work in standalone for cron init**: Next.js standalone mode does not compile or copy `instrumentation.ts` to `.next/server/`. The cron singleton init pattern from Plan 01 must be adapted -- use the health endpoint as a fallback initializer, or use a custom `server.js`.
- **Health endpoint as cron init fallback**: Modified `/api/health` to register node-cron if `__cronRegistered` is not set. Railway logs confirmed: `[cron] Scheduler registered via health check fallback`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] HOSTNAME not set, Railway unable to route traffic**
- **Found during:** Task 2 (initial Railway deployment, service not reachable)
- **Issue:** Next.js server bound to `localhost` (127.0.0.1) only; Railway's proxy couldn't reach it
- **Fix:** Added `ENV HOSTNAME=0.0.0.0` to Dockerfile runner stage and used `ENV PORT=3000` with dynamic CMD
- **Files modified:** `Dockerfile`
- **Verification:** Service became reachable at Railway public URL after redeploy
- **Committed in:** `5f4cdcd`

**2. [Rule 3 - Blocking] node-cron not available in standalone build**
- **Found during:** Task 2 (health check returned cron: false)
- **Issue:** node-cron was not copied into the `.next/standalone/node_modules/` directory by the standalone build, causing import to fail at runtime
- **Fix:** Added explicit `COPY --from=builder /app/node_modules/node-cron ./node_modules/node-cron` in Dockerfile runner stage; also added node-cron to `serverExternalPackages` in next.config.ts
- **Files modified:** `Dockerfile`, `next.config.ts`
- **Verification:** node-cron import succeeded after redeploy
- **Committed in:** `07b58f8`

**3. [Rule 1 - Bug] instrumentation.ts not compiled by Next.js standalone mode**
- **Found during:** Task 2 (cron never ticked, `__cronRegistered` was always false)
- **Issue:** Next.js standalone does NOT include `instrumentation.ts` in the `.next/server/` output. The `register()` function is never called, so node-cron is never scheduled via that path.
- **Fix:** Modified `/api/health` to check `__cronRegistered` and register node-cron directly if not set, serving as initialization fallback
- **Files modified:** `next.config.ts` (config cleanup), `src/app/api/health/route.ts` (added cron init fallback)
- **Verification:** Railway logs showed `[cron] Scheduler registered via health check fallback`; cron check returned `pass: true`
- **Committed in:** `a1fd0eb`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 bug)
**Impact on plan:** All three fixes were necessary for the Railway deployment to function. The instrumentation.ts finding (deviation 3) is the most significant architectural learning -- it changes how Phase 1 must implement cron initialization in production.

## Issues Encountered

- Railpack (Railway's auto-builder) cannot compile better-sqlite3 because it lacks python3/make/g++ -- required switching to a custom Dockerfile
- Next.js standalone mode omits `instrumentation.ts` entirely -- this is undocumented behavior that required discovering and implementing an alternative cron init strategy
- node-cron's auto-externalization in Next.js standalone is unreliable without explicit `serverExternalPackages` entry

## User Setup Required

None - this was a validation spike. The Railway test project was deleted after capturing all results.

## Next Phase Readiness

- All 4 Railway-specific infrastructure assumptions are now validated and documented
- Phase 0 is complete. Phase 1 (Scaffolding + Database + Auth) can begin.
- Key patterns for Phase 1:
  - Use the Dockerfile pattern for Railway deployment (not Railpack)
  - Cron must be initialized via health endpoint or custom server.js (not instrumentation.ts) in standalone builds
  - SQLite WAL init at `/data/app.db` confirmed working on Railway volume at `/data`
  - Satori+sharp PNG pipeline works on Railway Linux without modification

## Self-Check: PASSED

- FOUND: .planning/phases/00-infrastructure-validation-spike/00-02-SUMMARY.md
- FOUND: commit 51c21bb (feat: create Railway deployment files)
- FOUND: commit 5f4cdcd (fix: HOSTNAME=0.0.0.0 for Railway)
- FOUND: commit 07b58f8 (fix: node-cron in standalone build)
- FOUND: commit a1fd0eb (fix: cron via health endpoint fallback)

---
*Phase: 00-infrastructure-validation-spike*
*Completed: 2026-03-16*
