---
phase: 07-analytics-dashboard-polish
plan: 01
subsystem: database
tags: [drizzle, sqlite, analytics, cron, node-cron, engagement-score, percentile-classification]

# Dependency graph
requires:
  - phase: 05-calendar-scheduling
    provides: publishDuePosts cron mutex pattern, postPlatforms.requestId populated during publish
  - phase: 06-content-automation-pipeline
    provides: cron.ts structure, activityLog table, feed-poll cron pattern
provides:
  - postAnalytics table (schema + migration 0007_post_analytics.sql) with engagement score and tier
  - collectAnalytics() cron worker fetching from Upload-Post /post-analytics/{requestId}
  - calcEngagementScore() -- normalized 0-100 score with views=0 guard
  - classifyTier() -- percentile classification per brand+platform cohort
  - Cron registered at '0 */6 * * *' in cron.ts
  - scripts/validate-analytics.ts with 11 passing test cases
affects: [07-analytics-dashboard-polish plan 02 (dashboard UI reads postAnalytics)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - globalThis.__analyticsRunning mutex prevents overlapping 6h cron ticks
    - Two-pass percentile classification: collect scores, compute p25/p75, update tiers
    - drizzle-kit push applied schema; __drizzle_migrations hash inserted manually to sync runtime migrate()

key-files:
  created:
    - src/lib/collect-analytics.ts
    - src/db/migrations/0007_post_analytics.sql
    - src/db/migrations/meta/0007_snapshot.json
    - scripts/validate-analytics.ts
  modified:
    - src/db/schema.ts
    - src/lib/cron.ts
    - src/db/migrations/meta/_journal.json

key-decisions:
  - "drizzle-kit push applied migration; manually inserted hash into __drizzle_migrations to prevent duplicate table error on runtime migrate()"
  - "Zero-engagement-score posts excluded from percentile calc but classified as 'under' (not distorting distribution)"
  - "Cohorts with fewer than 4 posts default all to 'average' (percentiles meaningless with too few samples)"
  - "SELECT + INSERT/UPDATE pattern used for upsert instead of ON CONFLICT (simpler with drizzle-orm)"
  - "requestId mapped one-to-one: each requestId belongs to one postPlatform entry"

patterns-established:
  - "Pattern: INSERT migration hash into __drizzle_migrations when drizzle-kit push is used instead of runtime migrate for initial setup"

requirements-completed: [ANLY-01, ANLY-02, ANLY-03]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 7 Plan 01: Analytics Collection Backend Summary

**postAnalytics table + collect-analytics cron that fetches Upload-Post metrics every 6h, computes normalized engagement scores with views=0 guard, and classifies posts into top/average/under tiers via percentile cohort analysis**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T00:55:05Z
- **Completed:** 2026-03-18T01:01:Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- postAnalytics table with 11 columns (including engagementScore + performerTier) added to schema and migrated to local SQLite
- collect-analytics.ts cron worker with mutex guard, 48h eligibility window, null-requestId skip, post_metrics_error handling, and two-pass tier reclassification
- All 11 validation test cases pass: 6 for calcEngagementScore (including division-by-zero guards) and 5 for classifyTier (including boundary conditions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add postAnalytics schema + migration** - `1f75e46` (feat)
2. **Task 2: Build collect-analytics cron worker + register in cron.ts** - `13c71b1` (feat)
3. **Task 3: Create validation script** - `19d4ce9` (feat)

## Files Created/Modified

- `src/db/schema.ts` - Added postAnalytics table definition
- `src/db/migrations/0007_post_analytics.sql` - Migration SQL for post_analytics table
- `src/db/migrations/meta/0007_snapshot.json` - Drizzle schema snapshot
- `src/db/migrations/meta/_journal.json` - Updated with 0007_post_analytics tag
- `src/lib/collect-analytics.ts` - Main cron worker: collectAnalytics(), calcEngagementScore(), classifyTier()
- `src/lib/cron.ts` - Added collect-analytics schedule at '0 */6 * * *'
- `scripts/validate-analytics.ts` - 11 test cases for scoring and tier classification

## Decisions Made

- **drizzle-kit push vs runtime migrate sync:** Used `drizzle-kit push` to apply the migration (creates table immediately), then manually inserted the migration hash into `__drizzle_migrations` table so the runtime `migrate()` call in `src/db/index.ts` skips it and doesn't try to re-create the table during Next.js build. This is the established pattern for this project.
- **SELECT + INSERT/UPDATE upsert pattern:** Used explicit SELECT first, then INSERT or UPDATE, rather than raw SQL ON CONFLICT. This avoids needing a unique index in the drizzle schema definition while still supporting idempotent collection runs.
- **Zero-score posts in percentile calculation:** Posts with engagementScore=0 (no impressions) are excluded from p25/p75 calculation to avoid distorting the distribution, but are classified as 'under' since they have no engagement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Inserted migration hash to sync __drizzle_migrations**
- **Found during:** Task 2 verification (next build)
- **Issue:** `drizzle-kit push` applied the schema change directly to the DB but did not record a hash in `__drizzle_migrations`. When `next build` ran static page generation, `getDb()` called `migrate()` which tried to re-execute 0007_post_analytics.sql and failed with "table post_analytics already exists".
- **Fix:** Computed SHA256 hash of the migration file and inserted it into `__drizzle_migrations` with the correct timestamp from the journal. Build then passed cleanly.
- **Files modified:** data/app.db (runtime DB, not source files)
- **Verification:** `npx next build` succeeds, no changes detected on `npx drizzle-kit push`
- **Committed in:** 13c71b1 (included in task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Fix required for build to pass. This is a known project pattern (see STATE.md: drizzle-kit lineage handling).

## Issues Encountered

- Migration file was auto-named `0007_bent_runaways.sql` by drizzle-kit — renamed to `0007_post_analytics.sql` and updated journal tag accordingly.

## User Setup Required

None - no external service configuration required. The Upload-Post API key is already configured via `UPLOAD_POST_API_KEY` environment variable from prior phases.

## Next Phase Readiness

- postAnalytics table ready for dashboard queries in Plan 02
- collectAnalytics() will start populating data once posts are 48h+ old
- All exports (collectAnalytics, calcEngagementScore, classifyTier) available for import
- Cron fires every 6h after server restart and health endpoint hit

---
*Phase: 07-analytics-dashboard-polish*
*Completed: 2026-03-18*
