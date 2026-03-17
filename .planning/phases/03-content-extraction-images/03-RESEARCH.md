# Phase 3: Content Extraction + Image Generation - Research

**Researched:** 2026-03-17
**Domain:** Content extraction (YouTube/article/PDF) + OpenAI image generation + R2 storage + sharp watermarking
**Confidence:** HIGH

## Summary

Phase 3 adds two capabilities to the existing generation pipeline: rich content extraction from external sources (YouTube, web articles, PDFs) and AI-generated images with brand watermarks. Both features extend the generation workflow already in place — extraction feeds better source text into the existing `generateContent()` action, while image generation is a parallel new flow that stores output in R2 and surfaces it in a media library page.

The codebase already has R2 (`src/lib/r2.ts`) and sharp (package.json) installed and working. The `uploadToR2` helper and `@aws-sdk/client-s3` are proven from Phase 1. No new foundational infrastructure is required — this phase layers on top of solid ground.

The primary new technical risk is YouTube transcript extraction: the `youtube-transcript` npm package uses YouTube's unofficial API and can break without warning. The mitigation is a clear fallback: if transcript extraction fails, the user's URL is passed as-is to the generation prompt (already the existing behavior when no source text is provided).

**Primary recommendation:** `youtube-transcript` for YouTube + `@mozilla/readability` + `jsdom` for articles + `pdf-parse` for PDFs + `openai` SDK for `gpt-image-1` + existing `sharp` for watermarking + existing `uploadToR2` for R2 storage.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GEN-01 | User can paste a URL, upload a PDF, or type text as a content source | Already partially done (URL + text in generate UI); PDF upload is the missing piece — requires file input + pdf-parse on server |
| GEN-02 | System extracts text from YouTube videos (transcript), articles, and PDFs | youtube-transcript for YouTube; @mozilla/readability + jsdom for articles; pdf-parse for PDFs |
| IMG-01 | AI generates images using OpenAI GPT Image API with brand style directive | openai SDK `images.generate()` with `model: "gpt-image-1"` + brand color/voice prompt |
| IMG-02 | Generated images include brand logo watermark at configured position and opacity | sharp `composite()` with gravity mapped from brand watermark_position + opacity blend |
| IMG-03 | Images stored in Cloudflare R2 with 400px thumbnails for dashboard | `uploadToR2()` already works; sharp `.resize(400)` for thumbnail; two keys per image |
| IMG-04 | User can regenerate or override image prompts | UI state for custom prompt + re-generate server action |
| IMG-05 | Media library page shows grid of generated images, filterable by date/type | New DB table `generated_images`; new page `/brands/[id]/media` |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| youtube-transcript | ^1.3.0 | Fetch YouTube transcript as array of {text, duration, offset} segments | Most widely used unofficial YT transcript package; no auth required for public videos |
| @mozilla/readability | ^0.6.0 | Extract article text + title from arbitrary HTML (Firefox reader mode engine) | The gold standard for article extraction; actively maintained by Mozilla |
| jsdom | ^26.x | Provide DOM environment for Readability in Node.js | Required peer for Readability; project already has Node 22 |
| pdf-parse | ^1.1.1 | Extract plain text from uploaded PDF buffers | Pure JS, no native deps, works on Railway/Linux, supports Node 22 |
| openai | ^4.x (latest) | Call `gpt-image-1` image generation API | Official OpenAI SDK; already have Anthropic SDK pattern to follow |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| sharp | ^0.33 (already installed) | Resize images to 400px thumbnails + composite watermark | Used for both thumbnail generation and watermark overlay |
| @aws-sdk/client-s3 | ^3.x (already installed) | Upload full + thumbnail images to R2 | Already used in r2.ts; no additional install needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @mozilla/readability | @extractus/article-extractor | article-extractor is simpler (single function) but readability is more battle-tested and returns textContent directly |
| youtube-transcript | ytdl-core / yt-dlp | ytdl-core is deprecated; yt-dlp requires subprocess; youtube-transcript is the simplest path |
| pdf-parse | pdfjs-dist | pdfjs-dist is heavier (browser-oriented); pdf-parse is lighter for server-side text extraction |
| openai SDK | Direct fetch to OpenAI API | SDK is the correct choice; project uses @anthropic-ai/sdk pattern already |

