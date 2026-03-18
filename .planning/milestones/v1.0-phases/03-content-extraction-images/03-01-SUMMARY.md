---
phase: 03-content-extraction-images
plan: 01
subsystem: content-extraction
tags: [extraction, youtube, readability, pdf-parse, server-actions, ui]
dependency_graph:
  requires: []
  provides: [extractFromUrl, extractPdf, extractSource]
  affects: [generate-section.tsx, generate.ts]
tech_stack:
  added:
    - youtube-transcript@1.3.x (YouTube transcript via unofficial timedtext API)
    - "@mozilla/readability@0.6.x (Firefox reader mode engine for articles)"
    - jsdom@26.x (DOM environment for Readability in Node.js)
    - pdf-parse@2.x (PDFParse class API for server-side text extraction)
  patterns:
    - Content extraction module in src/lib/ (pure functions, no server overhead)
    - extractSource server action for client-side pre-generation extraction
    - useTransition for non-blocking extraction UI state
key_files:
  created:
    - src/lib/extract.ts
  modified:
    - src/app/actions/generate.ts
    - src/app/(dashboard)/brands/[id]/generate/generate-section.tsx
    - next.config.ts
    - package.json
decisions:
  - pdf-parse v2 uses PDFParse class API (not v1 function call) — use new PDFParse({ data: Uint8Array }) + .getText()
  - @types/pdf-parse removed after discovery: v1 types incompatible with v2 package (breaking change in pdf-parse)
  - extractSource is additive — called client-side before generateContent for user visibility
  - generateContent auto-extracts on server side as fallback when sourceText is empty
  - 5MB HTML truncation guard in extractFromUrl prevents jsdom memory spikes
  - Extract button shown only when sourceUrl non-empty AND sourceText is empty to avoid redundant extraction
metrics:
  duration_seconds: 738
  completed_date: "2026-03-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 4
---

# Phase 3 Plan 1: Content Extraction Module Summary

**One-liner:** YouTube transcript + Readability article + PDFParse v2 text extraction with extractSource server action and inline extraction UI in the generate page.

## What Was Built

Three tasks implementing content extraction end-to-end:

1. **`src/lib/extract.ts`** — Content extraction module with two exported functions:
   - `extractFromUrl(url)`: Detects YouTube URLs (regex), fetches transcript via `YoutubeTranscript.fetchTranscript()`. Falls back to Readability + jsdom for articles. 5MB HTML guard prevents memory spikes. Never throws.
   - `extractPdf(buffer)`: Uses pdf-parse v2 `PDFParse` class API with `new PDFParse({ data: Uint8Array }) + .getText()`. Never throws.

2. **`src/app/actions/generate.ts`** — Integration with the generate pipeline:
   - New `extractSource(sourceUrl, pdfBase64?)` server action for client-side pre-generation extraction
   - `generateContent` now auto-extracts from URL when `sourceText` is empty (graceful degradation — continues with URL-only prompt if extraction fails)

3. **`generate-section.tsx`** — Updated UI with:
   - URL input with inline "Extract" button (visible when URL non-empty and sourceText empty)
   - Styled PDF file input with `<input type="file" accept=".pdf">` (visually hidden, activated via label)
   - Extraction status indicator: spinner / green checkmark / red error with fallback text
   - `canGenerate` condition extended to allow generation when `pdfFileName` is set

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pdf-parse v2 incompatible with v1 usage pattern**
- **Found during:** Task 1 TypeScript verification
- **Issue:** pdf-parse was updated to v2 which has a class-based API (`PDFParse` class with `.getText()`). The plan specified `import pdfParse from 'pdf-parse'` and calling it as a function — which is the v1 API. The installed version is v2.
- **Fix:** Updated `extractPdf` to use `new PDFParse({ data: new Uint8Array(buffer) })` and `await parser.getText()`. Also removed `@types/pdf-parse` which provides v1 types incompatible with v2.
- **Files modified:** `src/lib/extract.ts`
- **Commit:** f74eb6a

**2. [Rule 3 - Blocking] Pre-existing TypeScript errors in image-gen.ts blocked tsc verification**
- **Found during:** Task 1 TypeScript verification
- **Issue:** `src/lib/image-gen.ts` (untracked, created in a prior session) had 3 TS errors: `GravityEnum` type constraint, `response.data` possibly undefined, and `Buffer` type mismatch.
- **Fix:** Linter auto-fixed these issues. The file was already corrected before my fix attempt resolved.
- **Files modified:** `src/lib/image-gen.ts`
- **Commit:** Linter auto-fixed before explicit commit

**3. [Rule 3 - Blocking] Stale .next/types caused tsc failures after Task 2**
- **Found during:** Task 2 TypeScript verification
- **Issue:** `npx tsc --noEmit` failed with missing `.next/types/**/*.ts` files because the `.next` directory was stale.
- **Fix:** Ran `npm run build` to regenerate `.next/types`. All subsequent tsc checks passed.

## Self-Check: PASSED

All created files exist on disk. All task commits verified in git log.

| Check | Result |
|-------|--------|
| src/lib/extract.ts exists | FOUND |
| src/app/actions/generate.ts exists | FOUND |
| generate-section.tsx exists | FOUND |
| Commit f74eb6a (Task 1) | FOUND |
| Commit 22aa117 (Task 3) | FOUND |
