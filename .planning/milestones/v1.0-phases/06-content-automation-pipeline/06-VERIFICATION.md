---
phase: 06-content-automation-pipeline
verified: 2026-03-18T12:00:00Z
status: passed
score: 17/17 requirements verified
re_verification: false
---

# Phase 6: Content Automation Pipeline Verification Report

**Phase Goal:** Full autonomous content pipeline — RSS feeds to published posts with spam prevention.
**Verified:** 2026-03-18
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Feed sources track consecutive failures and auto-disable after 10 | VERIFIED | `feed-poll.ts:135-140`: increments `consecutiveFailures`, sets `enabled=0` at count>=10, logs to activityLog |
| 2 | Feed entries are deduplicated by URL (UNIQUE constraint) | VERIFIED | `schema.ts:160`: `url: text().notNull().unique()` on feedEntries; `feed-poll.ts:104-110`: UNIQUE violation caught silently |
| 3 | New feed entries receive a Haiku relevance score 1-10 | VERIFIED | `feed-poll.ts:179-285`: `scoreBatch()` calls `getModelConfig().filter` (Haiku), batch-scores up to 20 entries per poll, updates `relevanceScore` in DB |
| 4 | Spam guard enforces per-platform daily post caps | VERIFIED | `spam-guard.ts:131-136`: `PLATFORM_DAILY_CAPS` = {twitter:5,x:5,instagram:3,linkedin:2,tiktok:3}; counts today's published+scheduled posts |
| 5 | Spam guard enforces 1-hour minimum gap between same-platform posts | VERIFIED | `spam-guard.ts:138-147`: `getLastPostTime()` helper, returns blocked if diff < 60 minutes |
| 6 | Spam guard enforces warmup caps based on brand warmupDate | VERIFIED | `spam-guard.ts:104-129`: week 0 (<7 days) = 1/day cap, week 1 (7-13 days) = 2/day cap, week 2+ = no cap |
| 7 | Spam guard checks topic dedup within 48-hour window | VERIFIED | `spam-guard.ts:174-192`: checks `posts.sourceUrl` match within 48h for same brand |
| 8 | Spam guard limits link-containing posts to 30-40% of recent output | VERIFIED | `spam-guard.ts:194-213`: 7-day window, blocks if `linkRatio > 0.35` |
| 9 | Auto-generate cron picks up relevant feed entries and runs them through the full quality pipeline | VERIFIED | `auto-generate.ts:262-322`: joins feedEntries+feedSources+brands, filters relevance >= threshold, calls `generateContent()` then `refineAndGate()` |
| 10 | Automation levels route output correctly: manual=skip, semi=draft, mostly=per-platform if>=7, full=schedule if>=5 | VERIFIED | `auto-generate.ts:439-463`: `level === 'semi'` -> toDraft; `mostly` -> per-platform score>=7 schedule else draft; `full` -> score>=5 schedule else discard |
| 11 | Content mix avoids repeating same topic within 48 hours | VERIFIED | `auto-generate.ts:87-141`: `checkContentMix()` checks exact URL match + keyword overlap (>50% top-3 keywords) within 48h |
| 12 | Confidence scoring uses qualityScore to decide auto-publish vs draft | VERIFIED | `auto-generate.ts:448-463`: qualityScore from `refineAndGate()` drives routing per platform |
| 13 | Platform hashtag counts are enforced post-generation | VERIFIED | `auto-generate.ts:35-67`: `enforceHashtags()` trims excess hashtags to platform max (X:3,instagram:15,linkedin:5,tiktok:5); under-minimum not padded |
| 14 | Both poll-feeds and auto-generate crons are registered in cron.ts | VERIFIED | `cron.ts:82-99`: job 3 `*/5 * * * *` imports `pollFeeds`, job 4 `*/15 * * * *` imports `autoGenerate`; both use try/catch dynamic imports |
| 15 | User can add/configure/delete RSS feed sources | VERIFIED | `feeds.ts`: `addFeed()` with URL validation + type auto-detection, `updateFeed()` for poll interval/threshold/platforms, `deleteFeed()` with cascade |
| 16 | User can set automation level per brand | VERIFIED | `feeds.ts:182-200`: `updateAutomationLevel()` updates `brands.automationLevel`; UI in `feeds-section.tsx:99-106` with 4 button options |
| 17 | Brand detail page links to feed management | VERIFIED | `brands/[id]/page.tsx:69-71`: Feed Sources Button with Link to `/brands/${brand.id}/feeds` |

