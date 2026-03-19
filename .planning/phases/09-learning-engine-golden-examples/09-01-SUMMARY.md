---
phase: 09-learning-engine-golden-examples
plan: 01
subsystem: learning-engine
tags: [learning, analytics, cron, prompt-injection, golden-examples]
dependency_graph:
  requires: [08-01]
  provides: [learning-engine-pipeline, prompt-injector-data-layer]
  affects: [09-02, 09-03]
tech_stack:
  added: []
  patterns: [lazy-anthropic-client, globalThis-mutex, drizzle-percentile-query, dynamic-import-cron]
key_files:
  created:
    - src/lib/learning-engine.ts
    - src/lib/prompt-injector.ts
    - src/db/migrations/0009_moaning_texas_twister.sql
  modified:
    - src/db/schema.ts
    - src/lib/cron.ts
    - src/lib/collect-analytics.ts
decisions:
  - "All learnings written with status=pending (never auto-approved) — Goodhart's Law prevention"
  - "analyzeForBrand guards: 7-day time gate, 30-post data gate, spend gate, mutex"
  - "loadLearnings requires BOTH isActive=1 AND status=approved — isActive alone is insufficient"
  - "loadGoldenExamples uses 90th percentile with pinned-first, recent-second, historic-third ordering"
  - "calculateCostUsd and parseJsonResponse copied inline from generate.ts — cannot import server actions from lib"
  - "Threshold trigger in collectAnalytics: 2+ affected platform cohorts per brand fires learning analysis"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-19"
  tasks_completed: 2
  files_modified: 6
requirements_satisfied: [LEARN-01, LEARN-02, LEARN-05, LEARN-06, GOLD-01]
---

# Phase 09 Plan 01: Learning Engine + Prompt Injector Summary

**One-liner:** Learning analysis pipeline with 4-gate guards (7-day/30-post/spend/mutex) writing pending learnings to DB, plus p90 golden example loader with pinned-first priority.

## What Was Built

### Task 1: isGoldenPinned schema + learning-engine.ts + prompt-injector.ts (bc20759)

**Schema change:** Added `is_golden_pinned INTEGER DEFAULT 0 NOT NULL` to the posts table (migration `0009_moaning_texas_twister.sql`). This enables Plan 02 UI to pin exceptional posts as permanent golden examples.

**learning-engine.ts** — The core analysis loop:

- `analyzeForBrand(brandId, platform, options?)`: Runs 4 sequential guards before calling Claude:
  1. Time gate: `lastLearningRunAt` must be > 7 days ago (or `force: true`)
  2. Data gate: 30+ `postAnalytics` rows with non-null `engagementScore` for the brand+platform
  3. Spend gate: `checkAiSpend()` from ai.ts
  4. Mutex: `globalThis.__learningRunning` (same pattern as `__analyticsRunning` in collect-analytics.ts)

  Queries top 20 and bottom 10 performers by engagement score. Formats each post as a compact summary (ID, score, hook preview, length, platform — no full content for token budget). Calls Claude Sonnet with structured JSON schema. Writes all results as `status='pending'` — never auto-approved.

- `analyzeAllPlatformsForBrand(brandId, options?)`: Queries distinct platforms for the brand, calls `analyzeForBrand()` sequentially.

- `analyzeAllBrands()`: Queries all brand IDs, calls `analyzeAllPlatformsForBrand()` for each, wrapped in mutex.

**prompt-injector.ts** — The read layer for generation injection:

- `loadLearnings(brandId, platform)`: Returns up to 5 learnings with BOTH `isActive=1` AND `status='approved'`. Ordered by confidence (high→medium→low via CASE expression), then `validatedAt DESC`. Platform-specific OR platform-null learnings included.

- `loadGoldenExamples(brandId, platform)`: Queries published posts (excluding variant losers via `variantOf IS NULL`), computes 90th percentile threshold from sorted scores, splits into pinned / recent top (last 30d) / historic top groups, returns up to 5 with pinned-first ordering.

### Task 2: Weekly cron + collectAnalytics threshold hook (1fd6076)

**cron.ts:** Added `cron.schedule('0 2 * * 0', ...)` — Sunday 2am learning cron with dynamic import of `analyzeAllBrands`. No conflict with existing schedule (backup: 3am, spend summary: midnight).

**collect-analytics.ts:** After the reclassification loop completes, computes per-brand cohort counts from `affectedCohorts`. If a brand had 2+ platform cohorts reclassified in a single run, triggers `analyzeAllPlatformsForBrand()` via dynamic import. The 7-day gate and 30-post minimum inside `analyzeForBrand()` ensure this is safe to call liberally — it returns early with `{ skipped: true }` if conditions aren't met.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

**Files created:**
- [x] src/lib/learning-engine.ts — exists, 230 lines, exports analyzeForBrand/analyzeAllPlatformsForBrand/analyzeAllBrands
- [x] src/lib/prompt-injector.ts — exists, 130 lines, exports loadLearnings/loadGoldenExamples + BrandLearning/GoldenExample types
- [x] src/db/migrations/0009_moaning_texas_twister.sql — exists, contains ALTER TABLE posts ADD is_golden_pinned

**Commits:**
- [x] bc20759 — feat(09-01): add isGoldenPinned + learning-engine + prompt-injector
- [x] 1fd6076 — feat(09-01): register weekly learning cron + collectAnalytics threshold hook

**Verification:**
- [x] `npx tsc --noEmit` passes with zero errors
- [x] `npx drizzle-kit generate` reports "No schema changes, nothing to migrate"
- [x] `src/lib/cron.ts` contains `0 2 * * 0` schedule
- [x] `src/lib/collect-analytics.ts` contains `analyzeAllPlatformsForBrand` import

## Self-Check: PASSED
