---
phase: 11-multi-variant-generation
verified: 2026-03-20T05:30:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 11: Multi-Variant Generation Verification Report

**Phase Goal:** Brands with multi-variant enabled generate 3 content variants per post; the quality gate scores all three and picks the winner; cost is bounded by the daily AI spend limit
**Verified:** 2026-03-20T05:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | When enableVariants is on and spend is under limit, auto-generation produces 3 variants at different temperatures and picks the highest-scoring one | VERIFIED | `processEntry()` branches on `brand.enableVariants === 1` and `checkAiSpend()`, then calls `generateVariants()` which runs `Promise.all(TEMPERATURES.map(...))` at 0.7/0.85/1.0, scores each via `runCritique()`, sorts descending, returns index 0 as winner |
| 2 | When enableVariants is on but spend limit is reached, auto-generation falls back to single-variant with an activity log warning | VERIFIED | `auto-generate.ts:402-403` — `if (!underLimit)` branch calls `logActivity(brandId, 'warn', 'Multi-variant skipped: daily spend limit reached...')` then falls through to existing pipeline |
| 3 | Brand settings page shows a multi-variant toggle with cost estimate text when enabled | VERIFIED | `brand-form.tsx:364-382` — hidden input, Switch component with controlled `enableVariants` state, amber cost estimate paragraph rendered only when `enableVariants === true` |
| 4 | Loser variants are saved as draft posts linked to the winner via variantOf and variantGroup | VERIFIED | `auto-generate.ts:496-511` — `saveAsAutoPost({ status: 'draft', variantGroup, variantOf: winnerId })` called for each loser in `variantResult.losers` loop |
| 5 | Post detail page shows the post's content, quality score, status, platforms, and creation date | VERIFIED | `posts/[postId]/page.tsx` — renders status badge, quality score (`${post.qualityScore}/10`), platform badges from `postPlatforms`, formatted `createdAt`, full content with `whitespace-pre-wrap` |
| 6 | When a post has a variantGroup, runner-up variants are shown in a collapsible section with their scores | VERIFIED | `posts/[postId]/page.tsx:172-200` — `<details>/<summary>` collapsible rendered when `post.variantGroup != null && runnerUps.length > 0`, runner-ups sorted by `qualityScore` descending |
| 7 | Recent posts on the brand detail page are clickable links to the post detail page | VERIFIED | `brands/[id]/page.tsx:448-451` — `<Link href={/brands/${brand.id}/posts/${post.id}}>` with hover state; `isNull(posts.variantOf)` filter applied at line 78 |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/variant-generator.ts` | generateVariants() orchestrating 3 Haiku calls + 3 runCritique calls | VERIFIED | 183 lines. Exports `generateVariants`, `GenerateVariantsResult`, `VariantResult`. Concurrent `Promise.all` at temperatures 0.7/0.85/1.0, scores via `runCritique()`, returns sorted winner+losers. |
| `src/lib/auto-generate.ts` | Modified processEntry() branching on enableVariants, extended AutoPostInput with variant fields | VERIFIED | `AutoPostInput` extended with `variantGroup?: string \| null` and `variantOf?: number \| null` (lines 154-155). `saveAsAutoPost()` inserts both fields (lines 193-194). `processEntry()` has full variant branching at lines 393-519. |
| `src/app/actions/generate.ts` | Exported runCritique for reuse by variant-generator | VERIFIED | `runCritique`, `buildSystemPrompt`, `buildGenerationPrompt`, `parseJsonResponse`, `calculateCostUsd`, `getAnthropic`, `GeneratedContent`, `CritiqueResult`, `BrandRow` all exported. Variant-generator imports and calls them. |
| `src/components/brand-form.tsx` | enableVariants Switch toggle in Settings tab with cost estimate | VERIFIED | `useState(brand?.enableVariants === 1)` at line 30-32. Switch at lines 366-370, hidden input at line 364, amber cost estimate at lines 376-379. |
| `src/app/actions/brands.ts` | updateBrand parsing enableVariants from formData | VERIFIED | Lines 98-99 parse `enableVariants` from formData. Line 130 includes it in `db.update(brands).set({...})`. |
| `src/app/(dashboard)/brands/[id]/posts/[postId]/page.tsx` | Post detail page with variant display | VERIFIED | 203 lines. Server component. Validates brand ownership (404 on mismatch). Collapsible runner-ups section. Runner-up notice with link to winner. |
| `src/app/(dashboard)/brands/[id]/page.tsx` | Recent posts wrapped in Link components pointing to post detail | VERIFIED | Link wrapping at line 448-451, `isNull(posts.variantOf)` filter at line 78. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/auto-generate.ts` | `src/lib/variant-generator.ts` | `import generateVariants` | WIRED | Dynamic import at line 406: `const { generateVariants } = await import('@/lib/variant-generator')`. Called with `await generateVariants(brandId, platforms, sourceText, entryUrl)` at line 407. |
| `src/lib/variant-generator.ts` | `src/app/actions/generate.ts` | `import runCritique` | WIRED | Static import at lines 6-14. `runCritique()` called at line 155 for each scored variant. |
| `src/lib/auto-generate.ts` | `src/lib/ai.ts` | `checkAiSpend before variant path` | WIRED | Dynamic import at line 399: `const { checkAiSpend } = await import('@/lib/ai')`. Result used at line 402 to gate variant path. |
| `src/components/brand-form.tsx` | `src/app/actions/brands.ts` | `hidden input enableVariants submitted to updateBrand` | WIRED | Hidden input at line 364 submits `'1'/'0'`. `updateBrand()` reads it at line 98-99 and writes to DB at line 130. |
| `src/app/(dashboard)/brands/[id]/page.tsx` | `src/app/(dashboard)/brands/[id]/posts/[postId]/page.tsx` | `Link href to /brands/{id}/posts/{postId}` | WIRED | `href={/brands/${brand.id}/posts/${post.id}}` at line 450, routing to the `[postId]` page file. |
| `src/app/(dashboard)/brands/[id]/posts/[postId]/page.tsx` | `src/db/schema.ts` | `Query posts by id, query runner-ups by variantGroup` | WIRED | `eq(posts.variantGroup, post.variantGroup)` and `isNotNull(posts.variantOf)` at lines 56-59 of the page. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MVAR-01 | 11-01-PLAN.md | Generate 3 content variants per post using Haiku; quality gate (Sonnet) picks winner | SATISFIED | `variant-generator.ts` calls Haiku 3x at different temperatures, `runCritique` scores each, winner is highest scorer |
| MVAR-02 | 11-01-PLAN.md | Per-brand toggle: enable/disable multi-variant generation (default off) | SATISFIED | `brand-form.tsx` Switch toggle, `brands.ts` persists `enableVariants` to DB, schema default is 0 |
| MVAR-03 | 11-02-PLAN.md | Store all variants with scores; show winning variant and runner-ups on post detail | SATISFIED | Losers stored with `variantOf` + `variantGroup` and `qualityScore`; post detail page renders runner-ups in collapsible with scores |
| MVAR-04 | 11-01-PLAN.md | Cost guard: multi-variant respects daily AI spend limit (3x cost per post) | SATISFIED | `checkAiSpend()` called before variant path; `!underLimit` branch logs warning and falls through to single-variant |