**Score:** 17/17 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/db/migrations/0006_feed_automation.sql` | 4 ALTER TABLE statements | VERIFIED | All 4 present: consecutive_failures, enabled, automation_level, feed_entry_id |
| `src/db/schema.ts` | New columns: consecutiveFailures, enabled, automationLevel, feedEntryId | VERIFIED | Lines 40, 66-67, 93 confirm all 4 columns with correct types and defaults |
| `src/lib/spam-guard.ts` | `checkSpamGuard()` with 6 enforcement checks | VERIFIED | 217 lines; exports `checkSpamGuard` and `SpamGuardResult`; all 6 rules implemented (warmup, daily cap, hour gap, stagger, topic dedup, link ratio) |
| `src/lib/feed-poll.ts` | `pollFeeds()` with mutex, RSS parsing, batch scoring, failure tracking | VERIFIED | 310 lines; exports `pollFeeds`; mutex at line 40; sequential iteration; batch Haiku scoring capped at 20; auto-disable at 10 failures |
| `next.config.ts` | `rss-parser` in serverExternalPackages | VERIFIED | Line 7 confirms rss-parser alongside better-sqlite3, node-cron, pdf-parse, openai |
| `src/lib/auto-generate.ts` | `autoGenerate()` with full orchestration | VERIFIED | 659 lines; exports `autoGenerate`; mutex, eligible query, processedAt pre-set, quality pipeline, routing, spam guard, stagger, hashtag enforcement, activity logging |
| `src/lib/cron.ts` | 5 cron jobs including feed-poll and auto-generate | VERIFIED | 102 lines; jobs 3 (`*/5`) and 4 (`*/15`) added; console.log confirms all 5 job names |
| `src/app/actions/feeds.ts` | Server actions: addFeed, updateFeed, deleteFeed, getBrandFeeds, updateAutomationLevel | VERIFIED | 201 lines; all 5 functions exported with `'use server'`; FeedWithStats type exported |
| `src/app/(dashboard)/brands/[id]/feeds/page.tsx` | Feed management page route | VERIFIED | 66 lines; server component fetching brand, feeds, accounts; passes to FeedsSection |
| `src/app/(dashboard)/brands/[id]/feeds/feeds-section.tsx` | Client component for feed management UI | VERIFIED | 460 lines (min 100 required); automation level buttons, add feed form with URL hints, FeedCard list with all controls |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `feed-poll.ts` | `src/db/schema.ts` | feedSources and feedEntries tables | WIRED | Lines 4, 51-55: imports feedSources, feedEntries; queries enabled feeds, inserts entries |
| `spam-guard.ts` | `src/db/schema.ts` | posts and brands tables | WIRED | Line 3: imports posts, postPlatforms, brands; all 6 checks query these tables |
| `feed-poll.ts` | `src/lib/ai.ts` | `getModelConfig().filter` for Haiku scoring | WIRED | Line 6: `import { getModelConfig, checkAiSpend, logAiSpend }` from `@/lib/ai`; line 192: `modelConfig.filter` used as model |
| `auto-generate.ts` | `src/app/actions/generate.ts` | `generateContent` and `refineAndGate` | WIRED | Line 14: `import { generateContent, refineAndGate }`; lines 388, 399: both called in processEntry() |
| `auto-generate.ts` | `src/lib/spam-guard.ts` | `checkSpamGuard()` before scheduling | WIRED | Line 13: `import { checkSpamGuard }`; line 523: called per platform before scheduling |
| `auto-generate.ts` | `src/app/actions/schedule.ts` | `scheduleToNextSlot()` | WIRED | Line 15: `import { scheduleToNextSlot }`; line 550: called for first platform, line 620: fallback |
| `cron.ts` | `src/lib/feed-poll.ts` | dynamic import in cron.schedule callback | WIRED | Line 84: `const { pollFeeds } = await import('./feed-poll')` |
| `cron.ts` | `src/lib/auto-generate.ts` | dynamic import in cron.schedule callback | WIRED | Line 94: `const { autoGenerate } = await import('./auto-generate')` |
| `feeds/page.tsx` | `src/app/actions/feeds.ts` | `getBrandFeeds` for data fetching | WIRED | Line 8: `import { getBrandFeeds }`; line 26: `await getBrandFeeds(brandId)` |
| `brands/[id]/page.tsx` | `feeds/` route | Navigation link to feed management | WIRED | Line 69: `<Link href={/brands/${brand.id}/feeds} />` inside Feed Sources Button |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FEED-01 | 01, 03 | User can add RSS feed sources (RSS, YouTube, subreddits, Google News) | SATISFIED | `feeds.ts:addFeed()` with type enum; `feeds-section.tsx` add form with type selector |
| FEED-02 | 03 | Per-feed config: poll interval, relevance threshold, target platforms | SATISFIED | `updateFeed()` accepts all three; FeedCard shows select controls for each |
| FEED-03 | 01 | Poll-feeds cron (every 5 min) fetches RSS, deduplicates by URL | SATISFIED | `cron.ts:82`: `*/5 * * * *`; feed-poll uses UNIQUE constraint for dedup |
| FEED-04 | 01 | Haiku relevance filter scores each entry 1-10 | SATISFIED | `feed-poll.ts:scoreBatch()` uses `getModelConfig().filter` (Haiku), returns 1-10 scores |
| FEED-05 | 01 | Entries scoring >= threshold are extracted and queued for generation | SATISFIED | Scored entries with `processedAt IS NULL` are the queue; auto-generate picks them up using `COALESCE(relevanceThreshold, 6)` |
| FEED-06 | 02 | Auto-generate cron (every 15 min) generates posts through full quality pipeline | SATISFIED | `cron.ts:92`: `*/15 * * * *`; auto-generate calls `generateContent()` + `refineAndGate()` |
| FEED-07 | 02 | Content mix management: avoid repeating same topic within 48 hours | SATISFIED | `auto-generate.ts:checkContentMix()` — exact URL match + keyword overlap check |
| FEED-08 | 02, 03 | User can configure automation level per brand: manual, semi, mostly, full | SATISFIED | `updateAutomationLevel()` in feeds.ts; 4-button UI in feeds-section.tsx |
| FEED-09 | 02 | Confidence scoring determines auto-publish vs queue for review | SATISFIED | qualityScore from refineAndGate drives routing: semi=always draft, mostly=per-platform>=7, full=per-platform>=5 |
| FEED-10 | 01 | Feed auto-disables after 10 consecutive failures | SATISFIED | `feed-poll.ts:135`: `if (newFailureCount >= 10)` sets `enabled: 0` |
| SPAM-01 | 01 | Per-platform daily post caps (X: 3-5, Instagram: 1-3, LinkedIn: 1-2, TikTok: 1-3) | SATISFIED | Implementation uses upper-range values: X=5, instagram=3, linkedin=2, tiktok=3 — all within specified ranges |
| SPAM-02 | 01 | Minimum 1 hour gap between posts on same platform | SATISFIED | `spam-guard.ts:138-147`: blocks if last post < 60 minutes ago |
| SPAM-03 | 01, 02 | Cross-platform staggering: same source content spaced 30-60 min apart | SATISFIED | spam-guard.ts blocks same sourceUrl within 60 min; auto-generate.ts adds 30-60 min random offset for subsequent platforms |
| SPAM-04 | 01 | New account warmup: Week 1 = 1/day, Week 2 = 2/day, Week 3+ = normal | SATISFIED | `spam-guard.ts:104-129`: warmupDate-based calculation; week 0 (<7 days)=1, week 1 (7-13 days)=2, week 2+=null |
| SPAM-05 | 01 | Topic deduplication within configurable window (default 48 hours) | SATISFIED | `spam-guard.ts:174-192`: 48-hour window check on sourceUrl for same brand |
| SPAM-06 | 01 | Max 30-40% of posts contain links | SATISFIED | `spam-guard.ts:194-213`: `linkRatio > 0.35` (35%) blocks new link posts |
| SPAM-07 | 02 | Platform-appropriate hashtag counts (X: 0-3, Instagram: 5-15, LinkedIn: 3-5) | SATISFIED | `auto-generate.ts:20-67`: HASHTAG_LIMITS with correct ranges; enforceHashtags trims excess |

All 17 requirements (FEED-01 through FEED-10, SPAM-01 through SPAM-07) are covered. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/actions/feeds.ts` | 93-96 | `updateFeed` calls `.update().set().where()` without `.run()` | Info | Not a bug — matches established project pattern (brands.ts line 111-135 is identical). Drizzle with better-sqlite3 executes on await; `.run()` is optional |

