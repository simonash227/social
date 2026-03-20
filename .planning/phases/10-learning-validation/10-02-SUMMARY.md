---
phase: 10-learning-validation
plan: 02
subsystem: ui
tags: [react, next.js, tailwind, shadcn, drizzle, sqlite]

# Dependency graph
requires:
  - phase: 10-01
    provides: getLearningEffectiveness action, LearningStats type, computeLearningStats, autoDeactivateLearnings, postActiveLearningIds relay column

provides:
  - Per-learning A/B stats panel in learnings dashboard (with/without counts, averages, engagement delta)
  - Validated confidence badges derived from empirical A/B data (replaces AI-assigned when available)
  - Auto-deactivated learning status display with amber badge, hidden alongside rejected by default
  - Analytics page top performers rows with per-post learning attribution count badge
  - Generate page post-generation learning count indicator badge

affects: [phase-11-multi-variant, phase-12-advanced-analytics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server component fetches effectiveness map; passes as serialized JSON prop to client component"
    - "stats?.confidence ?? learning.confidence pattern for graceful degradation when A/B data unavailable"
    - "Blue badge pattern for learning attribution across analytics + generate pages"

key-files:
  created: []
  modified:
    - src/app/(dashboard)/brands/[id]/learnings/page.tsx
    - src/app/(dashboard)/brands/[id]/learnings/learnings-section.tsx
    - src/app/(dashboard)/brands/[id]/analytics/page.tsx
    - src/app/(dashboard)/brands/[id]/generate/generate-section.tsx

key-decisions:
  - "Auto-deactivated learnings use amber-600 badge (not red) to distinguish automated action from human rejection"
  - "hiddenLearnings toggle covers both rejected AND auto_deactivated — unified hide/show group"
  - "Validated confidence shown as primary; AI confidence shown in parentheses only when they differ"
  - "Learning count badge on analytics page is intentionally a count only — detailed A/B view stays in learnings dashboard"

patterns-established:
  - "LearningStats prop pattern: effectiveness Record<number, LearningStats> passed server->client; individual stats looked up per card via effectiveness[learning.id]"
  - "Conditional confidence display: stats?.confidence ?? aiConfidence for graceful data absence"

requirements-completed: [VALID-01, VALID-02, VALID-04]

# Metrics
duration: 17min
completed: 2026-03-20
---

# Phase 10 Plan 02: Learning Validation Summary

**Per-learning A/B stats panels, validated confidence badges, auto-deactivated status display, and learning attribution count badges on analytics and generate pages**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-20T02:00:00Z
- **Completed:** 2026-03-20T02:17:33Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Learnings dashboard now shows a per-card A/B stats panel: with-count, without-count, avg engagement, and a color-coded engagement delta (green/red/neutral)
- Confidence badges use validated A/B-derived confidence from `LearningStats` when available; AI-assigned confidence shown in parentheses only when it differs
- Auto-deactivated learnings show distinct amber "Auto-deactivated" badge and are grouped with rejected learnings under a unified "hidden learnings" toggle
- Analytics page top performers rows show a blue learning attribution count badge for posts generated with active learnings
- Generate page shows a "N learnings active" blue badge in the result area after content generation

## Task Commits

1. **Task 1: Learnings dashboard A/B stats, auto-deactivated badges, analytics attribution** - `2e00236` (feat)
2. **Task 2: Generate page learning count badge** - `52def92` (feat)

## Files Created/Modified

- `src/app/(dashboard)/brands/[id]/learnings/page.tsx` - Added `getLearningEffectiveness` call and `effectiveness` prop pass-through to LearningsSection
- `src/app/(dashboard)/brands/[id]/learnings/learnings-section.tsx` - Added `LearningStats` import, `effectiveness` prop, `stats` prop on LearningCard, A/B stats panel, amber auto-deactivated badge, unified hidden group, validated confidence display
- `src/app/(dashboard)/brands/[id]/analytics/page.tsx` - Added `postActiveLearningIds` to query select, blue learning count badge in top performers rows
- `src/app/(dashboard)/brands/[id]/generate/generate-section.tsx` - Added "N learnings active" blue badge in result footer

## Decisions Made

- Auto-deactivated learnings use amber-600 badge to distinguish from red rejected badge — conveys "automated action" vs "human decision"
- `hiddenLearnings` group combines rejected + auto_deactivated under one toggle with neutral label "hidden learnings"
- When A/B stats confidence differs from AI confidence, show both (validated as primary, AI in parentheses) — gives user context for the change
- Learning attribution badge on analytics page is a count only; detailed A/B breakdown belongs in the learnings dashboard

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 10 complete: learning validation loop is fully visible to the user
- Phase 11 (Multi-Variant Generation) can proceed — the generate page already receives and displays `activeLearningIds`
- Phase 12 (Advanced Analytics) will build on the analytics page patterns established here

---
*Phase: 10-learning-validation*
*Completed: 2026-03-20*
