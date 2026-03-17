---
phase: 03-content-extraction-images
plan: 02
subsystem: api
tags: [openai, sharp, r2, image-generation, watermark, thumbnail, sqlite, drizzle]

# Dependency graph
requires:
  - phase: 01-scaffolding-database-auth
    provides: DB schema (brands, posts), R2 upload helpers, Drizzle ORM
  - phase: 03-content-extraction-images/03-01
    provides: extract.ts module (url/PDF extraction), generate.ts action patterns
provides:
  - generatedImages DB table with migration
  - generateBrandImage() pipeline in src/lib/image-gen.ts
  - generateImage, regenerateImage, getMediaLibrary server actions in src/app/actions/images.ts
  - getR2PublicUrl() helper in src/lib/r2.ts
  - MediaImage type for UI consumption
affects:
  - 03-03 (image UI consumes generateImage, getMediaLibrary, MediaImage)
  - 04-carousel-generation (may reuse image pipeline)

# Tech tracking
tech-stack:
  added:
    - openai (npm) — gpt-image-1 image generation API
  patterns:
    - Module-level OpenAI client (one per process, reads OPENAI_API_KEY from env)
    - Image pipeline: OpenAI b64_json -> watermark composite via sharp -> thumbnail resize -> dual R2 upload
    - Server actions follow generateContent.ts pattern (brand lookup, spend check, AI call, DB insert, error catch)

key-files:
  created:
    - src/lib/image-gen.ts
    - src/app/actions/images.ts
    - src/db/migrations/0003_generated_images.sql
  modified:
    - src/db/schema.ts (generatedImages table added)
    - src/lib/r2.ts (getR2PublicUrl added)
    - src/db/migrations/meta/_journal.json (migration registered)
    - package.json / package-lock.json (openai added)

key-decisions:
  - "gpt-image-1 returns b64_json only (not URL) -- response.data[0].b64_json extraction required"
  - "Module-level OpenAI client (same singleton pattern as Anthropic client in generate.ts)"
  - "Watermark failure is non-fatal -- logged as warning, image proceeds without watermark"
  - "costUsd hardcoded as 0.042 for medium quality 1024x1024 (gpt-image-1 pricing)"
  - "R2_MEDIA_BUCKET defaults to social-media if env var not set"
  - "Image generation does not use circuit breaker (new service, keep simple for now)"

patterns-established:
  - "OpenAI client: const openai = new OpenAI() at module level (reads OPENAI_API_KEY)"
  - "Watermark gravity: GRAVITY_MAP maps 4-position enum to sharp gravity strings"
  - "Dual R2 upload: full PNG + JPEG thumbnail with timestamp-based keys"
  - "Server action pattern: brand lookup -> spend check -> AI call -> DB insert -> logAiSpend -> return id"

requirements-completed: [IMG-01, IMG-02, IMG-03]

# Metrics
duration: 9min
completed: 2026-03-17
---

# Phase 3 Plan 02: Image Generation Backend Summary

**OpenAI gpt-image-1 integration with sharp watermarking, dual R2 upload (full + 400px thumbnail), and generatedImages DB table for brand-consistent AI image generation**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-17T01:42:26Z
- **Completed:** 2026-03-17T01:50:59Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- OpenAI SDK installed and wired to a module-level client reading `OPENAI_API_KEY` from env
- Full image pipeline: gpt-image-1 call (b64_json) -> optional sharp watermark composite -> 400px JPEG thumbnail -> dual R2 upload
- `generatedImages` DB table with migration 0003 auto-registered in journal
- Three server actions (`generateImage`, `regenerateImage`, `getMediaLibrary`) ready for Plan 03 UI consumption
- `MediaImage` type exported for the UI layer

## Task Commits