No TODO/FIXME/placeholder patterns found in phase 6 files. No stubs. No empty return values.

---

### Behavioral Deviations from Plan (Non-Blocking)

**`mostly` level routing:** The plan specified "if ALL platform qualityScores >= 7, auto-schedule" (all-or-nothing). The implementation routes each platform independently: score >= 7 schedules, score < 7 drafts. This is superior behavior (avoids discarding high-quality platforms because one platform failed) and fully satisfies FEED-09's intent.

**Human verification (Plan 04):** Was skipped per user request (user cannot access local dev server). 06-04-SUMMARY.md notes "verification deferred to deployment on Railway." All automated checks pass.

---

### Human Verification Required

The following items require runtime testing and cannot be verified statically:

#### 1. Full Pipeline End-to-End

**Test:** Add a valid RSS feed (e.g., `https://hnrss.org/newest?count=5`), set automation level to `semi`, wait up to 5 minutes for poll-feeds cron, then 15 minutes for auto-generate cron.
**Expected:** New posts appear as drafts in the posts list with feedEntryId populated.
**Why human:** Requires live cron execution, real RSS network access, and Anthropic API calls.

#### 2. Spam Guard Runtime Enforcement

**Test:** With a brand that has posts today equal to the platform cap, trigger auto-generate.
**Expected:** Activity log shows spam guard blocked with reason `daily cap N/day for platform`.
**Why human:** Requires real database state and live cron execution.

