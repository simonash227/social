---
phase: 06-content-automation-pipeline
plan: "02"
subsystem: backend-automation
tags: [auto-generate, cron, quality-pipeline, spam-guard, automation-routing, hashtag-enforcement]
dependency_graph:
  requires: [06-01]
  provides: [auto-generate, cron-feed-poll, cron-auto-generate]
  affects: [src/lib/auto-generate.ts, src/lib/cron.ts]
tech_stack:
  added: []
  patterns: [globalThis-mutex, content-dedup, automation-level-routing, cross-platform-stagger]
key_files:
  created:
    - src/lib/auto-generate.ts
  modified:
    - src/lib/cron.ts
decisions:
  - "processedAt set BEFORE generation (not after) to prevent double-pick on overlapping cron ticks"
  - "saveAsAutoPost() is a non-server-action helper in auto-generate.ts; does not call redirect() or revalidatePath()"
  - "generateContent() and refineAndGate() imported directly from actions/generate.ts -- safe since they use no server-action-only APIs besides the 'use server' directive"
  - "Cross-platform stagger uses 30-60 min random offset added to first-platform scheduledAt (avoids separate scheduling slots per platform)"
  - "Keyword overlap check uses top-3 words >4 chars from entry title against recent post content+sourceText concatenation"
  - "Discarded platforms (quality gate failed) logged to activityLog but never saved as draft or scheduled"
metrics:
  duration_minutes: 6
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 6 Plan 2: Auto-Generate Orchestration Module Summary

Auto-generate cron module that consumes queued feed entries through the full quality pipeline (generateContent + refineAndGate), routes output by automation level (semi/mostly/full), enforces spam guard + cross-platform stagger, trims excess hashtags, and logs all outcomes to activityLog. Both feed-poll (5 min) and auto-generate (15 min) cron jobs wired into cron.ts.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Auto-generate module with automation level routing | 2cdb9a3 | src/lib/auto-generate.ts |
| 2 | Wire poll-feeds and auto-generate crons into cron.ts | 6829292 | src/lib/cron.ts |

## What Was Built

### Auto-Generate Module (src/lib/auto-generate.ts)

`autoGenerate()` exported function with full orchestration pipeline:

**Mutex guard:** `globalThis.__autoGenerateRunning` prevents overlapping 15-min cron ticks.

**Eligible entry query:** Joins feedEntries → feedSources → brands. Filters:
- `relevanceScore IS NOT NULL` (Haiku-scored)
- `processedAt IS NULL` (not yet processed)
- `automationLevel != 'manual'` (skip manual brands)
- `relevanceScore >= COALESCE(relevanceThreshold, 6)`
- Limit 5 per run to avoid context exhaustion

**Critical: processedAt set BEFORE generation** to prevent double-pick when cron ticks overlap.

**Content mix dedup (`checkContentMix`):** Two checks before generating:
1. Exact URL match in posts for same brand within 48h
2. Keyword overlap: top-3 keywords (>4 chars) from entry title vs recent post content; >50% match = skip

**Content extraction:** `extractFromUrl()` with graceful degradation (continues with URL-only context if extraction fails).

**Platform determination:** Uses feedSource.targetPlatforms; falls back to connected socialAccounts.

**Quality pipeline:** `generateContent()` → `refineAndGate()` -- imported directly (no server-action-only APIs used internally).

**Hashtag enforcement (`enforceHashtags`):**
- Platform limits: X/twitter=0-3, instagram=5-15, linkedin=3-5, tiktok=3-5
- Over max: trims hashtags from end of content
- Under min: no action (adding random hashtags = spam)

**Automation level routing:**
- `semi`: All non-discarded platforms → draft
- `mostly`: score >= 7 → schedule; score < 7 (non-discarded) → draft; discarded = skip
- `full`: score >= 5 → schedule; score < 5 → discard

**Spam guard + scheduling (`checkSpamGuard`):** Called per platform before scheduling. Blocked platforms saved as draft with reason logged.

**Cross-platform stagger:** Second+ platform gets 30-60 min random offset from first platform's scheduledAt.

**`saveAsAutoPost()` helper:** Inserts post + postPlatforms with feedEntryId for traceability. No redirect/revalidatePath calls (cron context).

**Activity logging:** Every outcome logged to activityLog with type='auto_generate' -- draft saved, scheduled, discarded, spam-blocked, skipped (dedup), extraction failed.

### Cron Registration (src/lib/cron.ts)

Two new cron jobs added to `initCron()`:
- **Job 3:** `*/5 * * * *` → `pollFeeds()` (dynamic import, try/catch)
- **Job 4:** `*/15 * * * *` → `autoGenerate()` (dynamic import, try/catch)

Console log updated: `"[cron] Jobs registered (publish, backup, ai-spend-summary, feed-poll, auto-generate)"`

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: src/lib/auto-generate.ts (autoGenerate exported, mutex, routing, spam guard, stagger)
- FOUND: src/lib/cron.ts (5 cron jobs, feed-poll + auto-generate entries)
- TypeScript: `npx tsc --noEmit` passes with zero errors
- Build: `npx next build` shows "Compiled successfully"
- FOUND: commit 2cdb9a3 (Task 1)
- FOUND: commit 6829292 (Task 2)