**Installation:**
```bash
npm install youtube-transcript @mozilla/readability jsdom pdf-parse openai
npm install --save-dev @types/jsdom @types/pdf-parse
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   ├── extract.ts         # Content extraction: extractFromUrl(), extractPdf()
│   ├── image-gen.ts       # Image generation + watermark + R2 upload
│   └── r2.ts              # (existing) uploadToR2, getR2PublicUrl added
├── db/
│   └── schema.ts          # (add) generatedImages table
├── app/
│   ├── actions/
│   │   ├── generate.ts    # (existing) + extractContent() server action
│   │   └── images.ts      # (new) generateImage(), regenerateImage() server actions
│   └── (dashboard)/
│       └── brands/[id]/
│           ├── generate/
│           │   └── generate-section.tsx  # (update) add PDF upload + extraction status
│           └── media/
│               └── page.tsx              # (new) media library grid
```

### Pattern 1: Content Extraction Module
**What:** A single `lib/extract.ts` exports two functions — `extractFromUrl(url: string)` and `extractPdf(buffer: Buffer)` — both returning `Promise<{ text: string; title?: string; error?: string }>`.

**When to use:** Called from the `generate` server action before building the generation prompt. Replaces the raw URL pass-through for YouTube/article URLs.

**Example:**
```typescript
// src/lib/extract.ts
import { YoutubeTranscript } from 'youtube-transcript'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import pdfParse from 'pdf-parse'

export async function extractFromUrl(url: string): Promise<{ text: string; title?: string; error?: string }> {
  // 1. Detect YouTube
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) {
    try {
      const segments = await YoutubeTranscript.fetchTranscript(url)
      const text = segments.map(s => s.text).join(' ')
      return { text }
    } catch {
      return { text: '', error: 'YouTube transcript unavailable — video may have disabled captions' }
    }
  }

  // 2. Article extraction
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const html = await res.text()
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    return {
      text: article?.textContent?.trim() ?? '',
      title: article?.title,
    }
  } catch {
    return { text: '', error: 'Could not extract article content' }
  }
}

export async function extractPdf(buffer: Buffer): Promise<{ text: string; error?: string }> {
  try {
    const data = await pdfParse(buffer)
    return { text: data.text.trim() }
  } catch {
    return { text: '', error: 'Could not extract PDF content' }
  }
}
```

### Pattern 2: Image Generation Module
**What:** A `lib/image-gen.ts` module handles the full pipeline: generate base64 image from OpenAI, apply watermark via sharp, resize to thumbnail, upload both to R2, return public URLs.

**When to use:** Called from the `images` server action when user triggers image generation from the generate page or media library.

**Example:**
```typescript
// src/lib/image-gen.ts
import OpenAI from 'openai'
import sharp from 'sharp'
import { uploadToR2 } from './r2'

const openai = new OpenAI() // reads OPENAI_API_KEY from env

export async function generateBrandImage(params: {
  prompt: string
  brandStyleDirective: string
  logoUrl?: string
  watermarkPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  watermarkOpacity?: number
  brandId: number
}): Promise<{ fullKey: string; thumbKey: string; costUsd: string }> {
  // 1. Call gpt-image-1
  const response = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: `${params.brandStyleDirective}\n\n${params.prompt}`,
    size: '1024x1024',
    quality: 'medium',
  })

  const base64 = response.data[0].b64_json!
  let imageBuffer = Buffer.from(base64, 'base64')

  // 2. Apply watermark if logo configured
  if (params.logoUrl) {
    imageBuffer = await applyWatermark(imageBuffer, params.logoUrl, params.watermarkPosition, params.watermarkOpacity)
  }

  // 3. Generate 400px thumbnail
  const thumbBuffer = await sharp(imageBuffer).resize(400).jpeg({ quality: 80 }).toBuffer()

  // 4. Upload to R2
  const timestamp = Date.now()
  const fullKey = `brands/${params.brandId}/images/${timestamp}.png`
  const thumbKey = `brands/${params.brandId}/images/${timestamp}-thumb.jpg`

  const bucket = process.env.R2_MEDIA_BUCKET ?? 'social-media'
  await uploadToR2(bucket, fullKey, imageBuffer)
  await uploadToR2(bucket, thumbKey, thumbBuffer)

  return { fullKey, thumbKey, costUsd: '0.042' } // medium quality 1024x1024
}

// Gravity mapping for sharp composite
const GRAVITY_MAP: Record<string, string> = {
  'top-left': 'northwest',
  'top-right': 'northeast',
  'bottom-left': 'southwest',
  'bottom-right': 'southeast',
}

async function applyWatermark(
  imageBuffer: Buffer,
  logoUrl: string,
  position: string = 'bottom-right',
  opacity: number = 50
): Promise<Buffer> {
  const logoResponse = await fetch(logoUrl)
  const logoBuffer = Buffer.from(await logoResponse.arrayBuffer())

  // Resize logo to ~15% of image width
  const logoResized = await sharp(logoBuffer).resize(150).png().toBuffer()

  return sharp(imageBuffer)
    .composite([{
      input: logoResized,
      gravity: GRAVITY_MAP[position] ?? 'southeast',
      blend: 'over',
      // opacity controlled via alpha pre-multiply on logo
    }])
    .png()
    .toBuffer()
}
```

