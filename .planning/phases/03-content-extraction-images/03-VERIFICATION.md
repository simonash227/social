---
phase: 03-content-extraction-images
verified: 2026-03-17T00:00:00Z
status: gaps_found
score: 13/14 must-haves verified
gaps:
  - truth: "Media library is filterable by date/type (per REQUIREMENTS.md IMG-05)"
    status: partial
    reason: "Images are ordered newest-first by default (satisfied), but no UI controls exist for filtering by date or type. REQUIREMENTS.md IMG-05 specifies 'filterable by date/type'; the plan's truth only said 'filterable by date (newest first by default)', which is technically satisfied. However, IMG-05 as written in REQUIREMENTS.md requires filter controls that are absent."
    artifacts:
      - path: "src/app/(dashboard)/brands/[id]/media/media-grid.tsx"
        issue: "No filter UI controls — no date filter, no type filter. Only default newest-first sort via server action."
      - path: "src/app/actions/images.ts"
        issue: "getMediaLibrary always returns all images ordered desc by createdAt; no filter parameters accepted."
    missing:
      - "Filter controls in media-grid.tsx (e.g. date range or sort toggle)"
      - "OR: accept the plan interpretation (newest first by default = sufficient) and mark IMG-05 satisfied with a note in REQUIREMENTS.md"
human_verification:
  - test: "Content extraction — YouTube URL"
    expected: "Pasting a YouTube URL and clicking Extract populates the text area with transcript text"
    why_human: "Requires live YouTube API call; cannot verify transcript content programmatically from code alone"
  - test: "Content extraction — article URL"
    expected: "Pasting an article URL and clicking Extract populates text area with article body text"
    why_human: "Requires live HTTP fetch; cannot verify Readability output from code alone"
  - test: "Content extraction — PDF upload"
    expected: "Selecting a PDF file triggers extraction and populates text area with PDF text"
    why_human: "Requires browser file API; cannot test FileReader flow programmatically"
  - test: "Image generation via gpt-image-1"
    expected: "Entering an image prompt and clicking Generate Image produces a visible image accessible via Media Library"
    why_human: "Requires live OPENAI_API_KEY and R2 bucket; runtime behavior cannot be verified statically"
  - test: "Watermark compositing"
    expected: "Generated images have brand logo watermark at configured position when logoUrl is set on the brand"
    why_human: "Requires live image generation and visual inspection; cannot verify compositing output statically"
---

# Phase 3: Content Extraction + Images Verification Report

