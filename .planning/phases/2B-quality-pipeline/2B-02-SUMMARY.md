---
phase: 2B-quality-pipeline
plan: "02"
subsystem: ui
tags: [quality, ui, generation, react, loading-states, badges]

requires:
  - phase: 2B-01
    provides: refineAndGate() server action, RefinedGenerationResult type, extended saveGeneratedPosts() with qualityData
provides:
  - Two-phase generation UI (Generating... then Refining...)
  - Quality score badges per platform tab
  - Discard error cards for low-quality platforms
  - Warning badges for marginal content
  - Combined AI cost display (generation + refinement)
  - Quality data passed to saveGeneratedPosts on save
  - Save button disabled when all platforms discarded
affects:
  - Phase 3+ (generation UI is now the standard pattern for quality-aware content)

tech-stack:
  added: []
  patterns:
    - Two-phase async transition with dynamic loading message state
    - Derived hasPassingContent boolean for conditional button/message rendering
    - Separate genCost state + result.totalCostUsd for combined cost display

key-files:
  created: []
  modified:
    - src/app/(dashboard)/brands/[id]/generate/generate-section.tsx

key-decisions:
  - "genCost tracked separately in state so generation cost is preserved while refinement runs"
  - "Discarded tabs shown with strikethrough/opacity so user sees what was attempted"
  - "hasPassingContent derived from result.platforms at render time (not state) to stay in sync"

patterns-established:
  - "Separate useTransition hooks for independent loading operations (generate, save)"
  - "loadingMessage state updated mid-transition for multi-phase feedback"

requirements-completed: [QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05]

duration: 2min
completed: 2026-03-17
---

# Phase 2B Plan 02: Quality Pipeline UI Integration Summary

**Generation UI updated with two-phase loading (Generating/Refining), quality score badges, discard error cards, warning indicators, combined cost display, and quality data persistence on save.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-17T00:47:54Z
- **Completed:** 2026-03-17T00:49:37Z
- **Tasks:** 1 of 2 (Task 2 is human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- Wired refineAndGate() into handleGenerate() after generateContent() with mid-transition loading message update
- Quality score badges render above hook variants for each non-discarded platform
- Discarded platforms show error card with score and reason instead of editable textarea
- Marginal content shows warning badge from qualityWarning field
- Save button disabled when all platforms are discarded; "try again" message displayed
- Combined AI cost (genCost + result.totalCostUsd) shown at bottom of results
- Quality data built from refined result and passed to saveGeneratedPosts()

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire refineAndGate into generation flow and update UI** - `cdc3fe0` (feat)

## Files Created/Modified

- `src/app/(dashboard)/brands/[id]/generate/generate-section.tsx` - Full UI integration of quality pipeline

## Decisions Made

- `genCost` tracked as separate state (set after generateContent(), before refineAndGate()) so the combined cost display remains accurate even when refinement adds more cost
- Discarded tab triggers get `opacity-50 line-through` CSS classes rather than being hidden, so users see which platforms were attempted and why they failed
- `hasPassingContent` derived at render time from `result.platforms` rather than stored in state, ensuring it always reflects the current result

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full end-to-end quality pipeline is wired: generate -> critique -> optional rewrite -> quality gate -> display -> save
- Task 2 (human-verify checkpoint) requires manual testing with live AI calls to confirm the pipeline works correctly
- After human verification, Phase 2B is complete and Phase 3 (Content Extraction + Images) can begin

---
*Phase: 2B-quality-pipeline*
*Completed: 2026-03-17*