All 4 requirements declared across plans are covered. No orphaned requirements found for Phase 11.

### Anti-Patterns Found

No blockers or significant warnings found. Notes:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/variant-generator.ts` | 151 | `let qualityScore = 5 // default if critique fails` | Info | If `runCritique` throws, variant gets a default score of 5/10. This is documented fallback behavior, not a stub — partial failure is handled gracefully per plan. |
| `src/lib/auto-generate.ts` | 123-127 | `console.error` for individual Haiku failures | Info | Errors are logged to console only (not to activity log). Acceptable for a library function called from processEntry which does log to activity. |

### Human Verification Required

#### 1. Multi-variant toggle visibility in brand settings UI

**Test:** Navigate to Settings tab in brand edit form. Confirm Switch component renders, toggle it on, confirm amber cost estimate text appears. Toggle off, confirm amber text disappears.
**Expected:** Toggle is visible, interactive, and cost estimate renders conditionally.
**Why human:** Cannot verify React controlled-state rendering programmatically.

#### 2. Runner-up collapsible behavior on post detail

**Test:** Create a post via multi-variant path. Open the post detail page for the winning post. Confirm "Runner-up Variants (N)" collapsible is present. Click to expand. Confirm runner-up content and scores render correctly.
**Expected:** Collapsible opens and shows runner-up content sorted by score descending.
**Why human:** `<details>/<summary>` expansion behavior and data accuracy require browser testing.

#### 3. End-to-end variant pipeline (integration)

**Test:** Enable multi-variant on a brand, trigger auto-generate for an eligible feed entry. Verify 3 posts appear in DB (1 winner + 2 losers with `variantOf` set), the winner post shows runner-ups on its detail page.
**Expected:** Winner post created with `variantGroup`, 2 draft losers with `variantOf = winnerId`.
**Why human:** Requires live AI API call (Haiku + Sonnet), real DB write, and full pipeline execution.

### Gaps Summary

No gaps. All 7 observable truths are verified, all artifacts are substantive and wired, all 4 requirements are satisfied, and TypeScript compiles cleanly (`npx tsc --noEmit` produces no output).

---

_Verified: 2026-03-20T05:30:00Z_
_Verifier: Claude (gsd-verifier)_
