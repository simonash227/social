---
phase: 11-multi-variant-generation
plan: "01"
subsystem: content-generation
tags: [multi-variant, auto-generate, brand-settings, quality-scoring]
dependency_graph:
  requires: [src/lib/ai.ts, src/app/actions/generate.ts, src/lib/auto-generate.ts, src/db/schema.ts]
  provides: [src/lib/variant-generator.ts, multi-variant pipeline, brand toggle]
  affects: [src/lib/auto-generate.ts, src/app/actions/generate.ts, src/components/brand-form.tsx, src/app/actions/brands.ts]
tech_stack:
  added: [shadcn Switch component]
  patterns: [concurrent Promise.all generation, temperature-based diversity, quality-score selection]
key_files:
  created:
    - src/lib/variant-generator.ts
    - src/components/ui/switch.tsx
  modified:
    - src/app/actions/generate.ts
    - src/lib/auto-generate.ts
    - src/components/brand-form.tsx
    - src/app/actions/brands.ts
decisions:
  - "Variant winner bypasses refine-and-gate per research anti-pattern — runCritique scoring inside generateVariants is sufficient"
  - "Losers always saved as draft with variantOf=winnerId regardless of automation level"
  - "Score on primary platform only (platforms[0]) per research Pitfall 1 — avoids conflicting cross-platform scores"
  - "Partial variant failure handled gracefully — if fewer than 3 succeed, pick best among those that did"
metrics:
  duration_seconds: 349
  completed_date: "2026-03-20"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 4
---

# Phase 11 Plan 01: Multi-Variant Generation Pipeline Summary

**One-liner:** 3-temperature Haiku variant pipeline with Sonnet scoring and winner/loser DB linking, controlled by per-brand Switch toggle.

## What Was Built

The multi-variant generation pipeline for brands with `enableVariants=1`. When triggered, the auto-generate pipeline now:

1. Checks `brand.enableVariants === 1` and `checkAiSpend()` before the standard quality path
2. Calls `generateVariants()` which runs 3 Haiku calls concurrently at temperatures 0.7, 0.85, 1.0
3. Scores each variant via `runCritique()` on the primary platform only
4. Saves the highest-scoring as the canonical post, losers as drafts linked via `variantOf` + `variantGroup`
5. Falls back to single-variant with logged warning if spend limit reached or all calls fail

Brand settings now has a Switch toggle for multi-variant with real-time cost estimate (~$0.015 vs ~$0.002 per post).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create variant-generator.ts and wire into auto-generate pipeline | ad31ad2 | src/lib/variant-generator.ts, src/app/actions/generate.ts, src/lib/auto-generate.ts |
| 2 | Add enableVariants toggle to brand settings and updateBrand action | 3333fb1 | src/components/brand-form.tsx, src/app/actions/brands.ts, src/components/ui/switch.tsx |

## Verification Results

1. `npx tsc --noEmit` — passes, no errors
2. `generateVariants()` calls Haiku 3x at 0.7/0.85/1.0 and `runCritique()` 3x for scoring
3. `processEntry()` checks `brand.enableVariants === 1` AND `checkAiSpend()` before variant path
4. Both fallback paths (spend limit + generation failure) log activity warnings
5. `saveAsAutoPost()` accepts and inserts `variantGroup` and `variantOf`
6. Loser posts saved with `status: 'draft'` and `variantOf: winnerId`
7. Brand-form Settings tab has Switch with cost estimate, hidden input submits value
8. `updateBrand()` persists `enableVariants` to DB

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing component] Added Switch shadcn component**
- **Found during:** Task 2
- **Issue:** `Switch` component referenced in plan did not exist in the project
- **Fix:** Ran `npx shadcn@latest add switch` to add the component
- **Files modified:** src/components/ui/switch.tsx (created)
- **Commit:** 3333fb1

**2. [Rule 2 - Missing export] Exported CritiqueResult and BrandRow types**
- **Found during:** Task 1
- **Issue:** Plan specified exporting runCritique and build helpers, but variant-generator also needs CritiqueResult type and BrandRow type for proper TypeScript
- **Fix:** Also exported `CritiqueResult` interface and `BrandRow` type from generate.ts
- **Files modified:** src/app/actions/generate.ts
- **Commit:** ad31ad2

## Self-Check: PASSED

- src/lib/variant-generator.ts: FOUND
- src/components/ui/switch.tsx: FOUND
- Commit ad31ad2: FOUND
- Commit 3333fb1: FOUND
