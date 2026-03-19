---
phase: 09-learning-engine-golden-examples
verified: 2026-03-20T00:00:00Z
status: passed
score: 19/19 must-haves verified
re_verification: false
---

# Phase 09: Learning Engine + Golden Examples Verification Report

**Phase Goal:** Build the learning engine that analyzes brand performance patterns and extracts actionable learnings, plus golden examples system for few-shot prompt injection.
**Verified:** 2026-03-20
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Plan 01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Weekly cron (Sunday 2am) triggers learning analysis for all brands | VERIFIED | `cron.ts` line 112: `cron.schedule('0 2 * * 0', ...)` dynamically imports `analyzeAllBrands` |
| 2 | Analysis only runs when brand has 30+ posts with engagement scores for a platform | VERIFIED | `learning-engine.ts` lines 104-119: data gate uses `isNotNull(postAnalytics.engagementScore)` join, returns `{ skipped: true, reason: 'insufficient_data' }` if count < 30 |
| 3 | Analysis only runs at most once per 7 days per brand (unless forced) | VERIFIED | `learning-engine.ts` lines 87-102: time gate checks `lastLearningRunAt`, skips if within 7 days; `force` option bypasses |
| 4 | Top performers produce positive learnings; underperformers produce avoid_pattern learnings | VERIFIED | `learning-engine.ts` lines 148-183: top 20 / bottom 10 slices passed separately to Claude with `avoid_pattern` instruction for underperformers |
| 5 | All new learnings are created with status=pending (never auto-approved) | VERIFIED | `learning-engine.ts` line 209: `status: 'pending'` hardcoded in all insert calls |
| 6 | loadLearnings returns only approved + active learnings, confidence-ordered, max 5 | VERIFIED | `prompt-injector.ts` lines 44-65: `eq(brandLearnings.isActive, 1)` AND `eq(brandLearnings.status, 'approved')` both required; CASE confidence ordering; LIMIT 5 |
| 7 | loadGoldenExamples returns 90th-percentile posts with pinned-first, recent-second priority | VERIFIED | `prompt-injector.ts` lines 109-149: p90 calculated, three-bucket split (pinned/recentTop/historicTop), `[...pinned, ...recentTop, ...historicTop].slice(0, 5)` |
| 8 | isGoldenPinned column exists on posts table | VERIFIED | `schema.ts` line 105: `isGoldenPinned: integer('is_golden_pinned').notNull().default(0)`; migration `0009_moaning_texas_twister.sql` contains `ALTER TABLE posts ADD is_golden_pinned` |

### Observable Truths (Plan 02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 9 | buildSystemPrompt accepts optional learnings and goldenExamples parameters | VERIFIED | `generate.ts` lines 80-84: `buildSystemPrompt(brand: BrandRow, learnings?: BrandLearning[], goldenExamples?: GoldenExample[]): string` |
| 10 | When learnings are provided, they appear in system prompt as actionable DO/AVOID directives | VERIFIED | `generate.ts` lines 126-133: `prefix = l.type === 'avoid_pattern' ? 'AVOID' : 'DO'`, injected as `- [DO/AVOID] description` |
| 11 | When golden examples are provided, they appear in system prompt as style references (capped at 300 chars each) | VERIFIED | `generate.ts` lines 115-124: `ex.content.slice(0, 300)` with "TOP PERFORMING POSTS — USE AS STYLE REFERENCE" header |
| 12 | generateContent loads learnings from prompt-injector when brand.learningInjection is enabled | VERIFIED | `generate.ts` lines 476-479: `const learnings = brand.learningInjection ? loadLearnings(brandId, platforms[0]) : []` |
| 13 | generateContent always loads golden examples (when available) | VERIFIED | `generate.ts` line 479: `const goldenExamples = loadGoldenExamples(brandId, platforms[0])` — unconditional |
| 14 | Only approved learnings inject into prompts (not pending or rejected) | VERIFIED | `prompt-injector.ts` line 48: `eq(brandLearnings.status, 'approved')` in loadLearnings WHERE clause |
| 15 | Server actions exist for approve, reject, toggle, manual analysis, pin, unpin | VERIFIED | `learnings.ts`: all 6 exported actions present — approveLearning, rejectLearning, toggleLearning, runManualAnalysis, pinGoldenExample, unpinGoldenExample (105 lines) |

