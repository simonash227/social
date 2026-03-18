---
phase: 07-analytics-dashboard-polish
verified: 2026-03-18T10:00:00Z
status: human_needed
score: 8/8 must-haves verified
re_verification: false
human_verification:
  - test: "Run validation script locally — npx tsx scripts/validate-analytics.ts"
    expected: "All 11 test cases print [PASS], process exits 0"
    why_human: "Cannot execute TypeScript scripts in this verification context"
  - test: "Visit http://localhost:3000/ after npm run dev"
    expected: "Cross-brand home shows brand cards with published count, avg engagement, next scheduled post, plus weekly digest section with posts published count and total engagement score"
    why_human: "Visual rendering and real-data queries require live server"
  - test: "Visit http://localhost:3000/activity"
    expected: "Activity log renders entries in reverse chronological order. Selecting a brand/level/type from the dropdowns updates the URL and filters the list. Error-level entries have red-tinted background (border-destructive/40 bg-destructive/5)"
    why_human: "Filter interactivity and visual error highlighting require live browser"
  - test: "Visit http://localhost:3000/brands/{id} for any existing brand"
    expected: "Quick Stats section (4 cards: Published, Scheduled, Avg Engagement, Top Tier Posts) appears between the header and Brand Identity. Recent Posts section appears before Danger Zone showing last 5 posts with status badge, platform badges, and engagement score. Analytics button present in header"
    why_human: "Layout order and real-data rendering require live server"
  - test: "Click Analytics button on brand detail page"
    expected: "Navigates to /brands/{id}/analytics. Page shows Overall stats cards, Per Platform breakdown with tier distribution badges, and Top Performers list with views/likes/comments/shares. If no data collected yet, shows empty-state message about cron schedule"
    why_human: "Navigation and conditional empty-state rendering require live browser"
  - test: "Check server console after hitting http://localhost:3000/api/health"
    expected: "Console shows '[cron] Jobs registered (publish, backup, ai-spend-summary, feed-poll, auto-generate, collect-analytics)' confirming the analytics cron is registered"
    why_human: "Server-side console output requires live server"
---

# Phase 7: Analytics Collection + Dashboard Verification Report

**Phase Goal:** Collect engagement metrics and build the dashboard for monitoring the engine.
**Verified:** 2026-03-18
**Status:** human_needed — All automated checks pass. 6 items require live-server confirmation.
**Re-verification:** No — initial verification.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Analytics cron collects metrics from Upload-Post for posts published 48h+ ago | VERIFIED | `collect-analytics.ts` lines 97-119: threshold48h computed, JOIN filters `posts.status='published'`, `lte(posts.publishedAt, threshold48h)`, `postPlatforms.status='published'`, `isNotNull(postPlatforms.requestId)` |
| 2 | Engagement score is computed with division-by-zero guard when views=0 | VERIFIED | `collect-analytics.ts` lines 54-55: `const views = metrics.views ?? 0; if (views === 0) return 0` |
| 3 | Posts are classified as top/average/under relative to brand+platform cohort | VERIFIED | `collect-analytics.ts` lines 241-301: cohort loop with `affectedCohorts`, p25/p75 percentile calc, `classifyTier()` applied per row. Cohort < 4 defaults to 'average'. Zero-score posts classified as 'under' |
| 4 | Cross-brand home shows brand cards with published count, avg engagement, next scheduled post | VERIFIED | `page.tsx` (home): 217 lines, async queries for `publishedCount`, `avgEngagement`, `nextScheduledAt` per brand; grid of cards rendered at lines 169-213 |
| 5 | Weekly digest section on home shows posts published and total engagement this week | VERIFIED | `page.tsx` (home): `weeklyPublishedCount` (line 27), `weeklyEngagement` (line 36) computed from `postAnalytics.collectedAt >= sevenDaysAgo`; rendered in "This Week" section lines 101-154 |
| 6 | Brand detail page shows quick stats and recent posts with status and engagement | VERIFIED | `brands/[id]/page.tsx`: 477 lines, Quick Stats 4-card grid (lines 173-209), Recent Posts section (lines 420-462) with status badge, platform badges, engagement score, date |
| 7 | Activity log page is scrollable, filterable by brand/type/level, errors highlighted | VERIFIED | `activity/page.tsx`: 141 lines, searchParams filters build drizzle `and(...conditions)`, `ActivityFilters` client component with 3 select dropdowns, error rows use `border-destructive/40 bg-destructive/5` at line 95 |
| 8 | Per-brand analytics page shows posts published and basic engagement metrics | VERIFIED | `brands/[id]/analytics/page.tsx`: 244 lines, overall stats + per-platform breakdown + top 5 performers with views/likes/comments/shares; empty state for no-data case at lines 116-123 |

**Score: 8/8 truths verified**

---

### Required Artifacts

