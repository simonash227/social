---
phase: 10-learning-validation
verified: 2026-03-20T00:00:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 10: Learning Validation Verification Report

**Phase Goal:** Each generated post records which learnings were active during its creation; A/B comparison reveals whether learnings actually lift engagement; ineffective learnings are automatically deactivated
**Verified:** 2026-03-20
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Plan 01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every generated post stores the IDs of active learnings used during generation | VERIFIED | `posts.postActiveLearningIds` column exists in schema.ts line 107; `saveGeneratedPosts` writes it at generate.ts line 773 |
| 2 | Auto-generated posts also store active learning IDs | VERIFIED | `AutoPostInput.activeLearningIds` in auto-generate.ts line 153; `saveAsAutoPost` writes `postActiveLearningIds` at line 190; both draft and schedule paths thread from `generationResult.activeLearningIds` |
| 3 | A/B stats reflect learnings active at generation time, not collection time | VERIFIED | collect-analytics.ts lines 183-185 read `posts.postActiveLearningIds` (relay column) before upsert — not current active learnings |
| 4 | A/B stats can be computed for any learning (with vs without engagement averages) | VERIFIED | `computeLearningStats` in learning-validator.ts uses `json_each` for "with" group (line 48) and `NOT EXISTS json_each` for "without" group (lines 62-68) |
| 5 | Ineffective learnings are auto-deactivated after N posts with no lift | VERIFIED | `autoDeactivateLearnings` sets `isActive=0`, `status='auto_deactivated'` when `withCount >= threshold && engagementDelta <= 0` |

### Observable Truths (Plan 02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 6 | Each learning on the dashboard shows A/B comparison stats | VERIFIED | A/B stats panel rendered in `LearningCard` at learnings-section.tsx lines 134-151; shows withCount, withoutCount, averages, color-coded delta |
| 7 | Each learning displays a validated confidence indicator derived from A/B data | VERIFIED | `displayConfidence = stats?.confidence ?? learning.confidence` at line 94; AI confidence shown in parentheses when it differs (lines 104-106) |
| 8 | Auto-deactivated learnings show a distinct badge and are hidden by default | VERIFIED | Amber badge at line 123; `hiddenLearnings` filter includes `auto_deactivated` at line 226-229; `showRejected` toggle covers both |
| 9 | Analytics page shows a learning count badge per post row for posts with active learnings | VERIFIED | `postActiveLearningIds` in analytics query select at page.tsx line 43; blue badge rendered at lines 222-226 |

**Score:** 9/9 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/schema.ts` | `postActiveLearningIds` column on posts table | VERIFIED | Line 107: `text('post_active_learning_ids', { mode: 'json' }).$type<number[] \| null>()` |
| `src/lib/learning-validator.ts` | `computeLearningStats` and `autoDeactivateLearnings` functions | VERIFIED | Both exported; `LearningStats` interface exported with all 7 required fields |
| `src/lib/cron.ts` | Wednesday 3am learning validator cron | VERIFIED | Slot 7 at line 122: `'0 3 * * 3'`; dynamic import of `autoDeactivateLearnings`; registered in console.log |
| `src/db/migrations/0010_special_ghost_rider.sql` | Migration for `post_active_learning_ids` column | VERIFIED | File exists; contains `ALTER TABLE posts ADD post_active_learning_ids text` |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(dashboard)/brands/[id]/learnings/page.tsx` | Server-side effectiveness data fetching | VERIFIED | Imports and calls `getLearningEffectiveness(brandId)` at line 58; passes as prop at line 67 |
| `src/app/(dashboard)/brands/[id]/learnings/learnings-section.tsx` | A/B stats panel, confidence badges, auto-deactivated handling | VERIFIED | `engagementDelta` rendered with color-coding; `LearningStats` imported; auto-deactivated badge present |
| `src/app/(dashboard)/brands/[id]/analytics/page.tsx` | Per-post learning count badge | VERIFIED | `postActiveLearningIds` in query select at line 43; badge rendered at lines 222-226 |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `generate.ts` | `posts.postActiveLearningIds` | `generateContent` returns `activeLearningIds`, `saveGeneratedPosts` writes them | WIRED | `activeLearningIds: learnings.map(l => l.id)` in return; `postActiveLearningIds: activeLearningIds ?? null` in insert |
| `auto-generate.ts` | `posts.postActiveLearningIds` | `saveAsAutoPost` accepts and writes `activeLearningIds` | WIRED | Interface extended; both draft (line 485) and schedule (line 517) calls pass `generationResult.activeLearningIds ?? null` |
| `collect-analytics.ts` | `postAnalytics.activeLearningIds` | Copies `posts.postActiveLearningIds` during upsert | WIRED | Relay column queried at lines 183-185; `activeLearningIds` written in both UPDATE (line 208) and INSERT (line 222) branches |
| `learning-validator.ts` | `postAnalytics + brandLearnings` | `json_each` SQL queries for A/B, writes `isActive=0` for deactivation | WIRED | `json_each(pa.active_learning_ids)` present in both with/without queries; deactivation sets `isActive: 0, status: 'auto_deactivated'` |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `learnings/page.tsx` | `getLearningEffectiveness` server action | Calls action and passes result as prop | WIRED | `const effectiveness = await getLearningEffectiveness(brandId)` at line 58; passed as prop at line 67 |
| `learnings-section.tsx` | `LearningStats` type | Renders `withCount`, `withoutCount`, `engagementDelta`, `confidence` from stats prop | WIRED | `effectiveness[learning.id]` passed as `stats` to each `LearningCard`; all four fields rendered |
| `analytics/page.tsx` | `posts.postActiveLearningIds` | Queries relay column; renders count badge per post row | WIRED | Selected in query at line 43; badge conditional on `length > 0` at line 222 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VALID-01 | 10-01, 10-02 | Tag each generated post with which learnings were active during generation | SATISFIED | `postActiveLearningIds` relay column in posts; generate page shows "N learnings active" badge post-generation; analytics page shows count badge per post row |
| VALID-02 | 10-01, 10-02 | A/B comparison: posts with learning vs posts without, per learning | SATISFIED | `computeLearningStats` uses `json_each` for correct set membership; learnings dashboard shows with/without counts, averages, and delta |
| VALID-03 | 10-01 | Auto-deactivate learnings with no engagement lift after N posts | SATISFIED | `autoDeactivateLearnings` checks `withCount >= threshold && engagementDelta <= 0`; sets `isActive=0, status='auto_deactivated'`; cron runs Wednesday 3am |
| VALID-04 | 10-01, 10-02 | Learning effectiveness summary on dashboard with confidence indicators | SATISFIED | `getLearningEffectiveness` server action; A/B stats panel per card; validated confidence replaces AI confidence when available; auto-deactivated amber badge |

