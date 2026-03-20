---
phase: 11-multi-variant-generation
plan: "02"
subsystem: ui
tags: [post-detail, variants, navigation, brand-dashboard]
dependency_graph:
  requires: ["11-01"]
  provides: ["post-detail-page", "variant-visibility"]
  affects: ["brands/[id]/page.tsx", "brands/[id]/posts/[postId]/page.tsx"]
tech_stack:
  added: []
  patterns: ["Next.js 15 async params", "native HTML details/summary collapsible", "drizzle-orm isNull filter"]
key_files:
  created:
    - src/app/(dashboard)/brands/[id]/posts/[postId]/page.tsx
  modified:
    - src/app/(dashboard)/brands/[id]/page.tsx
decisions:
  - "Used native <details>/<summary> for runner-up collapsible — no new component needed"
  - "isNull(posts.variantOf) filter on recentPosts keeps brand page showing only primary posts"
  - "Runner-up notice uses amber color to distinguish from error states"
metrics:
  duration: "2 minutes"
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 11 Plan 02: Post Detail Page with Variant Display Summary

Post detail page at `/brands/[id]/posts/[postId]` showing winning post content + collapsible runner-up variants with quality scores, with brand page recent posts converted to clickable links and runner-up posts filtered from the list.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create post detail page with variant display | bfbe777 | src/app/(dashboard)/brands/[id]/posts/[postId]/page.tsx (created, 203 lines) |
| 2 | Link recent posts to post detail page | 559e404 | src/app/(dashboard)/brands/[id]/page.tsx (modified) |

## What Was Built

**Post detail page** (`/brands/[id]/posts/[postId]/page.tsx`):
- Server component with async params (Next.js 15 pattern)
- Validates post existence and brand ownership — returns 404 on mismatch
- Displays: status badge, platform badges, quality score, creation/scheduled dates, source URL
- Shows `postActiveLearningIds` count as "Learnings used: N" badge
- Full content display; multi-platform posts show each platform's content in its own section
- Runner-up variants section (only when `variantGroup` is set and runner-ups exist): native `<details>/<summary>` collapsible, runner-ups sorted by quality score descending
- Runner-up posts show amber notice banner with link back to winning post

**Brand detail page changes** (`/brands/[id]/page.tsx`):
- Recent post rows changed from `<div>` to `<Link href="/brands/{id}/posts/{postId}">`
- Added `hover:bg-muted/50 transition-colors` for visual affordance
- `isNull(posts.variantOf)` filter added to recentPosts query — runner-up variants excluded
- Added `isNull` to drizzle-orm imports

## Decisions Made

- Used native HTML `<details>/<summary>` for runner-up collapsible per research recommendation — no new UI component needed
- `isNull(posts.variantOf)` filter on brand page keeps the recent posts list clean — only winning/primary posts shown
- Runner-up notice uses amber color scheme to distinguish informational state from destructive (red) states
- Sorted runner-ups by `qualityScore` descending so best performer among runner-ups appears first

## Deviations from Plan

None — plan executed exactly as written.

## Verification

1. `npx tsc --noEmit` — passes cleanly (verified twice, after each task)
2. Post detail page queries post by ID and validates `post.brandId === brandId` before serving
3. Runner-up variants queried by `variantGroup` when `post.variantGroup` is not null
4. Runner-ups displayed in collapsible `<details>` element sorted by score descending
5. Brand detail page recent posts are `<Link>` elements with `href=/brands/{id}/posts/{postId}`
6. `isNull(posts.variantOf)` filter applied in recentPosts query

## Self-Check: PASSED

- FOUND: src/app/(dashboard)/brands/[id]/posts/[postId]/page.tsx
- FOUND: src/app/(dashboard)/brands/[id]/page.tsx
- FOUND: commit bfbe777 (Task 1)
- FOUND: commit 559e404 (Task 2)