| Artifact | Expected | Lines | Status | Details |
|----------|----------|-------|--------|---------|
| `src/db/schema.ts` | postAnalytics table definition | 204 | VERIFIED | Lines 178-191: `post_analytics` table with all 11 required columns including `engagement_score`, `performer_tier`, `collected_at`, `created_at` |
| `src/lib/collect-analytics.ts` | collectAnalytics() + calcEngagementScore() + classifyTier() | 317 | VERIFIED | All three exports present; mutex guard, 48h window, null-requestId skip, post_metrics_error handling, two-pass tier reclassification |
| `src/lib/cron.ts` | Analytics cron at 6h interval | 112 | VERIFIED | Line 102: `cron.schedule('0 */6 * * *', ...)` with dynamic import of `collect-analytics` and `collectAnalytics()` call |
| `scripts/validate-analytics.ts` | 11 test cases for scoring and tier classification | 115 | VERIFIED | 6 calcEngagementScore tests (including views=0, views=null, cap at 100) + 5 classifyTier tests (including p25/p75 boundary conditions) |
| `src/db/migrations/0007_post_analytics.sql` | Migration SQL for post_analytics table | 14 | VERIFIED | Creates `post_analytics` table with all required columns and FK to posts |
| `src/app/(dashboard)/page.tsx` | Cross-brand home with real brand cards + weekly digest | 217 | VERIFIED | 217 lines (min_lines: 60 satisfied); async queries, weekly digest section, brand cards grid |
| `src/app/(dashboard)/activity/page.tsx` | Activity log with filters and error highlighting | 141 | VERIFIED | 141 lines (min_lines: 50 satisfied); activityLog query with searchParams filters, error row highlighting |
| `src/app/(dashboard)/brands/[id]/page.tsx` | Brand detail with quick stats + recent posts | 477 | VERIFIED | 477 lines (min_lines: 100 satisfied); postAnalytics joined for stats, recent posts with engagement |
| `src/app/(dashboard)/brands/[id]/analytics/page.tsx` | Per-brand analytics with engagement metrics | 244 | VERIFIED | 244 lines (min_lines: 50 satisfied); full platform breakdown, tier distribution, top performers table |
| `src/app/(dashboard)/activity/activity-filters.tsx` | Client component for filter dropdowns | 91 | VERIFIED | 'use client', useSearchParams + router.push, 3 select dropdowns (brand/level/type), totalCount display |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/collect-analytics.ts` | Upload-Post API | `fetch GET /api/uploadposts/post-analytics/{requestId}` | WIRED | Line 27-30: `fetch('https://api.upload-post.com/api/uploadposts/post-analytics/${requestId}', { headers: ... })` with response parsed and used |
| `src/lib/collect-analytics.ts` | `src/db/schema.ts` | drizzle insert/update postAnalytics | WIRED | Lines 183-218: SELECT check then UPDATE or INSERT to `postAnalytics`; all schema columns populated |
| `src/lib/cron.ts` | `src/lib/collect-analytics.ts` | dynamic import in cron.schedule callback | WIRED | Line 104: `const { collectAnalytics } = await import('./collect-analytics')` then `await collectAnalytics()` |
| `src/app/(dashboard)/page.tsx` | `src/db/schema.ts` | drizzle aggregate queries on posts, postAnalytics, brands | WIRED | Lines 3-4 import, lines 46-50 postAnalytics.innerJoin(posts), per-brand avg engagement via joined query |
| `src/app/(dashboard)/activity/page.tsx` | `src/db/schema.ts` | drizzle query on activityLog with searchParams filters | WIRED | Lines 2, 45-58: activityLog selected with dynamic `and(...conditions)` built from searchParams |
| `src/app/(dashboard)/brands/[id]/analytics/page.tsx` | `src/db/schema.ts` | drizzle join posts+postAnalytics filtered by brandId | WIRED | Lines 4-5 import, lines 31-48: `postAnalytics.innerJoin(posts, ...).where(eq(posts.brandId, brandId))` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ANLY-01 | 07-01 | Collect-analytics cron every 6 hours fetches metrics from Upload-Post | SATISFIED | `cron.ts` line 102 registers `'0 */6 * * *'`; `collect-analytics.ts` `collectAnalytics()` fetches from Upload-Post API |
| ANLY-02 | 07-01 | Normalized engagement score with impressions=0 guard | SATISFIED | `calcEngagementScore()` line 55: `if (views === 0) return 0`; validation script tests views=0 and views=null cases |
| ANLY-03 | 07-01 | Classify posts top/average/underperformer per brand per platform cohort | SATISFIED | `classifyTier()` + two-pass cohort loop in `collectAnalytics()`; p25/p75 percentile; cohort minimum of 4 |
| ANLY-04 | 07-02 | Per-brand analytics page showing posts published and basic engagement metrics | SATISFIED | `brands/[id]/analytics/page.tsx`: overall stats, per-platform breakdown, top performers with raw metrics |
| DASH-01 | 07-02 | Cross-brand home: brand cards with stats, engagement trend, next scheduled post | SATISFIED | `page.tsx` (home): brand cards grid with published count, avg engagement, next scheduled datetime |
| DASH-02 | 07-02 | Brand home page: quick stats, recent posts with status + engagement | SATISFIED | `brands/[id]/page.tsx`: 4-stat Quick Stats section + Recent Posts with status badge, platform badges, engagement score |
| DASH-03 | 07-02 | Activity log page: scrollable, filterable by brand/type/level, errors highlighted | SATISFIED | `activity/page.tsx` + `activity-filters.tsx`: brand/level/type filters via searchParams; error rows styled distinctly |
| DASH-05 | 07-02 | Weekly digest data displayed on dashboard home | SATISFIED | `page.tsx` (home): "This Week" section with posts published count, total engagement score, top performer card |

**All 8 requirements claimed by plans are satisfied. No orphaned requirements for Phase 7 found in REQUIREMENTS.md traceability table.**

Note: DASH-04 (dashboard shell) is mapped to Phase 1 in REQUIREMENTS.md — it is not a Phase 7 requirement and was correctly excluded from all Phase 7 plans.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scan of all Phase 7 key files found no TODO/FIXME/placeholder comments, no empty `return null` or `return {}` implementations, and no stub handlers. All functions have substantive implementations.

One minor observation: `collect-analytics.ts` line 170 always uses `platforms[0]` to identify the postPlatform entry when matching a platform result from the API response. If a single requestId maps to multiple postPlatform entries (e.g., the same request published to multiple platforms), only the first entry's postId is used for the upsert. This is a design choice documented in 07-01-SUMMARY.md ("requestId mapped one-to-one") and is not a functional defect for the current data model.

---

### Human Verification Required

The following items cannot be verified without a running server. All automated code checks pass.

#### 1. Validation Script Execution

**Test:** Run `npx tsx scripts/validate-analytics.ts` from project root
**Expected:** All 11 test cases print `[PASS]`, summary shows "11 passed, 0 failed", process exits 0
**Why human:** Cannot execute TypeScript scripts in this verification context

#### 2. Cross-Brand Home Page Renders Real Data

**Test:** Start dev server (`npm run dev`), visit `http://localhost:3000/`
**Expected:** Dashboard header "Your content engine at a glance". "This Week" section with 3 cards: posts published count, total engagement, top performer. Brand cards grid below with per-brand stats. If no brands, shows "Create your first brand" CTA
**Why human:** Visual rendering and database query results require live server