### Pattern 3: generatedImages DB Table
**What:** New SQLite table tracks each generated image with R2 keys, prompt, brand, and timestamps for the media library.

**Schema addition to schema.ts:**
```typescript
// Add to src/db/schema.ts
export const generatedImages = sqliteTable('generated_images', {
  id:           integer().primaryKey({ autoIncrement: true }),
  brandId:      integer('brand_id').notNull().references(() => brands.id),
  postId:       integer('post_id').references(() => posts.id), // nullable — image may exist without post
  prompt:       text().notNull(),
  fullKey:      text('full_key').notNull(),      // R2 key for full image
  thumbKey:     text('thumb_key').notNull(),     // R2 key for 400px thumbnail
  r2Bucket:     text('r2_bucket').notNull(),
  costUsd:      text('cost_usd').notNull(),
  type:         text({ enum: ['generated'] }).notNull().default('generated'),
  createdAt:    text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})
```

### Pattern 4: R2 Public URL Helper
**What:** The existing `r2.ts` only uploads/lists/deletes. A `getR2PublicUrl(bucket, key)` helper is needed for serving images in the media library.

**How:** R2 public URL is `https://<R2_PUBLIC_BASE>/<key>` — configured via `R2_PUBLIC_BASE` env var (the custom domain or r2.dev URL for the media bucket).

```typescript
// Add to src/lib/r2.ts
export function getR2PublicUrl(key: string): string {
  const base = process.env.R2_MEDIA_PUBLIC_BASE
  if (!base) throw new Error('R2_MEDIA_PUBLIC_BASE env var not set')
  return `${base.replace(/\/$/, '')}/${key}`
}
```

### Pattern 5: PDF Upload in Generate UI
**What:** The generate page currently accepts a URL or text. GEN-01 requires PDF upload. The implementation adds a file input in the source section and sends the file to a server action that calls `extractPdf()`.

**How:** Use a standard HTML `<input type="file" accept=".pdf">` in the generate-section client component. Read the file as `ArrayBuffer`, pass to a server action as `FormData`. Server action calls `extractPdf(buffer)` and returns the extracted text to the client to populate the `sourceText` state.