#### 3. Feed Auto-Disable After 10 Failures

**Test:** Add an invalid feed URL (e.g., `https://httpstat.us/500`), observe consecutive_failures increment across 10 poll cycles.
**Expected:** Feed becomes disabled in the UI after 10 failures.
**Why human:** Requires waiting for 10 x 5-minute cron ticks (50 minutes) or direct DB manipulation.

#### 4. Feed Management UI Interaction

**Test:** Navigate to /brands/[id]/feeds, add a feed, change automation level, edit poll interval and threshold.
**Expected:** Changes persist on page refresh; feed list shows correct status, entry counts, and failure counts.
**Why human:** Visual/interactive behavior cannot be verified statically.

---

### Gaps Summary

No gaps found. All 17 requirements are implemented and wired correctly.

The phase delivers the complete automation pipeline:
- Schema migration providing 4 new columns (✓)
- Spam guard with 6 enforcement rules (✓)
- Feed polling with RSS parsing, Haiku scoring, and auto-disable (✓)
- Auto-generate orchestration with quality pipeline, automation level routing, and spam guard integration (✓)
- Two new cron jobs registered (✓)
- Feed management UI with CRUD, per-feed config, and automation level selector (✓)
- Brand detail page navigation link (✓)

---

_Verified: 2026-03-18_
_Verifier: Claude (gsd-verifier)_
