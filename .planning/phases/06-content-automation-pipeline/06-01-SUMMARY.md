---
phase: 06-content-automation-pipeline
plan: "01"
subsystem: backend-automation
tags: [schema, migration, spam-guard, feed-polling, rss, haiku, drizzle]
dependency_graph:
  requires: []
  provides: [spam-guard, feed-poll, schema-migration-0006]
  affects: [src/db/schema.ts, src/lib/spam-guard.ts, src/lib/feed-poll.ts, next.config.ts]
tech_stack:
  added: [rss-parser]
  patterns: [globalThis-mutex, circuit-breaker, batch-haiku-scoring, drizzle-alter-table]
key_files:
  created:
    - src/db/migrations/0006_feed_automation.sql
    - src/db/migrations/meta/0005_snapshot.json
    - src/db/migrations/meta/0006_snapshot.json
    - src/lib/spam-guard.ts
    - src/lib/feed-poll.ts
  modified:
    - src/db/schema.ts
    - src/db/migrations/meta/_journal.json
    - src/db/migrations/meta/0003_snapshot.json
    - src/db/migrations/meta/0004_snapshot.json
    - next.config.ts
    - package.json
decisions:
  - "rss-parser added to serverExternalPackages (Node.js-only module, same pattern as openai/node-cron)"
  - "drizzle snapshot lineage repaired: 0003/0004 prevId collision fixed, 0005/0006 snapshots manually created"
  - "Haiku pricing hardcoded for cost logging ($0.25/1M input, $1.25/1M output)"
  - "feedEntries.id forward reference in posts table is valid -- arrow function thunk evaluated lazily at runtime"
metrics:
  duration_minutes: 10
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_created: 5
  files_modified: 6
---

# Phase 6 Plan 1: Schema Migration + Spam Guard + Feed Polling Summary

Backend foundation for content automation: SQLite migration adding 4 columns, spam guard enforcing 6 scheduling rules, and RSS feed poller with batch Haiku relevance scoring and consecutive-failure auto-disable.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Schema migration + spam guard module | 9c99fca | 0006_feed_automation.sql, schema.ts, spam-guard.ts, meta/*.json |
| 2 | Feed polling module with Haiku relevance scoring | ba5af7f | feed-poll.ts, next.config.ts, package.json |

## What Was Built

### Migration (0006_feed_automation.sql)
Four ALTER TABLE statements:
- `feed_sources.consecutive_failures` (integer, default 0, NOT NULL)
- `feed_sources.enabled` (integer, default 1, NOT NULL)
- `brands.automation_level` (text, default 'manual', nullable)
- `posts.feed_entry_id` (integer FK to feed_entries.id, nullable)

### Schema Updates (schema.ts)
Drizzle columns matching the migration, with proper enum for automationLevel (`manual | semi | mostly | full`).

### Spam Guard (src/lib/spam-guard.ts)
`checkSpamGuard(brandId, platform, sourceUrl?)` enforces 6 rules in order:
1. **SPAM-04 Warmup cap**: week 0 = 1/day, week 1 = 2/day, week 2+ = unlimited
2. **SPAM-01 Daily platform cap**: twitter/x=5, instagram=3, linkedin=2, tiktok=3
3. **SPAM-02 1-hour minimum gap**: checks most recent scheduledAt or publishedAt
4. **SPAM-03 Cross-platform stagger**: same sourceUrl within 60 min blocks new platform
5. **SPAM-05 Topic dedup**: same sourceUrl within 48 hours blocks reuse
6. **SPAM-06 Link ratio**: >35% link posts in last 7 days blocks new link posts

Both `published` and `scheduled` posts count toward caps (prevents over-scheduling).

### Feed Polling (src/lib/feed-poll.ts)
`pollFeeds()` with:
- `globalThis.__feedPollRunning` mutex (same pattern as publishDuePosts)
- Sequential feed iteration (no Promise.all)
- UNIQUE constraint on URL handles deduplication natively
- Batch Haiku scoring: up to 20 new entries per poll, single API call
- Circuit breaker wrapping Anthropic calls
- `consecutiveFailures` incremented per failure; `enabled=0` set at count>=10
- Activity log entries for failures and auto-disable events
- `checkAiSpend()` guard before scoring; parse failures are non-fatal

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Drizzle migration snapshot lineage collision**
- **Found during:** Task 1 (running `npx drizzle-kit generate`)
- **Issue:** `0003_snapshot.json` was manually created in Phase 04 with a duplicate ID matching `0001_snapshot.json`; both `0003` and `0004` snapshots had the same `prevId`, causing drizzle-kit to error with "collision"
- **Fix:** Gave `0003_snapshot.json` a unique ID, updated `0004_snapshot.json.prevId` to chain from 0003, created proper `0005_snapshot.json` (scheduling_slots state), created `0006_snapshot.json` (current schema state with all new columns), updated `_journal.json` to include entries 5 and 6
- **Files modified:** `meta/0003_snapshot.json`, `meta/0004_snapshot.json`, `meta/0005_snapshot.json` (new), `meta/0006_snapshot.json` (new), `meta/_journal.json`
- **Outcome:** `drizzle-kit generate` confirms "No schema changes" (snapshots match current schema)

## Self-Check: PASSED

All key files verified present:
- FOUND: src/db/migrations/0006_feed_automation.sql
- FOUND: src/lib/spam-guard.ts
- FOUND: src/lib/feed-poll.ts
- FOUND: src/db/migrations/meta/0005_snapshot.json
- FOUND: src/db/migrations/meta/0006_snapshot.json

All commits verified:
- FOUND: 9c99fca (schema migration + spam guard)
- FOUND: ba5af7f (feed polling module)
