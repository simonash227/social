---
phase: 06-content-automation-pipeline
plan: "03"
subsystem: ui
tags: [rss, feeds, automation, server-actions, next-js, drizzle, sqlite]

# Dependency graph
requires:
  - phase: 06-01
    provides: feedSources and feedEntries DB schema, feed polling infrastructure

provides:
  - Server actions for feed CRUD (addFeed, updateFeed, deleteFeed, getBrandFeeds, updateAutomationLevel)
  - FeedWithStats type with entry count aggregations
  - /brands/[id]/feeds route with full feed management UI
  - Automation level selector (manual/semi/mostly/full) per brand
  - Add feed form with type detection and URL format hints
  - Per-feed controls: poll interval, relevance threshold, platform targeting, enable/disable, delete

affects: [06-02, calendar, dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Server page.tsx fetches data passes to 'use client' section component
    - Optimistic UI state updates in client component (feeds list updated locally before server revalidates)
    - Manual cascade delete (feedEntries before feedSource) since SQLite lacks FK cascade in this schema

key-files:
  created:
    - src/app/actions/feeds.ts
    - src/app/(dashboard)/brands/[id]/feeds/page.tsx
    - src/app/(dashboard)/brands/[id]/feeds/feeds-section.tsx
  modified:
    - src/app/(dashboard)/brands/[id]/page.tsx

key-decisions:
  - "FeedWithStats aggregation done with three separate count queries per feed (total, relevant, processed) -- sufficient for small per-brand datasets"
  - "targetPlatforms null means all platforms; empty array means none -- toggle handles null/empty boundary"
  - "Automation level selector uses buttons not Select dropdown for clearer UX showing all options at once"

patterns-established:
  - "Feed page follows generate/media/carousels pattern: server page.tsx + client section component"
  - "Per-item inline edit controls (select dropdowns) update server immediately via useTransition"

requirements-completed: [FEED-01, FEED-02, FEED-08]

# Metrics
duration: 14min
completed: 2026-03-18
---

# Phase 6 Plan 03: Feed Management UI Summary

**RSS feed management UI with add/configure/delete controls, per-brand automation level selector, and URL format hints for all four feed types**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-17T23:51:57Z
- **Completed:** 2026-03-18T00:06:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Feed server actions with full CRUD including manual cascade delete and brandId revalidation
- Feed management page at /brands/[id]/feeds with automation level and add feed form
- Per-feed config cards showing status, entry counts, and inline controls for poll interval, threshold, platforms
- Brand detail page updated with "Feed Sources" navigation button

## Task Commits

Each task was committed atomically:

1. **Task 1: Feed server actions** - `a278bec` (feat)
2. **Task 2: Feed management page UI with automation config** - `1eb791f` (feat)

## Files Created/Modified
- `src/app/actions/feeds.ts` - Server actions: addFeed, updateFeed, deleteFeed, getBrandFeeds, updateAutomationLevel; FeedWithStats type
- `src/app/(dashboard)/brands/[id]/feeds/page.tsx` - Server page fetching brand, feeds, accounts
- `src/app/(dashboard)/brands/[id]/feeds/feeds-section.tsx` - Client component with all feed management UI
- `src/app/(dashboard)/brands/[id]/page.tsx` - Added Feed Sources navigation button

## Decisions Made
- FeedWithStats uses three separate count queries per feed for total/relevant/processed entries. Sufficient since each brand has a small number of feeds.
- targetPlatforms null means all platforms (no filtering), empty array would mean none -- the UI represents unchecked = included in all (null).
- Automation level selector renders all four options as clickable cards rather than a dropdown, making all choices visible simultaneously.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Feed management UI complete; users can now configure feed sources and automation levels
- Phase 06-02 auto-generate orchestration can be tested end-to-end with feed sources in place
- Brand detail page navigation now includes Feed Sources alongside Generate, Media, Carousels

---
*Phase: 06-content-automation-pipeline*
*Completed: 2026-03-18*
