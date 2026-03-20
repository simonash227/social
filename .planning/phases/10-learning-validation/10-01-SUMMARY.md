---
phase: 10-learning-validation
plan: 01
subsystem: learning-attribution
tags: [learning, analytics, attribution, cron, sql]
dependency_graph:
  requires: [09-01, 09-02]
  provides: [learning-attribution-chain, learning-validator, auto-deactivation-cron]
  affects: [postAnalytics, brandLearnings, generate-flow, auto-generate-flow]
tech_stack:
  added: []
  patterns:
    - json_each SQL for JSON array membership queries
    - Relay column pattern for snapshot attribution (generation-time vs collection-time)
    - Drizzle db.all<T>(sql`...`) for raw SQL with type safety
key_files:
  created:
    - src/lib/learning-validator.ts
    - src/db/migrations/0010_special_ghost_rider.sql
  modified:
    - src/db/schema.ts
    - src/app/actions/generate.ts
    - src/app/(dashboard)/brands/[id]/generate/generate-section.tsx
    - src/lib/auto-generate.ts
    - src/lib/collect-analytics.ts
    - src/lib/cron.ts
    - src/app/actions/learnings.ts
decisions:
  - "json_each used for JSON array membership — LIKE patterns would produce false positives on numeric IDs"
  - "Relay column pattern: posts.postActiveLearningIds captures learning IDs at generation time; analytics collection copies them forward — prevents drift when learnings change after generation"
  - "autoDeactivateLearnings is synchronous (better-sqlite3 is sync); cron wrapper is async for error handling only"
  - "Migration 0010 was pre-generated; drizzle-kit generate confirmed no pending changes"
metrics:
  duration_minutes: 25
  tasks_completed: 2
  files_modified: 7
  files_created: 2
  completed_date: "2026-03-20"
---

# Phase 10 Plan 01: Learning Attribution Pipeline and Validator Summary

Attribution chain from content generation through to learning A/B validation — relay column threads learning IDs from generation into posts and analytics, validator engine computes engagement deltas via json_each, auto-deactivation cron runs Wednesday 3am.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Attribution relay column + threading through all generation paths | 7452d2c |
| 2 | Learning validator engine + auto-deactivation cron | 5667444 |

## What Was Built

### Task 1: Attribution Relay Column

**Schema change:** Added `postActiveLearningIds` (text/json, nullable) to the `posts` table. Migration `0010_special_ghost_rider.sql` applies `ALTER TABLE posts ADD post_active_learning_ids text`.

**GenerationResult interface:** Extended with `activeLearningIds?: number[]`. The `generateContent` function returns `learnings.map(l => l.id)` — the IDs of learnings that were active and injected during this specific generation call.

**Manual generation path (generate-section.tsx):** Added `activeLearningIds` state. Stored from `genResult.activeLearningIds` after generation. Passed to `saveGeneratedPosts` as new last parameter. Reset to null on Generate Again.

**Auto-generation path (auto-generate.ts):** `AutoPostInput` interface extended with `activeLearningIds`. `saveAsAutoPost` writes `postActiveLearningIds` to the DB. Both draft-save and schedule-save calls in `processEntry` pass `generationResult.activeLearningIds`.

**Analytics collection (collect-analytics.ts):** Before each upsert, queries `posts.postActiveLearningIds` for the post being processed. Copies the value to `postAnalytics.activeLearningIds` in both UPDATE and INSERT branches. This ensures analytics rows always carry the generation-time snapshot, not whatever learnings are currently active.

### Task 2: Learning Validator Engine

**src/lib/learning-validator.ts:**

- `LearningStats` interface: `learningId`, `withCount`, `withAvgEngagement`, `withoutCount`, `withoutAvgEngagement`, `engagementDelta`, `confidence`.
- `deriveConfidence`: high if 20+ posts AND delta >= 5; medium if 10+ posts AND delta >= 2; low otherwise.
- `computeLearningStats`: Two raw SQL queries via `db.all<T>(sql\`...\`)`. "With" group uses `INNER JOIN json_each(pa.active_learning_ids) jl ON jl.value = ${learningId}`. "Without" group uses `NOT EXISTS (SELECT 1 FROM json_each(...))`. Returns rounded averages and delta.
- `autoDeactivateLearnings`: Queries all `isActive=1 AND status='approved'` learnings, calls `computeLearningStats` for each, deactivates (sets `isActive=0`, `status='auto_deactivated'`) any with `withCount >= threshold AND engagementDelta <= 0`. Returns count of deactivated.

**Cron (cron.ts):** Slot 7 added: `'0 3 * * 3'` (Wednesday 3:00 AM). Dynamic import of `autoDeactivateLearnings`. Console log updated to include `learning-validator`.

**Server action (learnings.ts):** `getLearningEffectiveness(brandId)` queries all learnings for the brand, calls `computeLearningStats` for those with status `approved` or `auto_deactivated`, returns `Record<number, LearningStats>`.

## Deviations from Plan

None — plan executed exactly as written. Migration 0010 was already generated prior to this session; `drizzle-kit generate` confirmed no pending schema changes.

## Verification

1. `npx tsc --noEmit` — PASS (zero errors)
2. `npm run build` — PASS
3. `npx drizzle-kit generate` — "No schema changes, nothing to migrate" (migration already exists)
4. `src/db/schema.ts` contains `postActiveLearningIds` column — CONFIRMED
5. `GenerationResult` contains `activeLearningIds` field — CONFIRMED
6. Both `saveGeneratedPosts` and `saveAsAutoPost` write `postActiveLearningIds` — CONFIRMED
7. `collect-analytics.ts` copies relay column to `postAnalytics.activeLearningIds` — CONFIRMED
8. `learning-validator.ts` exports `computeLearningStats` and `autoDeactivateLearnings` — CONFIRMED
9. `cron.ts` contains `0 3 * * 3` schedule entry — CONFIRMED

## Self-Check: PASSED

All files confirmed to exist. All commits confirmed in git log.
