---
phase: 03-content-extraction-images
plan: 03
subsystem: ui
tags: [image-generation, media-library, generate-page, brand-detail, next.js, server-actions]
dependency_graph:
  requires:
    - phase: 03-content-extraction-images/03-02
      provides: generateImage, regenerateImage, getMediaLibrary server actions, MediaImage type
  provides: [MediaGrid, media-library-page, image-generation-ui]
  affects: [generate-section.tsx, brands/[id]/page.tsx]
tech_stack:
  added: []
  patterns:
    - Image generation UI with useTransition for non-blocking server action calls
    - Media grid with inline detail panel (click-to-expand, no separate route)
    - router.refresh() after regeneration to re-fetch server component data
key_files:
  created:
    - src/app/(dashboard)/brands/[id]/media/page.tsx
    - src/app/(dashboard)/brands/[id]/media/media-grid.tsx
  modified:
    - src/app/(dashboard)/brands/[id]/generate/generate-section.tsx
    - src/app/(dashboard)/brands/[id]/page.tsx
decisions:
  - "Image generation section always visible on generate page (not gated by text results) — enables independent image workflows"
  - "Media grid detail view uses inline expanded panel below grid (not modal/overlay) — simpler UX, no portal needed"
  - "router.refresh() after regeneration to re-fetch server component data (Next.js App Router pattern)"
  - "brandId prop on MediaGrid passed through but not used (only imageId needed for regenerateImage) — kept for future extensibility"
metrics:
  duration_seconds: 120
  completed_date: "2026-03-17"
  tasks_completed: 2
  tasks_total: 3
  files_created: 2
  files_modified: 2
---

# Phase 3 Plan 3: Image Generation UI and Media Library Summary

**One-liner:** Image generation section on generate page with prompt/generate/result flow, plus /brands/[id]/media library with responsive thumbnail grid, full-size detail view, and regenerate-with-new-prompt capability.

## What Was Built

Two tasks implementing the image generation UI end-to-end:

1. **`generate-section.tsx`** — Image Generation section added below text generation controls:
   - `ImageIcon`-labeled section with subtitle explaining brand style usage
   - `Textarea` for custom image prompt (rows=3)
   - "Generate Image" button calling `generateImage(brandId, prompt)` via `useTransition`
   - Loading state: "Generating image..." while in transition
   - Success result: green card with "Image generated successfully!" + "View in Media Library" link to `/brands/[id]/media`
   - Error result: destructive styled message
   - "Generate Another" button clears both result and prompt
   - Section always visible (independent of text generation results)

2. **`src/app/(dashboard)/brands/[id]/media/page.tsx`** — Server component media library page:
   - Follows generate/page.tsx pattern: parse params, validate, query brand, notFound if missing
   - Calls `getMediaLibrary(brandId)` for images array
   - Back button to brand detail page
   - Empty state: dashed border card with link to generate page
   - Non-empty: renders `<MediaGrid images={images} brandId={brandId} />`

3. **`src/app/(dashboard)/brands/[id]/media/media-grid.tsx`** — Client component:
   - Responsive CSS grid: 2 cols on mobile, 3 on md, 4 on lg
   - Each cell: thumbnail (`aspect-square object-cover`), truncated prompt text, formatted date
   - Click-to-select opens inline detail panel below grid
   - Detail panel: full-size image, original prompt, cost + date metadata, regenerate section
   - Regenerate section: pre-filled `Textarea` with existing prompt, "Regenerate with new prompt" button
   - On success: `router.refresh()` re-fetches server data, closes detail view
   - On error: shows destructive error message in regenerate section

4. **`brands/[id]/page.tsx`** — Brand detail page updated:
   - Added `ImageIcon` import from lucide-react
   - Media Library button with `ImageIcon` placed between "Generate Content" and "Edit Brand"

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| generate-section.tsx exists | FOUND |
| media/page.tsx exists | FOUND |
| media/media-grid.tsx exists | FOUND |
| Commit ad4ced2 (Task 1) | FOUND |
| Commit 6f83b51 (Task 2) | FOUND |

## Checkpoint Status

Task 3 is a `checkpoint:human-verify` — paused awaiting human verification of the complete Phase 3 system (content extraction + image generation pipeline).

**Verification steps required:**
1. YouTube URL extraction on generate page
2. Article URL extraction
3. PDF upload extraction
4. Content generation from extracted text
5. Image generation from Image Generation section
6. Media Library link from success message
7. Thumbnail display in media library
8. Full-size view on click
9. Regenerate with new prompt
10. Brand detail page Media Library button
11. Navigation to /brands/[id]/media
