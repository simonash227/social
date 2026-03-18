---
phase: 07-analytics-dashboard-polish
plan: 02
subsystem: dashboard
tags: [dashboard, analytics, server-components, drizzle, sqlite]
dependency_graph:
  requires: [07-01]
  provides: [dashboard-pages, activity-log, brand-analytics]
  affects: [home-page, brand-detail-page, activity-page, analytics-page]
tech_stack:
  added: []
  patterns: [async-server-component, drizzle-aggregate-queries, client-filter-component]
key_files:
  created:
    - src/app/(dashboard)/activity/page.tsx
    - src/app/(dashboard)/activity/activity-filters.tsx
    - src/app/(dashboard)/brands/[id]/analytics/page.tsx
  modified:
    - src/app/(dashboard)/page.tsx
    - src/app/(dashboard)/brands/[id]/page.tsx
decisions:
  - "ActivityFilters uses useSearchParams + router.push for client-side filter state without full page reload"
  - "Platform IN query uses sql.raw(ids.join(',')) for simple multi-id lookups on small result sets"
  - "Per-platform analytics breakdown computed in JS from full result set (no groupBy SQL) — small dataset, simpler code"
metrics:
  duration_minutes: 9
  completed_date: "2026-03-18"
  tasks_completed: 3
  files_changed: 5
---

# Phase 7 Plan 02: Dashboard Pages with Real Data Summary

All four dashboard pages now render real data from SQLite via drizzle queries, replacing stubs and creating missing routes.

## What Was Built

**Cross-brand home page with weekly digest** — async server component querying all brands, computing weekly published count, total engagement score, and top performer from postAnalytics this week. Brand cards grid shows per-brand published count, avg engagement, and next scheduled post. Empty state with CTA if no brands exist.

**Activity log page** — new server component at `/activity` with async searchParams. Filters by brand/level/type via a small `ActivityFilters` client component using `useSearchParams` + `router.push`. Entries rendered in reverse chronological order with relative timestamps, level/type badges, and error row highlighting (`border-destructive/40 bg-destructive/5`). Max 200 entries per load.

**Brand detail page quick stats + recent posts** — 4-stat grid added after header (published/scheduled/avg engagement/top tier count). Recent 5 posts list shows content preview, status badge, platform badges, engagement score, and date. Analytics button added to header button row.

**Per-brand analytics page** — new server component at `/brands/[id]/analytics` with back link to brand detail. Overall stats cards (total published, avg engagement, top/under performer counts). Per-platform breakdown showing post count, avg engagement, and tier distribution badges. Top 5 performing posts table with engagement metrics (views/likes/comments/shares). Empty state for fresh installs with cron schedule explanation.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

### Files Exist
- src/app/(dashboard)/page.tsx: FOUND
- src/app/(dashboard)/activity/page.tsx: FOUND
- src/app/(dashboard)/activity/activity-filters.tsx: FOUND
- src/app/(dashboard)/brands/[id]/analytics/page.tsx: FOUND
- src/app/(dashboard)/brands/[id]/page.tsx: FOUND

### Commits Exist
- 3bcfc1f: Task 1 - home page
- 4bb9a68: Task 2 - activity log page
- db29b48: Task 3 - brand detail + analytics page

## Self-Check: PASSED