All four VALID requirements are satisfied. No orphaned requirements found.

---

## Anti-Patterns Found

No anti-patterns detected. Scanned:
- `src/lib/learning-validator.ts` — no TODOs, no stubs, no empty returns
- `src/app/actions/generate.ts` — no TODOs, no stubs
- `src/lib/collect-analytics.ts` — no TODOs, no stubs
- `src/lib/cron.ts` — slot 7 is fully implemented, not a placeholder
- `src/lib/auto-generate.ts` — both save paths thread learning IDs

Notable implementation quality:
- `autoDeactivateLearnings` is correctly synchronous (better-sqlite3 constraint); cron wrapper is async for error handling only
- `json_each` used for JSON array membership — avoids false positives from LIKE pattern matching
- Relay column pattern correctly captures generation-time snapshot; analytics collection does not call `loadLearnings()`

---

## Human Verification Required

### 1. A/B stats panel visual appearance

**Test:** Navigate to a brand's Learnings page on the dashboard with at least one approved learning that has analytics data
**Expected:** A stats panel appears below each approved learning showing "With this learning: N posts, avg X", "Without this learning: N posts, avg Y", and a color-coded engagement delta (green positive, red negative, neutral zero)
**Why human:** Visual rendering and color-coding requires browser

### 2. Auto-deactivated learning badge and hide/show toggle

**Test:** If any learning has been auto-deactivated, navigate to the Learnings page
**Expected:** Auto-deactivated learnings show an amber "Auto-deactivated" badge and are hidden by default under the same toggle as rejected learnings (labeled "Show N hidden learnings")
**Why human:** Requires a learning to actually be in auto_deactivated state in the database

### 3. Analytics page learning count badge

**Test:** Navigate to a brand's Analytics page where posts were generated after learnings were active
**Expected:** Top performer rows show a blue "N learnings" badge next to the platform badge, where N is the count of learnings active during generation
**Why human:** Requires posts generated with active learnings and collected analytics to verify badge appears

### 4. Generate page learning attribution indicator

**Test:** Generate content for a brand with at least one approved, active learning (and learning injection enabled)
**Expected:** After generation completes, a blue "N learnings active" badge appears in the result footer area
**Why human:** Requires live generation with active learnings in the database

---

## Gaps Summary

No gaps. All 9 observable truths verified. All key links confirmed wired. All 4 VALID requirements satisfied. All commits (7452d2c, 5667444, 2e00236, 52def92) confirmed in git log. Migration 0010 exists and applies the correct column.

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