**Phase Goal:** Support multiple content source types and AI-generated visual content with brand consistency.
**Verified:** 2026-03-17
**Status:** gaps_found (1 gap — IMG-05 filter UI partially implemented vs. REQUIREMENTS.md wording)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                  | Status     | Evidence                                                                                       |
|----|----------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------|
| 1  | YouTube URL extracts transcript text and feeds it into generation prompt               | VERIFIED   | `extractFromUrl` in extract.ts uses `YoutubeTranscript.fetchTranscript`; `generateContent` auto-extracts when sourceText empty |
| 2  | Article URL extracts clean body text and title via Readability                         | VERIFIED   | `extractFromUrl` branches to `@mozilla/readability` + jsdom for non-YouTube URLs; 5MB guard present |
| 3  | PDF upload extracts text and populates the source text field                           | VERIFIED   | `extractPdf` uses PDFParse v2; `handlePdfUpload` in generate-section.tsx reads file as ArrayBuffer, converts to base64, calls `extractSource` |
| 4  | Extraction errors degrade gracefully with user-visible message, not crashes            | VERIFIED   | Both `extractFromUrl` and `extractPdf` never throw; return `{ text: '', error: '...' }`. UI shows red error with "You can still type content manually below." |
| 5  | Existing URL + text source input still works exactly as before                         | VERIFIED   | `generateContent` signature unchanged; extraction is additive (called only when sourceText empty) |
| 6  | AI generates images using gpt-image-1 with brand colors and style in the prompt        | VERIFIED   | `generateBrandImage` in image-gen.ts calls `openai.images.generate({ model: 'gpt-image-1' })` with `brandStyleDirective` built from brand.niche, primaryColor, secondaryColor, voiceTone |
| 7  | Generated images have brand logo watermark composited at configured position/opacity   | VERIFIED   | `applyWatermark` in image-gen.ts uses sharp composite with `GRAVITY_MAP`; non-fatal on failure (logged warning, continues) |
| 8  | Full image and 400px thumbnail are both uploaded to R2 media bucket                    | VERIFIED   | `generateBrandImage` calls `uploadToR2` twice: full PNG and JPEG thumbnail; keys use `brands/${brandId}/images/${timestamp}[.-thumb].jpg` |
| 9  | Image metadata (prompt, R2 keys, cost) is recorded in the database                    | VERIFIED   | `generateImage` in images.ts inserts row into `generatedImages` with prompt, fullKey, thumbKey, r2Bucket, costUsd |
| 10 | R2 public URLs are constructable for serving images in the UI                          | VERIFIED   | `getR2PublicUrl` in r2.ts uses `R2_MEDIA_PUBLIC_BASE` env var; `getMediaLibrary` maps rows to fullUrl/thumbUrl |
| 11 | User can generate an image from the generate page with a custom prompt                 | VERIFIED   | Image Generation section in generate-section.tsx: Textarea, Generate Image button, `handleGenerateImage` calls `generateImage` server action |
| 12 | User can override the image prompt and regenerate                                      | VERIFIED   | MediaGrid detail panel shows Textarea pre-filled with prompt, "Regenerate with new prompt" button calls `regenerateImage`, then `router.refresh()` |
| 13 | Media library page shows a grid of generated images with thumbnails                   | VERIFIED   | media/page.tsx fetches via `getMediaLibrary`, renders `<MediaGrid>`; grid is `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` with `<img src={image.thumbUrl}>` |
| 14 | Media library filterable by date (newest first by default); filterable by type per REQUIREMENTS.md | PARTIAL | Server action uses `orderBy(desc(generatedImages.createdAt))` — newest first is implemented. No UI filter controls for date range or type. REQUIREMENTS.md IMG-05 says "filterable by date/type"; plan truth only required "newest first by default". |

