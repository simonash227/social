---
phase: 08-schema-foundation
plan: 01
subsystem: database
tags: [drizzle, sqlite, better-sqlite3, schema, migration]

# Dependency graph
requires: []
provides:
  - brand_learnings table (learning engine: per-brand AI insights with confidence, A/B test groups, approval status)
  - prompt_templates table (prompt evolution: versioned templates with performance tracking)
  - comment_suggestions table (engagement helper: suggested replies per platform post)
  - brands.enableVariants, brands.learningInjection, brands.lastLearningRunAt columns
  - posts.recycledFromPostId, posts.variantOf, posts.variantGroup, posts.repurposeChainId columns
  - postAnalytics.promptTemplateId, postAnalytics.activeLearningIds columns
  - Migration 0008_same_mongu.sql applied cleanly
affects: [09-learning-engine, 10-learning-validation, 11-multi-variant, 12-advanced-analytics, 13-content-recycling, 14-engagement-helper]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AnySQLiteColumn type annotation for self-referential Drizzle FK columns to break circular type inference"
    - "v2.0 columns added to existing tables as nullable or with defaults — zero migration risk to existing rows"
    - "New v2.0 tables grouped in a clearly labeled section at the bottom of schema.ts"

key-files:
  created:
    - src/db/migrations/0008_same_mongu.sql
    - src/db/migrations/meta/0008_snapshot.json
  modified:
    - src/db/schema.ts
    - src/db/migrations/meta/_journal.json

key-decisions:
  - "AnySQLiteColumn return type annotation used on self-referential posts FK lambdas to resolve circular TypeScript type inference"
  - "All new columns on existing tables are nullable or have defaults — no existing rows break on migration"
  - "promptTemplates defined before postAnalytics in file order so FK reference resolves without circular dependency"

patterns-established:
  - "Self-referential FK pattern: .references((): AnySQLiteColumn => table.id) — use for any future self-referential Drizzle columns"
  - "v2.0 additions grouped with // v2.0 columns inline comment for easy diff identification"

requirements-completed: []

# Metrics
duration: 9min
completed: 2026-03-19
---

# Phase 8 Plan 01: Schema Foundation Summary

**SQLite v2.0 schema with 3 new tables (brandLearnings, promptTemplates, commentSuggestions) and 9 new columns across brands/posts/postAnalytics, with clean migration via Drizzle ORM**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-19T07:15:03Z
- **Completed:** 2026-03-19T07:23:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added 3 new tables supporting the v2.0 learning engine, prompt evolution, and engagement helper features
- Added 9 new columns to existing brands, posts, and postAnalytics tables (all nullable/with defaults)
- Generated migration 0008_same_mongu.sql and verified it applies cleanly on a fresh database
- TypeScript check passes and Next.js build succeeds with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add v2.0 tables and columns to schema.ts and generate migration** - `8381593` (feat)
2. **Task 2: Fix self-referential FK type annotation (AnySQLiteColumn)** - `8be5e5e` (fix)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `src/db/schema.ts` - Added 3 new table definitions and 9 new columns on existing tables; AnySQLiteColumn import for self-referential FK fix
- `src/db/migrations/0008_same_mongu.sql` - Generated migration: 3 CREATE TABLE + 9 ALTER TABLE ADD COLUMN statements
- `src/db/migrations/meta/_journal.json` - Updated with idx 8 entry (tag: 0008_same_mongu)
- `src/db/migrations/meta/0008_snapshot.json` - Drizzle schema snapshot for idx 8

## Decisions Made
- Used `AnySQLiteColumn` return type on self-referential FK lambdas (posts.recycledFromPostId, posts.variantOf) to resolve TypeScript circular type inference — standard Drizzle ORM recommendation
- Placed new v2.0 table definitions after existing tables, with `promptTemplates` before `postAnalytics` so the FK from postAnalytics.promptTemplateId resolves cleanly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed circular TypeScript type inference on self-referential FK columns**
- **Found during:** Task 2 (TypeScript check step)
- **Issue:** `posts.recycledFromPostId` and `posts.variantOf` self-referential FKs caused TS errors: "implicitly has type 'any' because it does not have a type annotation and is referenced directly or indirectly in its own initializer"
- **Fix:** Added `AnySQLiteColumn` import from `drizzle-orm/sqlite-core` and annotated the reference callbacks as `(): AnySQLiteColumn => posts.id` — breaks the circular reference without changing runtime behavior
- **Files modified:** `src/db/schema.ts`
- **Verification:** `npx tsc --noEmit` passes with zero errors; `npx drizzle-kit generate` still reports "No schema changes"
- **Committed in:** `8be5e5e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** Necessary correctness fix. No scope creep. The plan noted self-referential FKs were handled by lambda evaluation, but TypeScript still needed the explicit annotation.

## Issues Encountered
- `npx tsx` invocation of the migration script produced an empty DB (ESM/CJS mismatch with tsx and better-sqlite3 require()); resolved by using `npx drizzle-kit migrate` instead, which applied all 8 migrations cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All v2.0 database tables and columns are in place — Phases 9-14 can be developed without any further schema changes
- Migration applies cleanly from a fresh DB and from an existing v1.0 DB (all new columns safe for existing rows)
- No blockers

---
*Phase: 08-schema-foundation*
*Completed: 2026-03-19*
