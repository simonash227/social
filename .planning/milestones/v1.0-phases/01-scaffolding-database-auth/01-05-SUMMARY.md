---
phase: 01-scaffolding-database-auth
plan: 05
subsystem: infra
tags: [node-cron, r2, upload-post, drizzle-orm, next-server-actions]

# Dependency graph
requires:
  - phase: 01-scaffolding-database-auth/01-01
    provides: database schema (activityLog, aiSpendLog, socialAccounts tables)
  - phase: 01-scaffolding-database-auth/01-01
    provides: src/lib/r2.ts with runDbBackup export
  - phase: 01-scaffolding-database-auth/01-01
    provides: src/lib/upload-post.ts with listProfiles export
  - phase: 01-scaffolding-database-auth/01-01
    provides: src/lib/ai.ts with logAiSpend/checkAiSpend
  - phase: 01-scaffolding-database-auth/01-04
    provides: brand detail page (brands/[id]/page.tsx) with Connected Accounts section
provides:
  - Cron infrastructure with globalThis singleton guard (initCron)
  - Daily DB backup cron at 3 AM copying SQLite to R2, keeps last 7
  - AI spend daily summary cron at midnight logging to activityLog
  - Production-ready health endpoint triggering cron init on first request
  - syncAccounts server action fetching Upload-Post profiles into socialAccounts table
  - incrementFailureCount with auto-disconnect after 5 failures
  - AccountsSection client component with Sync and Connect buttons on brand detail page
affects: [Phase 2A, Phase 5, Phase 7]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "globalThis singleton guard for cron initialization (prevents duplicate registration in Next.js standalone)"
    - "Cron initialized via health endpoint GET handler — not instrumentation.ts (standalone mode incompatibility)"
    - "Server actions with 'use server' directive for database mutations called from client components"
    - "useTransition + router.refresh() pattern for client-side server action invocation with loading state"

key-files:
  created:
    - src/lib/cron.ts
    - src/app/actions/accounts.ts
    - src/app/(dashboard)/brands/[id]/accounts-section.tsx
  modified:
    - src/app/api/health/route.ts
    - src/app/(dashboard)/brands/[id]/page.tsx

key-decisions:
  - "Cron logs to activityLog table (type: backup/ai_spend, level: info/error) for observability without extra infrastructure"
  - "syncAccounts inserts new accounts and re-connects disconnected ones if Upload-Post reports them active — no deletes to preserve history"
  - "incrementFailureCount threshold is 5 (matches plan spec) — called by Phase 5 publish cron, wired now for completeness"

patterns-established:
  - "Pattern: Health endpoint as cron init trigger — call initCron() at top of GET handler, safe due to singleton guard"
  - "Pattern: Client component + useTransition for server action invocation with loading state and result display"

requirements-completed: [INFRA-06, INFRA-08, ACCT-01, ACCT-02, ACCT-03]

# Metrics
duration: 20min
completed: 2026-03-16
---

# Phase 1 Plan 05: Cron Infrastructure + Account Sync Summary

**node-cron singleton initialization via health endpoint, daily SQLite backup to R2, AI spend tracking cron, and Upload-Post account sync with auto-disconnect after 5 publish failures**

## Performance

- **Duration:** 20 min
- **Started:** 2026-03-16T08:00:00Z
- **Completed:** 2026-03-16T08:20:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Cron infrastructure initialized via health endpoint with globalThis singleton guard — no duplicate job registration across hot reloads
- Daily backup cron (3 AM) copies SQLite file to R2, prunes to last 7 backups; AI spend summary cron (midnight) logs yesterday's total to activityLog
- AccountsSection client component replaces inline static accounts list on brand detail page, adding Sync Accounts + Connect Account buttons with loading state

## Task Commits

Each task was committed atomically:

1. **Task 1: Create cron initialization module and update health endpoint** - `883b539` (feat)
2. **Task 2: Create social account sync and accounts section for brand detail page** - `4da8579` (feat)

**Plan metadata:** (this commit — docs: complete plan)

## Files Created/Modified

- `src/lib/cron.ts` - initCron() with singleton guard, daily backup and AI spend summary jobs
- `src/app/api/health/route.ts` - production health endpoint: calls initCron, checks DB/cron/ai_mode/env vars
- `src/app/actions/accounts.ts` - syncAccounts, markAccountDisconnected, incrementFailureCount server actions
- `src/app/(dashboard)/brands/[id]/accounts-section.tsx` - client component with sync/connect buttons, account list
- `src/app/(dashboard)/brands/[id]/page.tsx` - replaced inline accounts section with AccountsSection component

## Decisions Made

- Cron logs success and failure outcomes to activityLog (type: backup/ai_spend) — observable via Activity Log page (Phase 7) without extra tooling
- syncAccounts never deletes existing DB rows — only inserts new or re-connects previously disconnected accounts — preserves history
- Health endpoint simplified to 4 checks (database, cron, ai_mode, env_vars) — removed volume/satori/sqlite CRUD checks from Phase 0 spike as they are no longer needed for ongoing health monitoring

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

External services require manual configuration before account sync and backups work:

- `UPLOAD_POST_API_KEY` — Upload-Post Dashboard -> API Settings
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — Cloudflare Dashboard -> R2

Both services gracefully degrade: syncAccounts returns `{ synced: 0, error: "..." }` if Upload-Post key missing; runDbBackup throws (caught and logged) if R2 creds missing.

## Next Phase Readiness

Phase 1 is now complete. All 5 plans executed:
- 01-01: API clients + DB schema + circuit breaker + sanitizer
- 01-02: Railway deployment validation (spike, deleted)
- 01-03: Auth (login, middleware, sessions)
- 01-04: Brand CRUD (create, list, detail, edit, delete)
- 01-05: Cron infrastructure + account sync (this plan)

Phase 2A (Brand Profiles + AI Generation) can begin immediately.

---
*Phase: 01-scaffolding-database-auth*
*Completed: 2026-03-16*