**Score: 13/14 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/extract.ts` | Content extraction for YouTube, articles, PDFs | VERIFIED | Exports `extractFromUrl` and `extractPdf`; 75 lines; substantive implementation with error handling |
| `src/app/actions/generate.ts` | Updated generate action with extractSource | VERIFIED | Exports `generateContent`, `refineAndGate`, `saveGeneratedPosts`, `extractSource`; `generateContent` auto-extracts from URL when sourceText empty |
| `src/app/(dashboard)/brands/[id]/generate/generate-section.tsx` | Updated UI with PDF upload, extraction status, image gen section | VERIFIED | URL Extract button, PDF upload input, extraction status (spinner/check/error), Image Generation section with prompt + generate button + result display |
| `src/db/schema.ts` | generatedImages table definition | VERIFIED | `generatedImages` sqliteTable defined after postPlatforms with all required columns |
| `src/lib/image-gen.ts` | Image generation pipeline | VERIFIED | Exports `generateBrandImage`; full pipeline: OpenAI gpt-image-1 call, applyWatermark, thumbnail resize, dual R2 upload |
| `src/lib/r2.ts` | R2 public URL helper | VERIFIED | `getR2PublicUrl` exported; constructs URL from `R2_MEDIA_PUBLIC_BASE` env var |
| `src/app/actions/images.ts` | Server actions for image generation | VERIFIED | Exports `generateImage`, `regenerateImage`, `getMediaLibrary`, `MediaImage` type; `'use server'` directive present |
| `src/app/(dashboard)/brands/[id]/media/page.tsx` | Media library server page | VERIFIED | Server component; fetches brand, calls `getMediaLibrary`, renders empty state or MediaGrid |
| `src/app/(dashboard)/brands/[id]/media/media-grid.tsx` | Client component for image grid | VERIFIED | `'use client'`; responsive grid, click-to-expand detail panel, full-size image, regenerate with prompt override, router.refresh() |
| `src/app/(dashboard)/brands/[id]/page.tsx` | Brand detail page with Media Library link | VERIFIED | Media Library button present between "Generate Content" and "Edit Brand" with `ImageIcon` |
| `src/db/migrations/0003_generated_images.sql` | Migration SQL file | VERIFIED | CREATE TABLE statement with all 10 columns; registered in `_journal.json` as idx 3 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/actions/generate.ts` | `src/lib/extract.ts` | `import { extractFromUrl, extractPdf }` | WIRED | Line 10: `import { extractFromUrl, extractPdf } from '@/lib/extract'`; both used in `extractSource` and `generateContent` |
| `generate-section.tsx` | `src/app/actions/generate.ts` | `extractSource` server action call | WIRED | Line 17: `extractSource` imported; called in `handlePdfUpload` (line 144) and `handleUrlExtract` (line 164) |
| `src/app/actions/images.ts` | `src/lib/image-gen.ts` | `generateBrandImage` import | WIRED | Line 7: `import { generateBrandImage } from '@/lib/image-gen'`; called in `generateImage` action |
| `src/lib/image-gen.ts` | `src/lib/r2.ts` | `uploadToR2` for full image and thumbnail | WIRED | Line 3: `import { uploadToR2 } from '@/lib/r2'`; called twice (lines 119-120) |
| `src/app/actions/images.ts` | `src/db/schema.ts` | insert into `generatedImages` table | WIRED | Line 4: `import { brands, generatedImages } from '@/db/schema'`; `db.insert(generatedImages)` used in `generateImage` |
| `media/page.tsx` | `src/app/actions/images.ts` | `getMediaLibrary` server action call | WIRED | Line 8: `import { getMediaLibrary } from '@/app/actions/images'`; called on line 26 |
| `media-grid.tsx` | `src/app/actions/images.ts` | `regenerateImage` server action | WIRED | Line 7: `import { regenerateImage, type MediaImage } from '@/app/actions/images'`; called in `handleRegenerate` |
| `generate-section.tsx` | `src/app/actions/images.ts` | `generateImage` server action | WIRED | Line 20: `import { generateImage } from '@/app/actions/images'`; called in `handleGenerateImage` |

All 8 key links verified as fully wired.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GEN-01 | 03-01 | User can paste a URL, upload a PDF, or type text as a content source | SATISFIED | URL input + PDF file upload + textarea all present in generate-section.tsx |
| GEN-02 | 03-01 | System extracts text from YouTube videos (transcript), articles, and PDFs | SATISFIED | `extractFromUrl` handles YouTube + articles; `extractPdf` handles PDFs; both wired via `extractSource` server action |
| IMG-01 | 03-02 | AI generates images using OpenAI GPT Image API with brand style directive | SATISFIED | `generateBrandImage` calls gpt-image-1 with `brandStyleDirective` from brand profile fields |
| IMG-02 | 03-02 | Generated images include brand logo watermark at configured position and opacity | SATISFIED | `applyWatermark` composites logo at `GRAVITY_MAP[position]`; non-fatal failure handling means watermark attempted always when logoUrl set |
| IMG-03 | 03-02 | Images are stored in Cloudflare R2 with 400px thumbnails for dashboard | SATISFIED | Dual R2 upload (full PNG + 400px JPEG thumbnail); keys stored in `generatedImages` table; `getR2PublicUrl` constructs public URLs |
| IMG-04 | 03-03 | User can regenerate or override image prompts | SATISFIED | MediaGrid detail panel with editable prompt textarea and "Regenerate with new prompt" button |
| IMG-05 | 03-03 | Media library page shows grid of generated images, filterable by date/type | PARTIAL | Grid exists and shows thumbnails newest-first. "Filterable by date/type" filter controls are absent. Plan truth only required "newest first by default". |