### Observable Truths (Plan 03)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 16 | Learnings page shows all learnings for a brand with type, description, confidence, status, and supporting post count | VERIFIED | `learnings/page.tsx` queries all `brandLearnings` for brand; `learnings-section.tsx` renders TypeBadge, ConfidenceBadge, description, supportingCount, platform, relative date |
| 17 | Pending learnings are visually highlighted and have Approve/Reject buttons | VERIFIED | `learnings-section.tsx` lines 83-85: `border-amber-300 bg-amber-50` class for pending; lines 128-148: Approve (green) and Reject (destructive) buttons call server actions |
| 18 | Golden examples page shows 90th-percentile posts with content preview, engagement score, platform, and pin/unpin button | VERIFIED | `golden-examples/page.tsx` computes p90 server-side; `golden-examples-section.tsx` renders content preview (300 chars), platform badge, score, pin/unpin button |
| 19 | Brand detail page has navigation links to learnings and golden examples pages | VERIFIED | `brands/[id]/page.tsx` lines 164-170: Brain icon Learnings button + Star icon Golden Examples button, both using `render=<Link href=.../>` pattern |

**Score: 19/19 truths verified**

---

## Required Artifacts

| Artifact | Min Lines | Actual Lines | Status | Details |
|----------|-----------|--------------|--------|---------|
| `src/lib/learning-engine.ts` | 80 | 291 | VERIFIED | Exports analyzeForBrand, analyzeAllPlatformsForBrand, analyzeAllBrands with all 4 guards |
| `src/lib/prompt-injector.ts` | 40 | 150 | VERIFIED | Exports loadLearnings + loadGoldenExamples + BrandLearning/GoldenExample types |
| `src/lib/cron.ts` | — | 122 | VERIFIED | Sunday 2am cron registered at line 112 |
| `src/lib/collect-analytics.ts` | — | 330+ | VERIFIED | brandCohortCounts trigger at lines 307-320 |
| `src/app/actions/generate.ts` | — | 500+ | VERIFIED | prompt-injector import, buildSystemPrompt extended, generateContent wired |
| `src/app/actions/learnings.ts` | 50 | 105 | VERIFIED | All 6 server actions exported with 'use server' directive |
| `src/app/(dashboard)/brands/[id]/learnings/page.tsx` | 80 | 66 (page) + 308 (section) | VERIFIED | Server page + client section pattern; functional |
| `src/app/(dashboard)/brands/[id]/golden-examples/page.tsx` | 60 | 121 (page) + 185 (section) | VERIFIED | Server page + client section pattern; functional |
| `src/app/(dashboard)/brands/[id]/page.tsx` | — | — | VERIFIED | Brain/Star nav buttons with Links added |
| `src/db/migrations/0009_moaning_texas_twister.sql` | — | 1 | VERIFIED | `ALTER TABLE posts ADD is_golden_pinned INTEGER DEFAULT 0 NOT NULL` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/cron.ts` | `src/lib/learning-engine.ts` | dynamic import in Sunday 2am cron | WIRED | Line 114: `const { analyzeAllBrands } = await import('./learning-engine')` |
| `src/lib/collect-analytics.ts` | `src/lib/learning-engine.ts` | threshold-gated dynamic import after reclassification | WIRED | Lines 316-317: `const { analyzeAllPlatformsForBrand } = await import('./learning-engine')` |
| `src/lib/prompt-injector.ts` | `src/db/schema.ts` | drizzle query on brandLearnings with isActive + status=approved | WIRED | Lines 44-48: `eq(brandLearnings.isActive, 1)` AND `eq(brandLearnings.status, 'approved')` |
| `src/app/actions/generate.ts` | `src/lib/prompt-injector.ts` | import loadLearnings, loadGoldenExamples | WIRED | Line 13: `import { loadLearnings, loadGoldenExamples, ... } from '@/lib/prompt-injector'` |
| `src/app/actions/generate.ts` | `buildSystemPrompt` | passes learnings and goldenExamples | WIRED | Line 482: `buildSystemPrompt(brand, learnings, goldenExamples)` |
| `src/app/actions/learnings.ts` | `src/db/schema.ts` | updates brandLearnings with status=approved | WIRED | Lines 13-16: `db.update(brandLearnings).set({ status: 'approved', isActive: 1, ... })` |
| `src/app/(dashboard)/brands/[id]/learnings/*.tsx` | `src/app/actions/learnings.ts` | imports approveLearning, rejectLearning, toggleLearning, runManualAnalysis | WIRED | `learnings-section.tsx` lines 10-14: all 4 actions imported and called via useTransition |
| `src/app/(dashboard)/brands/[id]/golden-examples/*.tsx` | `src/app/actions/learnings.ts` | imports pinGoldenExample, unpinGoldenExample | WIRED | `golden-examples-section.tsx` line 9: both pin actions imported and called |
| `src/app/(dashboard)/brands/[id]/page.tsx` | learnings + golden-examples routes | Link components in header button row | WIRED | Lines 164-170: Brain/Star buttons with `render={<Link href={/brands/${id}/learnings} />}` pattern |

---

## Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| LEARN-01 | 09-01 | Weekly cron identifies patterns in top/bottom performers per brand per platform | SATISFIED | `cron.ts` `0 2 * * 0` + `analyzeAllBrands()` |
| LEARN-02 | 09-01 | AI generates structured learnings (hook/format/topic/timing dimensions) | SATISFIED | `learning-engine.ts` Claude call with structured JSON schema including hook_pattern, topic_pattern, structural_pattern, avoid_pattern types |
| LEARN-03 | 09-02 | Learnings injected into generation prompts sorted by confidence score | SATISFIED | `prompt-injector.ts` CASE confidence ordering; `generate.ts` passes to `buildSystemPrompt` |
| LEARN-04 | 09-03 | Learnings dashboard: view active/inactive learnings per brand with performance data | SATISFIED | `/brands/[id]/learnings` page with type, description, confidence, status, supporting post count, platform, relative date |
| LEARN-05 | 09-01 | Post-mortem on failures: underperformers generate "avoid" learnings | SATISFIED | `learning-engine.ts` bottom 10 performers analyzed; system prompt instructs `avoid_pattern` for underperformers |
| LEARN-06 | 09-01 | Statistical minimum gate: analysis requires 30+ posts per cohort | SATISFIED | `learning-engine.ts` data gate: count < 30 returns `{ skipped: true, reason: 'insufficient_data' }` |
| LEARN-07 | 09-02 | Human approval gate: new learnings start as "pending" until approved on dashboard | SATISFIED | All inserts use `status: 'pending'`; `approveLearning` server action is the only path to `status: 'approved'` |
| GOLD-01 | 09-01 | Auto-curate 90th percentile posts as golden examples per brand per platform | SATISFIED | `prompt-injector.ts` p90 calculation with three-bucket grouping |
| GOLD-02 | 09-02 | Dynamic few-shot: inject top 5 recent golden examples into generation prompts | SATISFIED | `generate.ts` `loadGoldenExamples` result (up to 5) passed to `buildSystemPrompt` as style references |
| GOLD-03 | 09-03 | Golden examples page: view, pin, unpin examples per brand | SATISFIED | `/brands/[id]/golden-examples` page with pin/unpin buttons calling server actions |

**All 10 requirements satisfied. No orphaned requirements.**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Assessment |
|------|------|---------|----------|------------|
| `src/app/actions/learnings.ts` | 18,35,52,66,83,100 | `return {}` | Info | Intentional — spec requires `{}` on success for all 6 server actions |
| `src/app/actions/generate.ts` | 386 | `buildSystemPrompt(brand)` without learnings/goldenExamples | Info | In `runRewrite()` — plan explicitly states this is correct; rewrite uses base brand voice only |

No blockers or warnings found.

---

## Human Verification Required

### 1. End-to-end learning generation flow

**Test:** Trigger `runManualAnalysis` from the learnings page for a brand with 30+ posts with engagement scores.
**Expected:** New learnings appear in the dashboard with `status=pending`, correct type/confidence/description fields, and supporting post IDs.
**Why human:** Requires live Anthropic API call with real data; can't verify AI output quality programmatically.

### 2. Prompt injection visible in generated content

**Test:** Approve one learning and one golden example for a brand, then generate content. Inspect the system prompt or generated output to confirm learning directives and style reference appear.
**Expected:** Generated post reflects approved DO/AVOID directives; style references visible in prompt (can enable logging).
**Why human:** Requires live generation with approved data in database; AI output quality and injection effect are behavioral.

### 3. Weekly cron fires at correct time

**Test:** In deployed environment, monitor logs around Sunday 2:00 AM server time.
**Expected:** `[cron] learning-engine failed:` or `[learning-engine] analyzeAllBrands complete:` log entry appears.
**Why human:** Requires production timing observation; cannot simulate cron scheduling in static analysis.

---

## Gaps Summary

No gaps found. All 19 must-have truths are verified, all 10 requirements are satisfied, and all key links are wired. The phase is functionally complete with the learning engine, prompt injection, and management UI all present and connected.

The only items flagged for human verification are behavioral (AI output quality, real-time cron execution) — not structural deficiencies.

---

## Commit Verification

All 6 implementation commits verified in git history:
- `bc20759` — feat(09-01): add isGoldenPinned + learning-engine + prompt-injector
- `1fd6076` — feat(09-01): register weekly learning cron + collectAnalytics threshold hook
- `ba219e6` — feat(09-02): inject learnings and golden examples into buildSystemPrompt
- `ec13e3b` — feat(09-02): create learnings server actions
- `3c77550` — feat(09-03): create learnings dashboard page with approval workflow
- `190a6d7` — feat(09-03): create golden examples page and add nav links to brand detail

---

_Verified: 2026-03-20_
_Verifier: Claude (gsd-verifier)_