### Anti-Patterns to Avoid
- **Storing base64 images in SQLite:** Never put image data in the DB — always R2 keys only. SQLite is for metadata only.
- **Fetching R2 objects through the Next.js server:** Serve images via R2 public URL directly — don't proxy through the app.
- **Blocking generate page on extraction failure:** If extraction fails, degrade gracefully and let the user see the error and proceed with manual text entry.
- **Using `dall-e-3` instead of `gpt-image-1`:** The requirement specifies GPT Image API. gpt-image-1 is superior and already available.
- **Separate OpenAI and Anthropic clients in same module:** Keep image generation in `lib/image-gen.ts` (uses `openai` SDK) cleanly separated from text generation in `actions/generate.ts` (uses `@anthropic-ai/sdk`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YouTube transcript parsing | Custom YouTube scraper | youtube-transcript | YouTube's page structure changes; transcript parsing is a moving target |
| HTML → clean article text | Custom HTML stripper with regex | @mozilla/readability + jsdom | Readability handles paywall patterns, nav removal, infinite scroll artifacts, encoding — thousands of edge cases |
| PDF text extraction | Custom PDF parser | pdf-parse | PDF is a complex binary format with multiple encoding schemes, CIDFonts, etc. |
| Image watermarking math | Manual pixel manipulation | sharp composite() | Gravity, blend modes, alpha compositing already solved in native libvips |

**Key insight:** Content extraction has enormous edge case surface area (broken HTML, CORs errors, paywalls, different PDF encodings). Using proven libraries avoids implementing a content extractor that works on 80% of sites and fails mysteriously on the rest.

---

## Common Pitfalls

### Pitfall 1: youtube-transcript Unofficial API Fragility
**What goes wrong:** YouTube periodically changes internal API endpoints, breaking all unofficial transcript packages simultaneously.
**Why it happens:** `youtube-transcript` uses the undocumented `timedtext` endpoint that YouTube doesn't guarantee stability.
**How to avoid:** Always wrap `YoutubeTranscript.fetchTranscript()` in try/catch and return a graceful fallback (empty text + error message to user). Never throw to the caller. Keep the package updated — watch the GitHub issues page.
**Warning signs:** All YouTube URLs fail simultaneously. Check if the package has recent issue reports.

### Pitfall 2: jsdom Memory Usage
**What goes wrong:** `new JSDOM(largeHtml)` can use significant memory for large pages, especially if created per-request in server actions.
**Why it happens:** jsdom simulates a full browser environment including JS execution (which we disable via `{ runScripts: 'dangerously' }` being absent).
**How to avoid:** Don't enable JS execution in jsdom — only parse DOM structure. Add a content length check: if HTML > 5MB, truncate before passing to jsdom.
**Warning signs:** Railway memory usage spikes during article extraction.

### Pitfall 3: sharp opacity in composite() requires pre-multiplied alpha
**What goes wrong:** Setting `opacity` in sharp's composite doesn't work as a simple 0-1 float in older versions. The watermark appears at full opacity regardless.
**Why it happens:** Sharp's `composite()` `blend` options control compositing mode but not transparency. To set opacity, you must pre-process the logo buffer to reduce its alpha channel.
**How to avoid:** Use `sharp(logoBuffer).composite([{ input: Buffer.from([0,0,0,Math.round(opacity/100*255)]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])` pattern, OR use `.modulate()` on the logo's alpha. Alternatively, use the `opacity` parameter available in newer sharp versions (0.33+). Verify with a quick test.
**Warning signs:** Logo is always opaque regardless of watermark_opacity setting.

### Pitfall 4: R2 for Media Needs a Separate Bucket + Public Access
**What goes wrong:** Using the same R2 bucket as database backups for media images causes confusion and potential data loss when backup cleanup logic deletes "old" objects.
**Why it happens:** The existing `runDbBackup()` cleans up old backup files by key prefix — but if image keys don't have the `backups/` prefix they're safe. However, keeping backups and media in separate buckets is cleaner.
**How to avoid:** Use a separate R2 bucket (`R2_MEDIA_BUCKET` env var, e.g. `social-media`) with public access enabled. The backup bucket (`R2_BACKUP_BUCKET`) stays private. Add `R2_MEDIA_BUCKET` and `R2_MEDIA_PUBLIC_BASE` to `.env.local` and Railway env vars.
**Warning signs:** Accessing media library images fails because the bucket has no public read access.

### Pitfall 5: pdf-parse dynamic require() in Next.js Standalone
**What goes wrong:** `pdf-parse` attempts to load test PDFs via dynamic `require()` which triggers Next.js bundler warnings or crashes in standalone mode.
**Why it happens:** `pdf-parse` has internal test file loading that triggers on `require`.
**How to avoid:** Import `pdf-parse` in a Server Action file (not a client component), ensure the file is in `serverExternalPackages` in `next.config.ts` if issues arise. Also add it to `serverExternalPackages` alongside `better-sqlite3` and `node-cron`.
**Warning signs:** Build error mentioning `pdf-parse` attempting to read `./test/data/`.

### Pitfall 6: gpt-image-1 response has no `url` field
**What goes wrong:** Code written for dall-e-3 expects `response.data[0].url` but gpt-image-1 always returns `b64_json` (base64 only — no URL).
**Why it happens:** GPT image models only return base64; URL-based responses are only for dall-e-2/3.
**How to avoid:** Always use `response.data[0].b64_json` for gpt-image-1. Convert to Buffer immediately: `Buffer.from(base64, 'base64')`.
**Warning signs:** `response.data[0].url` is undefined/null.

### Pitfall 7: OPENAI_API_KEY environment variable
**What goes wrong:** Project currently only uses `ANTHROPIC_API_KEY`. OpenAI SDK reads `OPENAI_API_KEY` by default. Missing env var causes silent failure or unclear error.
**Why it happens:** Two separate AI provider accounts/keys are needed.
**How to avoid:** Add `OPENAI_API_KEY` to `.env.local` and Railway env vars. Document it in the project setup. The `openai` SDK reads it automatically — no need to pass it explicitly.

---

## Code Examples

Verified patterns from official sources:

### OpenAI Image Generation (gpt-image-1)
```typescript
// Source: https://developers.openai.com/cookbook/examples/generate_images_with_gpt_image
import OpenAI from 'openai'

const openai = new OpenAI() // reads OPENAI_API_KEY from env

const response = await openai.images.generate({
  model: 'gpt-image-1',
  prompt: 'A professional social media header image for a tech brand',
  size: '1024x1024',    // or '1536x1024' (landscape), '1024x1536' (portrait)
  quality: 'medium',    // 'low' | 'medium' | 'high' — medium is $0.042/image at 1024x1024
})

const imageBase64 = response.data[0].b64_json!
const buffer = Buffer.from(imageBase64, 'base64')
```

### Sharp Watermark Composite
```typescript
// Source: https://sharp.pixelplumbing.com/api-composite/
const GRAVITY_MAP = {
  'top-left': 'northwest',
  'top-right': 'northeast',
  'bottom-left': 'southwest',
  'bottom-right': 'southeast',
} as const

const watermarked = await sharp(imageBuffer)
  .composite([{
    input: resizedLogoBuffer,
    gravity: GRAVITY_MAP[position],
    blend: 'over',
  }])
  .png()
  .toBuffer()
```

### sharp Thumbnail Generation
```typescript
// Source: https://sharp.pixelplumbing.com/api-resize
const thumbnail = await sharp(imageBuffer)
  .resize(400, 400, { fit: 'cover', position: 'center' })
  .jpeg({ quality: 80 })
  .toBuffer()
```

### YouTube Transcript Extraction
```typescript
// Source: https://github.com/Kakulukian/youtube-transcript
import { YoutubeTranscript } from 'youtube-transcript'

const segments = await YoutubeTranscript.fetchTranscript('https://youtube.com/watch?v=VIDEO_ID')
// segments: Array<{ text: string, duration: number, offset: number }>
const fullText = segments.map(s => s.text).join(' ')
```

### Article Extraction with Readability
```typescript
// Source: https://github.com/mozilla/readability
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

const html = await fetch(url).then(r => r.text())
const dom = new JSDOM(html, { url })
const reader = new Readability(dom.window.document)
const article = reader.parse()
// article.textContent — plain text
// article.title — page title
```

### PDF Text Extraction
```typescript
// Source: https://www.npmjs.com/package/pdf-parse
import pdfParse from 'pdf-parse'

const data = await pdfParse(pdfBuffer)
// data.text — extracted plain text
// data.numpages — number of pages
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| dall-e-3 image generation | gpt-image-1 (GPT-4o based) | April 2025 | Better instruction following, text rendering; same API surface |
| response_format: 'url' | Always b64_json for gpt-image-1 | April 2025 | Must handle base64 → Buffer; no URL shortcut |
| youtube-dl / ytdl-core | youtube-transcript (transcript only) | 2023+ | ytdl-core deprecated; transcript extraction is all we need |

**Deprecated/outdated:**
- `dall-e-2` / `dall-e-3`: Still work but gpt-image-1 is the current standard for new projects.
- `ytdl-core`: Officially deprecated; do not use.
- `response_format: 'url'` for gpt-image-1: Not supported. Only b64_json works.

---

## Open Questions

1. **YouTube videos with disabled captions**
   - What we know: `YoutubeTranscript.fetchTranscript()` throws if captions are disabled or if video is private.
   - What's unclear: Error message format varies — need to handle generic catch.
   - Recommendation: Wrap in try/catch, show user-friendly message: "Transcript unavailable — paste the video text manually instead."

2. **sharp logo opacity control in v0.33**
   - What we know: Sharp ^0.33 is already installed. Sharp 0.33 added `opacity` parameter to composite operations.
   - What's unclear: Whether `composite([{ input, opacity: 0.5 }])` works cleanly in 0.33 or requires a different approach.
   - Recommendation: Test in the implementation plan. If `opacity` parameter works, use it directly. If not, use alpha channel pre-multiply technique.

3. **R2 public access for media bucket**
   - What we know: The existing `R2_BACKUP_BUCKET` is private. Media images need public read access for the dashboard.
   - What's unclear: Whether the user has already set up a second R2 bucket or if a new one needs creating.
   - Recommendation: Use R2_MEDIA_BUCKET env var. If user doesn't have one, plan should document the R2 bucket setup step (enable public access via Cloudflare dashboard → R2 → Public access).

4. **OPENAI_API_KEY separate from ANTHROPIC_API_KEY**
   - What we know: Project currently only needs Anthropic key. gpt-image-1 requires OpenAI account.
   - What's unclear: Whether user already has an OpenAI account/API key.
   - Recommendation: Plan should note: "Requires OPENAI_API_KEY env var — obtain from platform.openai.com."

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None installed — no test framework detected in project |
| Config file | None — Wave 0 gap |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEN-01 | PDF upload accepted on generate page | manual-only | N/A — UI interaction | N/A |
| GEN-02 | YouTube URL extracts transcript text | manual-only | N/A — external API dependency | N/A |
| GEN-02 | Article URL extracts article text | manual-only | N/A — external fetch | N/A |
| GEN-02 | PDF buffer returns text string | manual-only | N/A — no test framework | N/A |
| IMG-01 | gpt-image-1 called with brand style directive | manual-only | N/A — paid API, no test framework | N/A |
| IMG-02 | Watermark composite applied at correct position | manual-only | N/A — visual verification | N/A |
| IMG-03 | R2 upload succeeds, thumbnail 400px | manual-only | N/A — requires R2 credentials | N/A |
| IMG-04 | User can re-enter prompt and regenerate | manual-only | N/A — UI interaction | N/A |
| IMG-05 | Media library grid renders generated images | manual-only | N/A — UI verification | N/A |

**Justification for manual-only:** All phase behaviors involve external APIs (YouTube, OpenAI), paid services, R2 credentials, or UI interactions. No unit-testable pure logic exists that would benefit from a test framework without mocks. The project has followed a human-verification pattern in all prior phases (2A-03, 2B-02 verification plans).

### Wave 0 Gaps
- No test framework installed — consistent with all prior phases; no action required for this phase.

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

---

## Sources

### Primary (HIGH confidence)
- OpenAI Cookbook (developers.openai.com) - gpt-image-1 Node.js SDK example, parameters, response format
- sharp API docs (sharp.pixelplumbing.com/api-composite/) - composite() gravity and blend options
- @mozilla/readability GitHub (github.com/mozilla/readability) - Readability + jsdom pattern
- Existing codebase: `src/lib/r2.ts`, `src/db/schema.ts`, `src/lib/ai.ts` — established patterns to follow

### Secondary (MEDIUM confidence)
- npm page for youtube-transcript — version 1.3.0, fetchTranscript API signature
- npm page for pdf-parse — pure JS, Node 22 support, text extraction
- OpenAI pricing calculator (costgoat.com) — $0.042 medium quality 1024x1024

### Tertiary (LOW confidence)
- sharp opacity in composite() for v0.33 — needs empirical validation in implementation
- youtube-transcript stability in 2026 — unofficial API, may require updates

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified against official docs or npm; gpt-image-1 confirmed from OpenAI cookbook
- Architecture: HIGH — follows exact patterns already in the codebase (lib/ modules, server actions, drizzle schema)
- Pitfalls: HIGH for items 1, 4, 6, 7 (confirmed from official sources); MEDIUM for items 2, 3, 5 (known issues in ecosystem)

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (youtube-transcript volatile — check in 30 days; gpt-image-1 pricing stable)