#### 3. Activity Log Filters Work End-to-End

**Test:** Visit `http://localhost:3000/activity`. Change brand, level, or type dropdown
**Expected:** URL updates with query params (`?brand=X&level=Y`), list filters without full page reload. Error entries show red-tinted background. Entry count updates in top-right
**Why human:** Client-side filter state and URL manipulation require live browser

#### 4. Brand Detail Quick Stats and Recent Posts

**Test:** Visit `http://localhost:3000/brands/{id}` for an existing brand
**Expected:** "Quick Stats" section with 4 cards appears between the header buttons and "Brand Identity" section. "Recent Posts" section appears before "Danger Zone". "Analytics" button visible in header button row
**Why human:** Layout order and populated data require live server

#### 5. Per-Brand Analytics Page

**Test:** Click "Analytics" button on a brand detail page
**Expected:** Navigates to `/brands/{id}/analytics`. Shows `{Brand Name} Analytics` heading with back link. If analytics data exists: Overall stats (4 cards), By Platform section, Top Performers list with metrics rows. If no data: "No analytics data collected yet" message explaining the cron schedule
**Why human:** Navigation and conditional rendering require live browser

#### 6. Analytics Cron Registered on Server Start

**Test:** Start server, hit `http://localhost:3000/api/health`, check server console
**Expected:** Server console prints: `[cron] Jobs registered (publish, backup, ai-spend-summary, feed-poll, auto-generate, collect-analytics)`
**Why human:** Server-side console output requires live server

---

### Gaps Summary

No gaps found. All 8 must-have truths are verified against the actual codebase. All 10 required artifacts exist with substantive implementations. All 6 key links are wired end-to-end. All 8 requirement IDs (ANLY-01 through ANLY-04, DASH-01 through DASH-03, DASH-05) are satisfied by the implemented code.

The phase goal — "Collect engagement metrics and build the dashboard for monitoring the engine" — is achieved:
- The collection backend (`collect-analytics.ts`) is fully implemented with 48h eligibility window, engagement scoring, cohort-based tier classification, and 6-hour cron registration
- All four dashboard pages (`/`, `/activity`, `/brands/[id]`, `/brands/[id]/analytics`) are substantive server components querying real data from SQLite via drizzle

Human verification is flagged for standard live-server testing (script execution, visual rendering, filter interactivity) rather than for any suspected defects in the code.

---

_Verified: 2026-03-18_
_Verifier: Claude (gsd-verifier)_
