---
phase: 05-calendar-scheduling
plan: 01
subsystem: scheduling-backend
tags: [scheduling, cron, publish, schema, server-actions]
dependency_graph:
  requires: []
  provides: [publish-pipeline, scheduling-slots-crud, calendar-events-api]
  affects: [src/db/schema.ts, src/lib/publish.ts, src/lib/cron.ts, src/lib/upload-post.ts, src/app/actions/schedule.ts]
tech_stack:
  added: []
  patterns: [globalThis-mutex, circuit-breaker, per-platform-retry-backoff, jitter-scheduling]
key_files:
  created:
    - src/lib/publish.ts
    - src/app/actions/schedule.ts
    - src/db/migrations/0005_scheduling_slots.sql
  modified:
    - src/db/schema.ts
    - src/lib/cron.ts
    - src/lib/upload-post.ts
decisions:
  - publishDuePosts uses globalThis.__publishRunning mutex to prevent overlapping cron ticks
  - Per-platform retry uses 5-minute backoff and caps at 3 failures before marking status=failed
  - Post status only transitions to published/failed after ALL platforms are resolved
  - scheduleToNextSlot applies UTC-based slot matching with +/-15 min random jitter
  - incrementFailureCount called on account after platform publish failure (non-fatal if it throws)
  - getCalendarEvents uses inArray filter for multi-status queries (drizzle does not support OR on status enum natively)
metrics:
  duration_seconds: 317
  completed_date: "2026-03-17"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 3
---

# Phase 05 Plan 01: Scheduling Backend Summary

**One-liner:** Auto-publish pipeline with per-platform retry backoff, every-minute cron, scheduling slots CRUD, and FullCalendar-ready event query.

## What Was Built

### Task 1: Schema migration + scheduling slots table + retryAt column (commit: 0df16a5)

Added `schedulingSlots` table to `schema.ts` with brandId, platform, hour (0-23), minute (0-59), createdAt. Added nullable `retryAt` column to `postPlatforms` to track retry backoff timestamps. Created `src/db/migrations/0005_scheduling_slots.sql` with `CREATE TABLE scheduling_slots` and `ALTER TABLE post_platforms ADD COLUMN retry_at TEXT`, following the hand-written SQL pattern of earlier migrations.

### Task 2: Publish module + cron job + schedule server actions (commit: d703c6e)

**upload-post.ts:** Added `publishTextPost` function that sends a multipart FormData POST to `/upload_text` with `user`, repeated `platform[]`, and `title` fields. Wrapped in circuit breaker. Returns parsed JSON (request_id/job_id) for analytics correlation.

**publish.ts:** Created `publishDuePosts` with:
- `globalThis.__publishRunning` mutex to prevent overlapping ticks
- Queries posts WHERE status='scheduled' AND scheduled_at <= now
- Per-post: queries postPlatforms WHERE status='pending' AND (retryAt IS NULL OR retryAt <= now)
- Per-platform: looks up socialAccount uploadPostUsername, calls publishTextPost
- On success: sets status='published' + requestId
- On failure: increments failureCount, sets retryAt = now+5min if failureCount < 3, sets status='failed' at 3
- After all platforms: transitions post status to 'published' (all done) or 'failed' (all failed) or leaves as 'scheduled'
- Logs all attempts to activityLog; calls incrementFailureCount on account

**cron.ts:** Added `cron.schedule('* * * * *', ...)` before the backup job, using dynamic import of `./publish` to call `publishDuePosts`. Updated console.log to include 'publish' in registered jobs list.

**schedule.ts:** Created 6 server actions:
1. `schedulePost(postId, scheduledAt)` - sets status='scheduled'
2. `reschedulePost(postId, newScheduledAt)` - updates scheduledAt (drag-and-drop)
3. `getSchedulingSlots(brandId)` - returns slots ordered by platform, hour, minute
4. `saveSchedulingSlots(brandId, slots)` - delete-all + bulk insert transaction pattern
5. `scheduleToNextSlot(postId, brandId, platform)` - finds next UTC slot after now, wraps to next day if needed, applies +/-15 min jitter
6. `getCalendarEvents(brandId?)` - queries posts/brands joined, fetches platforms, returns FullCalendar-shaped events with id, title, start, color, extendedProps

## Verification Results

- `npx next build` passes with zero TypeScript errors
- schedulingSlots table defined in schema.ts
- retryAt column on postPlatforms
- publish.ts has mutex guard (`__publishRunning`)
- cron.ts registers `* * * * *` schedule calling publishDuePosts
- schedule.ts exports all 6 server actions
- Migration SQL file at 0005_scheduling_slots.sql

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- src/lib/publish.ts: FOUND
- src/app/actions/schedule.ts: FOUND
- src/db/migrations/0005_scheduling_slots.sql: FOUND
- Commit 0df16a5: FOUND
- Commit d703c6e: FOUND
