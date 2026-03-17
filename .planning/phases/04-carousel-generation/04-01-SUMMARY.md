---
phase: 04-carousel-generation
plan: 01
subsystem: carousel
tags: [database, schema, migration, satori, sharp, r2, fonts, templates]
dependency_graph:
  requires: []
  provides: [carousel-schema, carousel-gen-engine, inter-fonts]
  affects: [src/db/schema.ts, src/lib/carousel-gen.ts, public/fonts/]
tech_stack:
  added: [satori, sharp (existing), @fontsource/inter (existing devDep)]
  patterns: [object-vnode Satori templates, sharp SVG-to-PNG, R2 parallel upload]
key_files:
  created:
    - src/lib/carousel-gen.ts
    - src/db/migrations/0004_carousels.sql
    - src/db/migrations/meta/0003_snapshot.json
    - src/db/migrations/meta/0004_snapshot.json
    - public/fonts/Inter-SemiBold.woff
    - public/fonts/Inter-Bold.woff
  modified:
    - src/db/schema.ts
    - src/db/migrations/meta/_journal.json
decisions:
  - Migration renamed from 0004_brainy_morph.sql to 0004_carousels.sql and journal tag updated for consistency
  - Created 0003_snapshot.json manually to fill drizzle-kit lineage gap (0003_generated_images migration had no snapshot)
  - Satori object-vnode style (no JSX) used throughout per research findings
  - Fonts loaded once per renderCarouselSlides call, not per slide
  - Slides rendered sequentially (CPU-bound), uploads batched via Promise.all
metrics:
  duration: "~20 minutes"
  completed: "2026-03-17"
  tasks_completed: 2
  files_created: 8
  files_modified: 2
---

# Phase 4 Plan 01: Carousel Foundation Summary

**One-liner:** Drizzle carousel schema (carousels + carouselSlides tables), Inter font weights 400/600/700 for Satori, and three object-vnode carousel templates (minimal/bold/gradient) with a full Satori->sharp->R2 render pipeline.

## Tasks Completed

| # | Task | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | Database schema + font setup | 83d7e24 | carousels + carouselSlides tables, 0004_carousels.sql migration, Inter-SemiBold.woff + Inter-Bold.woff |
| 2 | Carousel template engine | 7eaa243 | src/lib/carousel-gen.ts (594 lines), 3 templates, renderCarouselSlides pipeline |

## What Was Built

### Database Schema
Added two new tables to `src/db/schema.ts`:

- **carousels**: brandId (FK), postId (nullable FK), templateId, sourceText, slideCount, status (draft/ready), createdAt
- **carouselSlides**: carouselId (FK), slideIndex, title, body, r2Key, thumbKey, createdAt

Migration `0004_carousels.sql` creates both tables with proper REFERENCES constraints. The `0003_snapshot.json` was manually created to restore the missing drizzle-kit snapshot chain from the `0003_generated_images` migration.

### Fonts
Copied from `@fontsource/inter` devDependency:
- `public/fonts/Inter-SemiBold.woff` (weight 600, ~31KB)
- `public/fonts/Inter-Bold.woff` (weight 700, ~31KB)

Combined with the existing `Inter-Regular.woff` (400), all three weights are available for Satori rendering.

### Carousel Template Engine (`src/lib/carousel-gen.ts`)

**Exports:** `BrandStyle`, `SlideData`, `TEMPLATE_IDS`, `TemplateId`, `renderCarouselSlides`

**3 Templates:**

1. **minimal** — Dark `#0f0f0f` background, white text, primaryColor accent for slide number and handle. CTA slide inverts to primaryColor background. 56px bold title, 28px `#cccccc` body.

2. **bold** — Full primaryColor background on hook + CTA slides; `#ffffff` background on content slides with `#333333` body text. 64px bold title. Content slides have an 8px primaryColor left border strip.

3. **gradient** — 80px header bar with `linear-gradient(135deg, primary, secondary)` over `#1a1a1a` body. CTA slide uses full gradient background. 48px bold title.

All templates share: slide number indicator, logo on CTA via img vnode (non-fatal if fails), `.filter(Boolean)` on children arrays.

**Pipeline (`renderCarouselSlides`):**
1. Load Inter fonts once (400/600/700 WOFF)
2. For each slide: build vnode -> `satori()` -> SVG -> `sharp().png()` -> `sharp().jpeg()` thumbnail
3. Upload all PNGs + thumbs to R2 in parallel via `Promise.all`
4. R2 key pattern: `brands/{brandId}/carousels/{timestamp}/slide-{index}.png`
5. Returns `{ r2Keys, thumbKeys }`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed spurious function overload on templateBold**
- **Found during:** Task 2 (tsc verification)
- **Issue:** An accidental overload `(brand: BrandStyle, slide: BrandStyle & SlideData) => object` was included, causing TypeScript error TS2322 — the TEMPLATES registry expects `(brand, slide: SlideData)` but the overload signature required `BrandStyle & SlideData`
- **Fix:** Removed the duplicate overload declaration, keeping only the correct single-signature form
- **Files modified:** src/lib/carousel-gen.ts
- **Commit:** 7eaa243 (fix applied inline before commit)

**2. [Rule 2 - Missing] Created 0003_snapshot.json for drizzle-kit lineage**
- **Found during:** Task 1 (drizzle-kit generate produced 0004 that included generated_images table again)
- **Issue:** The `0003_generated_images` migration existed in the journal but had no corresponding snapshot file, causing drizzle-kit to regenerate `generated_images` in the new migration
- **Fix:** Manually authored `0003_snapshot.json` from `0002_snapshot.json` + generated_images table definition; manually cleaned `0004_carousels.sql` to only contain the two new tables
- **Files modified:** src/db/migrations/meta/0003_snapshot.json, src/db/migrations/0004_carousels.sql
- **Commit:** 83d7e24

## Self-Check: PASSED

- [x] `public/fonts/Inter-Bold.woff` exists (31,320 bytes)
- [x] `public/fonts/Inter-SemiBold.woff` exists (31,260 bytes)
- [x] `src/db/schema.ts` contains `carousels` and `carouselSlides` (3 matches)
- [x] `src/db/migrations/0004_carousels.sql` exists
- [x] `src/lib/carousel-gen.ts` exports: BrandStyle, SlideData, TEMPLATE_IDS, TemplateId, renderCarouselSlides (594 lines)
- [x] `npx tsc --noEmit` passes with no errors
- [x] Commits 83d7e24 and 7eaa243 exist in git log