1. **Task 1: Install OpenAI SDK, add generatedImages schema, migration, R2 public URL helper** - `e1246bc` (feat)
2. **Task 2: Create image generation module and server actions** - `4c22417` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/image-gen.ts` — generateBrandImage pipeline (OpenAI call, watermark, thumbnail, R2 upload)
- `src/app/actions/images.ts` — generateImage, regenerateImage, getMediaLibrary server actions + MediaImage type
- `src/db/schema.ts` — generatedImages table added after postPlatforms
- `src/db/migrations/0003_generated_images.sql` — CREATE TABLE migration
- `src/db/migrations/meta/_journal.json` — migration idx 3 registered
- `src/lib/r2.ts` — getR2PublicUrl() helper added
- `package.json` / `package-lock.json` — openai dependency added
- `src/lib/extract.ts` — pre-existing 03-01 file committed (pdf-parse TS fixes applied)
- `src/app/actions/generate.ts` — extractSource action + URL auto-extract (03-01 integration)

## Decisions Made

- **gpt-image-1 b64_json only:** gpt-image-1 returns base64 image data (not a URL), so `response.data[0].b64_json` is extracted and converted to a Buffer.
- **Module-level OpenAI client:** `const openai = new OpenAI()` at module level, same singleton pattern as the Anthropic client in `generate.ts`.
- **Non-fatal watermark:** If the logo URL is unreachable or sharp compositing fails, the error is caught and logged — the image is uploaded without the watermark rather than failing the entire request.
- **Hardcoded cost:** `costUsd = '0.042'` for medium quality 1024x1024 (gpt-image-1 pricing). No token counts for image generation.
- **No circuit breaker on OpenAI:** Keep it simple for this initial implementation. Can add later if needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript errors in extract.ts**
- **Found during:** Task 1 verification (`npx tsc --noEmit`)
- **Issue:** `extract.ts` from plan 03-01 had two TS errors: pdf-parse default import incompatible with ESM types, and `article?.title` returning `string | null | undefined` where `string | undefined` was expected.
- **Fix:** Used class-based `PDFParse` import from pdf-parse (linter applied this automatically), added `?? undefined` to coerce null to undefined on title field.
- **Files modified:** `src/lib/extract.ts`
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** `e1246bc` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TypeScript errors in new image-gen.ts**
- **Found during:** Task 2 verification (`npx tsc --noEmit`)
- **Issue:** Three TS errors: wrong gravity type cast, `response.data` possibly undefined, Buffer type mismatch from `arrayBuffer()`.
- **Fix:** Cast gravity to `CompositeOptions['gravity']`; added guard for missing `response.data`; used `Buffer.from(new Uint8Array(arrayBuffer))` to normalize the buffer type.
- **Files modified:** `src/lib/image-gen.ts`
- **Verification:** `npx tsc --noEmit` passes with no errors
- **Committed in:** `4c22417` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Fixes required for TS verification to pass. No scope creep.

## Issues Encountered

- `npm install openai` produced many `TAR_ENTRY_ERROR` warnings on Windows for `.mts` type declaration files. The actual JS module installed correctly — `node -e "require('openai')"` confirmed the package was functional. These are benign Windows path warnings from npm's tar extractor on long `.mts` filenames.

## User Setup Required

Two external services require configuration before image generation works:

**Environment variables needed:**
- `OPENAI_API_KEY` — platform.openai.com -> API keys
- `R2_MEDIA_BUCKET` — Cloudflare Dashboard -> R2 -> Create bucket (e.g. `social-media`)
- `R2_MEDIA_PUBLIC_BASE` — Cloudflare Dashboard -> R2 -> bucket settings -> Public access -> Custom domain or r2.dev URL

## Next Phase Readiness

- Image generation backend is complete and ready for Plan 03's UI layer
- `generateImage(brandId, prompt)` and `getMediaLibrary(brandId)` are the primary entry points
- `MediaImage` type is exported from `src/app/actions/images.ts` for use in UI components
- Requires `OPENAI_API_KEY`, `R2_MEDIA_BUCKET`, and `R2_MEDIA_PUBLIC_BASE` env vars to function

---
*Phase: 03-content-extraction-images*
*Completed: 2026-03-17*
