---
phase: 2B-quality-pipeline
plan: "01"
subsystem: quality-pipeline
tags: [quality, ai, critique, rewrite, gate, schema, migration]
dependency_graph:
  requires:
    - 2A-02 (generate.ts with generateContent, saveGeneratedPosts, circuit breaker, cost logging)
  provides:
    - refineAndGate() server action
    - QualityDetails type
    - qualityDetails column on posts table
    - Extended saveGeneratedPosts() with optional quality data
  affects:
    - src/app/actions/generate.ts
    - src/db/schema.ts
    - src/db/migrations/
tech_stack:
  added: []
  patterns:
    - critique-rewrite-gate loop with max 1 retry
    - parse fallback returns passing score to avoid blocking users
    - synchronous db.insert().run() for activity logging (matching generate.ts pattern)
key_files:
  created:
    - src/db/migrations/0002_flawless_prodigy.sql
  modified:
    - src/db/schema.ts
    - src/app/actions/generate.ts
decisions:
  - "Critique fallback returns score=7 (not throw) to match research anti-pattern guidance"
  - "retried flag is per-platform (reset each iteration) ensuring exactly one retry max per platform"
  - "buildRewritePrompt receives brandSystemPrompt parameter but rewrite uses it in the call, not injected into user prompt -- system prompt handled by Anthropic system field"
  - "Else branch in gate routing handles unreachable state gracefully without silent failure"
metrics:
  duration: "185s"
  completed_date: "2026-03-17"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 2B Plan 01: Quality Pipeline Backend Summary

**One-liner:** Critique-rewrite-gate quality pipeline using Anthropic critique model with 5-dimension scoring, conditional skip at 8+, one retry at 5-6, discard below 5, and qualityDetails JSON column on posts.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add qualityDetails column to posts schema and generate migration | bb75492 | src/db/schema.ts, src/db/migrations/0002_flawless_prodigy.sql |
| 2 | Implement refineAndGate() and extend saveGeneratedPosts() | bf6dc3d | src/app/actions/generate.ts |

## What Was Built

### Schema Changes (Task 1)

- Exported `QualityDetails` interface from `src/db/schema.ts` with 5 dimensions: `hook`, `value`, `voice`, `uniqueness`, `platformFit` (each with `score: number` and `note: string`)
- Added `qualityDetails` column to the `posts` table as `text('quality_details', { mode: 'json' }).$type<QualityDetails | null>()`
- Generated migration `0002_flawless_prodigy.sql`: `ALTER TABLE posts ADD quality_details text;`

### Quality Pipeline (Task 2)

**New types exported:**
- `CritiqueResult` (internal): dimensions, overallScore, weakestDimension
- `RefinedGenerationResult` (exported): extends GenerationResult platform entries with qualityScore, qualityDetails, optional qualityWarning, discarded flag, discardReason

**New helper functions (internal):**
- `computeOverallScore(dimensions)`: arithmetic mean of 5 dimension scores, rounded
- `findWeakestDimension(dimensions)`: returns key of lowest-scoring dimension
- `buildCritiquePrompt(platform, content, brandVoice)`: JSON-requesting critique prompt with all 5 dimensions
- `buildRewritePrompt(platform, originalContent, critique, brandSystemPrompt)`: targeted rewrite prompt highlighting weak dimensions
- `runCritique(brandId, platform, content, brandVoice)`: full critique call with circuit breaker, cost logging, JSON parse; fallback to score=7 on any error
- `runRewrite(brandId, platform, originalContent, critique, brand)`: full rewrite call with circuit breaker, cost logging, plain text response

**refineAndGate() routing logic:**
1. Brand query + spend limit check
2. Per-platform loop:
   - Initial critique
   - Score >= 8: skip rewrite, log info
   - Score < 8: run rewrite + re-critique
   - After first rewrite: score >= 7 passes, score 5-6 triggers one retry (rewrite + re-critique), score < 5 discards
3. Activity log at every routing decision (type='quality')
4. Total cost accumulated from all rewrite calls

**saveGeneratedPosts() extension:**
- Added optional `qualityData?: Record<string, { score: number; details: QualityDetails }>` parameter
- Insert uses `qualityData?.[platformKeys[0]]?.score ?? null` and `qualityData?.[platformKeys[0]]?.details ?? null`
- Fully backward-compatible -- all existing callers still work without changes

## Verification Results

- `npx tsc --noEmit`: PASS (no errors)
- Migration file: `src/db/migrations/0002_flawless_prodigy.sql` exists with `ALTER TABLE posts ADD quality_details text;`
- `refineAndGate` exported from `src/app/actions/generate.ts`: YES
- `RefinedGenerationResult` exported: YES
- `saveGeneratedPosts` accepts optional qualityData: YES

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- src/db/schema.ts: FOUND
- src/db/migrations/0002_flawless_prodigy.sql: FOUND
- src/app/actions/generate.ts: FOUND
- Commit bb75492: FOUND
- Commit bf6dc3d: FOUND