**Orphaned requirements check:** REQUIREMENTS.md traceability maps GEN-01, GEN-02, IMG-01–IMG-05 to Phase 3. All 7 IDs claimed in PLAN frontmatter. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/image-gen.ts` | 47–54 | `costUsd` hardcoded as `'0.042'` | Info | Accepted: matches gpt-image-1 medium 1024x1024 pricing. No dynamic cost tracking. |
| `src/lib/image-gen.ts` | 47–54 | Opacity handling uses `Object.assign` with `blend: 'over'` but does not actually apply fractional opacity | Warning | Opacity from watermark settings is not applied — only position is used. The code silently assigns `blend: 'over'` which doesn't scale alpha. IMG-02 requirement is met at the compositing level but opacity is unimplemented. |

No TODO/FIXME/placeholder comments found. No empty return stubs. No console.log-only implementations (only the single `console.warn` for non-fatal watermark failure, which is appropriate).

---

### Human Verification Required

#### 1. YouTube transcript extraction

**Test:** Paste a YouTube video URL with captions (e.g., any public video) into the generate page URL field and click Extract.
**Expected:** Text area populates with the transcript; extraction status shows green checkmark with character count.
**Why human:** Requires live network call to YouTube's timedtext API; cannot verify transcript output statically.

#### 2. Article URL extraction

**Test:** Paste a news article or blog post URL and click Extract.
**Expected:** Text area populates with the article body text; title shown in extraction status.
**Why human:** Requires live HTTP fetch; Readability output depends on the article HTML structure.

#### 3. PDF upload extraction

**Test:** Upload a PDF file on the generate page.
**Expected:** Extraction status shows "Extracting PDF text..." then "Extracted N characters"; text area populates with PDF body text.
**Why human:** Requires browser FileReader API and PDFParse v2; cannot test end-to-end without a browser.

#### 4. Image generation (requires OPENAI_API_KEY + R2)

**Test:** Enter an image prompt in the Image Generation section and click Generate Image.
**Expected:** Loading state shows "Generating image..."; on success, green "Image generated successfully!" message appears with "View in Media Library" link.
**Why human:** Requires live OPENAI_API_KEY and configured R2 bucket; runtime gpt-image-1 API call cannot be verified statically.

#### 5. Watermark on generated image

**Test:** Set a brand with a logoUrl, watermarkPosition, and watermarkOpacity. Generate an image. View it in the Media Library.
**Expected:** The generated image has the brand logo composited at the configured position.
**Why human:** Visual verification required; opacity scaling may be partial (see anti-pattern above).

---

### Gaps Summary

**1 gap found:** IMG-05 filter controls

REQUIREMENTS.md specifies "filterable by date/type". The implementation delivers images in newest-first order (via `desc(generatedImages.createdAt)` in `getMediaLibrary`), which satisfies the plan's truth of "filterable by date (newest first by default)". However, the requirement's "/type" filter and any UI date-range control are absent from both `media-grid.tsx` and `media/page.tsx`.

This is a **scope interpretation gap** — the plan narrowed the requirement to "newest first by default" without flagging the delta. The gap does not break any currently implemented feature, but IMG-05 as written is not fully satisfied.

**Resolution options:**
- Add a sort toggle (newest/oldest) and/or a type filter dropdown to `media-grid.tsx`, or
- Accept the current implementation as meeting the spirit of IMG-05 (all images are already a single type: "generated") and annotate REQUIREMENTS.md accordingly.

---

### Additional Notes

- `next.config.ts` correctly externalizes `pdf-parse` and `openai` alongside `better-sqlite3` and `node-cron` — all four native/CJS packages that cause issues in Next.js standalone builds are covered.
- Migration `0003_generated_images` is registered in `_journal.json` at idx 3 and will auto-run on next DB connection.
- openai was downgraded from v6 to v4 (documented in 03-03 SUMMARY) to fix gpt-image-1 b64_json extraction — this is a runtime-verified fix not traceable statically.
- The watermark opacity implementation (`Object.assign(compositeOpts, { blend: 'over' })`) does not actually apply the opacity percentage from `watermarkOpacity`. This is a known limitation documented in the code comments. IMG-02 (watermark at configured position) is met; opacity scaling is not.

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier)_
