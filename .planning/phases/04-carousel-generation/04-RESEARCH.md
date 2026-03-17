# Phase 4: Carousel Generation - Research

**Researched:** 2026-03-17
**Domain:** Satori carousel rendering, slide content generation, DB schema, carousel UI
**Confidence:** HIGH (Satori+sharp pipeline already validated and deployed; all core libraries installed)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CARO-01 | 3-5 Satori carousel templates with brand colors, fonts, and logo | Satori object-vnode pattern validated in Phase 0; brand color/logo fields exist in schema; Inter WOFF at public/fonts/Inter-Regular.woff |
| CARO-02 | First slide optimized as thumbnail hook, last slide has CTA + brand handle | Template contracts enforced in carousel renderer: first slide = hero/hook layout, last slide = CTA layout using brand.ctaText + social account usernames |
| CARO-03 | AI generates slide content from source material | Same Anthropic client + JSON extraction pattern from generate.ts; output: array of {title, body} slide objects |
| CARO-04 | User can preview carousel, pick template, and edit individual slides | Client component with slide previews (rendered as data URLs or static images); template picker UI; per-slide text editing |
| CARO-05 | Carousel renders to images via Satori → sharp → stored in R2 | Same pipeline as image-gen.ts: Satori vnode → SVG buffer → sharp PNG → uploadToR2; one key per slide |
</phase_requirements>

---

## Summary

Phase 4 builds on fully proven infrastructure. Satori + sharp were validated in Phase 0 (INFRA-04: 1080x1080 PNG rendered successfully on Railway Linux). The `uploadToR2` helper, `generatedImages` DB table, and brand schema are all in production. No new foundational risk exists — this phase is purely an application of existing patterns to a new content type.

The main new work is: (1) designing 3-5 Satori vnode templates as pure TypeScript functions that accept brand + slide data and return a vnode; (2) writing an AI prompt that generates structured slide content (array of `{title, body}`) from source text; (3) building a carousel DB table and storage scheme (one `carousels` row + one R2 key per slide PNG); and (4) a carousel UI page with slide preview, template picker, and per-slide editing.

The highest-risk design decision is the preview UX: rendering full Satori PNGs for preview on every edit is too slow. The right approach is to render PNGs only when the user clicks "Generate Carousel" (final render), and show a lightweight CSS+HTML preview in the browser for the editing phase. This avoids a server roundtrip per keypress. The same pattern works for template picking — show CSS mockups with brand colors, render real PNGs only on final confirmation.

**Primary recommendation:** Satori object-vnode templates (pure TypeScript, no JSX) + AI JSON slide content generation + PNG render-on-save (not on preview) + CSS preview for editing + `carousels` + `carouselSlides` DB tables + R2 key per slide.

---

## Standard Stack

### Core (all already installed — zero new dependencies needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| satori | ^0.10.0 (installed) | HTML/CSS object vnode → SVG | Validated in Phase 0; only WOFF fonts work (proven) |
| sharp | ^0.33.0 (installed) | SVG buffer → PNG buffer + resize | Prebuilt Linux x64 binary; already used in image-gen.ts |
| @anthropic-ai/sdk | ^0.79.0 (installed) | AI slide content generation | Same client pattern as generate.ts |

### Supporting (all already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @aws-sdk/client-s3 | ^3.x (installed) | Upload slide PNGs to R2 | Used via existing uploadToR2() helper |
| better-sqlite3 + drizzle-orm | installed | carousels + carouselSlides schema | New tables, same pattern as generatedImages |

### Font files (already present — no install needed)

| File | Path | Notes |
|------|------|-------|
| Inter Regular 400 WOFF | `public/fonts/Inter-Regular.woff` | Already in repo from Phase 0 |
| Inter Bold 700 WOFF | Load from `node_modules/@fontsource/inter/files/inter-latin-700-normal.woff` | Available in devDep; copy to public/fonts/ at Phase 4 setup |
| Inter SemiBold 600 WOFF | Load from `node_modules/@fontsource/inter/files/inter-latin-600-normal.woff` | Available for body/subtitle weight |

**No new npm installs needed.** All dependencies are present.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   └── carousel-gen.ts        # renderCarousel(): templates + Satori + sharp + R2
├── db/
│   └── schema.ts              # (add) carousels + carouselSlides tables
├── app/
│   ├── actions/
│   │   └── carousels.ts       # generateSlideContent(), renderAndSaveCarousel(), getCarousels()
│   └── (dashboard)/brands/[id]/
│       └── carousels/
│           ├── page.tsx        # Server component: load brand + existing carousels
│           └── carousel-section.tsx  # Client component: AI gen + template picker + editor + preview
.planning/phases/04-carousel-generation/
```

### Pattern 1: Satori Object-Vnode Template Function

**What:** A pure TypeScript function that takes brand + slide data and returns a Satori-compatible vnode object. No JSX, no React — matches the validated Phase 0 pattern.

**When to use:** Every template is this shape. The renderer calls the right template function based on the chosen template ID.

```typescript
// Source: validated in scripts/validate/04-satori-sharp.ts (Phase 0)
// Location: src/lib/carousel-gen.ts

interface BrandStyle {
  primaryColor: string     // e.g. "#6366f1"
  secondaryColor?: string  // e.g. "#818cf8"
  logoUrl?: string         // for img element in last/first slide
  fontFamily: string       // always "Inter" — WOFF loaded at render time
}

interface SlideData {
  type: 'hook' | 'content' | 'cta'
  title: string
  body?: string
  slideNumber: number
  totalSlides: number
  ctaText?: string         // only on type='cta' (last slide)
  handle?: string          // e.g. "@brandname" on last slide
}

// Example: "Minimal" template
function templateMinimal(brand: BrandStyle, slide: SlideData): object {
  const bg = slide.type === 'cta' ? brand.primaryColor : '#0f0f0f'
  const accent = brand.primaryColor

  return {
    type: 'div',
    props: {
      style: {
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        padding: '80px', background: bg,
        fontFamily: brand.fontFamily,
        position: 'relative',
      },
      children: [
        // slide number indicator
        { type: 'div', props: { style: { fontSize: 16, color: accent, marginBottom: 32 },
            children: `${slide.slideNumber} / ${slide.totalSlides}` } },
        // title
        { type: 'div', props: { style: { fontSize: 56, fontWeight: 700, color: '#ffffff',
            lineHeight: 1.1, marginBottom: 24 }, children: slide.title } },
        // body (content slides only)
        slide.body ? { type: 'div', props: { style: { fontSize: 28, color: '#cccccc',
            lineHeight: 1.5 }, children: slide.body } } : null,
        // CTA (last slide)
        slide.ctaText ? { type: 'div', props: { style: { marginTop: 'auto', fontSize: 32,
            color: '#ffffff', fontWeight: 600 }, children: slide.ctaText } } : null,
        slide.handle ? { type: 'div', props: { style: { fontSize: 20, color: accent,
            marginTop: 12 }, children: slide.handle } } : null,
      ].filter(Boolean),
    },
  }
}
```

**CRITICAL constraint:** Satori does not support `margin: 'auto'` on all elements — use `justifyContent: 'space-between'` on the parent flex container instead for bottom-anchoring CTA. Verified caveat from Satori docs.

### Pattern 2: Multi-Font Loading for Satori

**What:** Load all required font weights once and pass the full fonts array to every `satori()` call. Loading fonts is expensive — do it once per `renderCarousel()` call, not per slide.

```typescript
// Source: @fontsource/inter package structure verified 2026-03-17
import fs from 'node:fs'
import path from 'node:path'

function loadFonts(): Array<{ name: string; data: Buffer; weight: number; style: string }> {
  const fontDir = path.join(process.cwd(), 'public', 'fonts')
  return [
    { name: 'Inter', data: fs.readFileSync(path.join(fontDir, 'Inter-Regular.woff')),   weight: 400, style: 'normal' },
    { name: 'Inter', data: fs.readFileSync(path.join(fontDir, 'Inter-SemiBold.woff')),  weight: 600, style: 'normal' },
    { name: 'Inter', data: fs.readFileSync(path.join(fontDir, 'Inter-Bold.woff')),      weight: 700, style: 'normal' },
  ]
}
```

Note: `Inter-SemiBold.woff` and `Inter-Bold.woff` need to be copied from `node_modules/@fontsource/inter/files/` to `public/fonts/` during Phase 4 setup (same as Inter-Regular was done in Phase 0).

### Pattern 3: Slide-by-Slide PNG Render Loop

**What:** Render each slide sequentially (Satori is async), collect PNG buffers, then upload all to R2 in parallel.

```typescript
// Source: image-gen.ts pattern + Phase 0 Satori validation
async function renderAllSlides(
  template: TemplateId,
  brand: BrandStyle,
  slides: SlideData[],
): Promise<Buffer[]> {
  const fonts = loadFonts()
  const pngBuffers: Buffer[] = []

  for (const slide of slides) {
    const vnode = TEMPLATES[template](brand, slide)
    const svg = await satori(vnode as any, { width: 1080, height: 1080, fonts })
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    pngBuffers.push(png)
  }

  return pngBuffers
}
```

### Pattern 4: AI Slide Content Generation

**What:** Single Anthropic call that returns a JSON array of slide objects. Uses the same `parseJsonResponse` pattern from generate.ts. The prompt instructs the AI to structure content for N slides with the first being a hook and last being CTA.

```typescript
// Source: generate.ts patterns
// Output shape from AI:
interface SlideContentResult {
  slides: Array<{
    title: string   // 2-7 words, punchy
    body: string    // 1-3 sentences (empty for hook/CTA slides)
  }>
  hookTitle: string  // First slide hook — AI scores variants, picks best
}

function buildSlideGenerationPrompt(sourceText: string, brand: BrandRow, slideCount: number): string {
  return [
    `Create a ${slideCount}-slide carousel post from the source content below.`,
    `Brand voice: ${brand.voiceTone}`,
    `Brand niche: ${brand.niche}`,
    '',
    'Slide structure:',
    '- Slide 1 (Hook): Attention-grabbing title that stops the scroll. Short, punchy, 5-8 words.',
    `- Slides 2-${slideCount - 1} (Content): Each covers one key insight. Title: short label. Body: 1-2 sentences max.`,
    `- Slide ${slideCount} (CTA): Summarize the value + call to action.`,
    '',
    'SOURCE CONTENT:',
    sourceText,
    '',
    'Return ONLY valid JSON:',
    `{ "slides": [{ "title": "...", "body": "..." }, ...] }`,
    `Array must have exactly ${slideCount} items.`,
  ].join('\n')
}
```

### Pattern 5: Database Schema for Carousels

**What:** Two new tables — `carousels` (one row per carousel) and `carousel_slides` (one row per slide, with the R2 key). The `carousels` table links to `brands` and optionally `posts`.

```typescript
// src/db/schema.ts additions

export const carousels = sqliteTable('carousels', {
  id:           integer().primaryKey({ autoIncrement: true }),
  brandId:      integer('brand_id').notNull().references(() => brands.id),
  postId:       integer('post_id').references(() => posts.id),  // nullable
  templateId:   text('template_id').notNull(),                   // e.g. 'minimal', 'bold', etc.
  sourceText:   text('source_text'),
  slideCount:   integer('slide_count').notNull(),
  r2Bucket:     text('r2_bucket').notNull(),
  status:       text({ enum: ['draft', 'ready'] }).notNull().default('draft'),
  createdAt:    text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const carouselSlides = sqliteTable('carousel_slides', {
  id:           integer().primaryKey({ autoIncrement: true }),
  carouselId:   integer('carousel_id').notNull().references(() => carousels.id),
  slideIndex:   integer('slide_index').notNull(),   // 0-based
  title:        text().notNull(),
  body:         text(),
  r2Key:        text('r2_key').notNull(),           // R2 key for the PNG
  thumbKey:     text('thumb_key'),                   // optional 400px thumb
  createdAt:    text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})
```

### Pattern 6: R2 Key Naming for Carousel Slides

```typescript
// Convention matching image-gen.ts pattern
const timestamp = Date.now()
const slideKey = `brands/${brandId}/carousels/${timestamp}/slide-${index}.png`
const thumbKey = `brands/${brandId}/carousels/${timestamp}/slide-${index}-thumb.jpg`
```

### Anti-Patterns to Avoid

- **Using JSX with Satori in server actions:** JSX requires a build-time transform. The validated pattern uses object vnodes (`{ type: 'div', props: { ... } }`). Do not use `<div>` syntax in carousel-gen.ts.
- **Loading WOFF2 fonts:** Satori 0.10.x rejects WOFF2 with "Unsupported OpenType signature wOF2". Only WOFF/OTF/TTF work. This was discovered and documented in Phase 0.
- **Loading Inter variable TTF:** The variable TTF from google/fonts crashes Satori with "Cannot read properties of undefined reading '256'". Use the static weight WOFF files from @fontsource/inter.
- **Rendering server-side PNGs for every preview:** Satori+sharp per slide takes ~50-150ms. For a 5-slide carousel that is 750ms per template preview interaction. Use CSS HTML preview in the browser; render real PNGs only on final save.
- **Importing satori/sharp at top level in server actions:** Both need to stay in server-only modules. satori and sharp are in `serverExternalPackages` — they work fine, but keep them in `src/lib/carousel-gen.ts`, not imported directly from action files with 'use server'.
- **Using `margin: 'auto'` for vertical spacing in Satori:** Satori's flexbox support has quirks with auto-margins. Use `justifyContent: 'space-between'` or `marginTop: 'auto'` with caution — test each layout.
- **`position: 'absolute'` for logo overlay:** Satori supports absolute positioning but the parent must be `position: 'relative'`. Logo placement for branding (bottom corner) should use absolute positioning within a relative container.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG → PNG conversion | canvas, puppeteer, Playwright | sharp (already installed) | 2-3x faster, no browser binary, prebuilt Linux binary |
| Slide layout engine | Custom CSS-in-JS | Satori vnode objects (already installed) | Validated on Railway Linux; handles flexbox, text wrapping, images |
| Font loading/embedding | Custom font subsetting | Load WOFF buffers + pass to Satori fonts array | Satori handles all embedding internally |
| R2 file upload | Custom S3 client | uploadToR2() from r2.ts (already exists) | Handles checksum quirk for R2 compatibility |
| Image thumbnails | Custom resize logic | sharp .resize(400).jpeg() (already in image-gen.ts) | Same pattern already proven for generatedImages |
| AI JSON parsing | Custom parser | parseJsonResponse() from generate.ts (already exists) | Handles markdown fence stripping, error cases |

**Key insight:** Every infrastructure piece exists. Phase 4 is purely about templates, content generation prompt, and carousel-specific UI. No new libraries, no new infrastructure risk.

---

## Common Pitfalls

### Pitfall 1: Font Weight Mismatch in Templates

**What goes wrong:** Template specifies `fontWeight: 700` in the vnode style but only the 400-weight WOFF is loaded in the `fonts` array. Satori silently falls back to the available weight, making bold headings look the same as body text.

**Why it happens:** Inter-Regular.woff (weight 400) is the only font in `public/fonts/` from Phase 0. Templates that use bold/semibold will silently degrade if the corresponding WOFF files are not copied and loaded.

**How to avoid:** Copy `inter-latin-700-normal.woff` and `inter-latin-600-normal.woff` from `node_modules/@fontsource/inter/files/` to `public/fonts/Inter-Bold.woff` and `public/fonts/Inter-SemiBold.woff` as part of Phase 4 setup. Pass all three weights to `satori()` fonts array.

**Warning signs:** Headings look identical weight to body text in rendered PNGs.

### Pitfall 2: Satori Does Not Support All CSS Properties

**What goes wrong:** Template uses a CSS property that Satori doesn't support (e.g., `gap` on some older Satori versions, `text-overflow: ellipsis` without explicit width, `border-radius` on non-flex containers). Render silently omits the style or throws.

**Why it happens:** Satori implements a subset of CSS. It does not support CSS Grid, `calc()`, CSS variables, `clip-path`, `filter`, `backdrop-filter`, or most pseudo-elements.

**How to avoid:** Stick to flexbox layouts (fully supported). For text truncation: set explicit `width`, `overflow: 'hidden'`, `textOverflow: 'ellipsis'`, `whiteSpace: 'nowrap'`. Avoid CSS Grid entirely. Satori supports: flexbox, absolute/relative positioning, borders, border-radius, box-shadow (with caveats), linear/radial gradients, `<img>` for remote images.

**Warning signs:** Styles silently not applied; layout looks broken; no error thrown.

### Pitfall 3: Remote Logo URL Fetch Failures Blocking Render

**What goes wrong:** The last slide (CTA) tries to render brand logo via `<img src={logoUrl}>`. The logo URL is unreachable at render time (CORS, authentication, 404). Satori throws or renders a broken image.

**Why it happens:** Satori fetches remote images during SVG generation. If the brand has a `logoUrl` that requires auth or is hosted on a service that blocks server-side requests, the fetch fails.

**How to avoid:** Follow the same non-fatal watermark pattern from `image-gen.ts` — wrap logo rendering in try/catch and render the slide without the logo if fetch fails. Log the error. Alternatively: if `logoUrl` is present, pre-fetch and inline as base64 data URI before passing to Satori.

**Warning signs:** Carousel render throws on last slide (CTA); entire carousel fails instead of graceful degradation.

### Pitfall 4: Satori `img` Element Requires Explicit Width/Height

**What goes wrong:** `<img src="..." style={{ width: 80 }}>` in Satori does not auto-size the height. Image renders as a thin strip or zero height.

**Why it happens:** Satori does not perform intrinsic size lookups on images. Both `width` and `height` must be specified explicitly in the style object.

**How to avoid:** Always provide both `width` and `height` on any `{ type: 'img' }` element. For logos: `style: { width: 60, height: 60, objectFit: 'contain' }`.

**Warning signs:** Logo appears as a thin horizontal line or zero-pixel element.

### Pitfall 5: Slide Count vs AI Output Mismatch

**What goes wrong:** AI is asked to produce 5 slides but returns 4 or 6. Downstream code assumes fixed array length, causing index errors when assigning `type: 'hook'` to index 0 and `type: 'cta'` to the last index.

**Why it happens:** LLMs do not reliably produce exactly N items in a JSON array even when instructed. Parse succeeds but `slides.length !== requestedCount`.

**How to avoid:** After parsing AI response, validate `slides.length === slideCount`. If mismatch: pad with empty content slides or trim, then log a warning. The hook (index 0) and CTA (last index) assignment should be based on position, not on AI-provided `type` field.

**Warning signs:** First slide is not hook-styled; last slide has no CTA.

### Pitfall 6: next.config.ts serverExternalPackages

**What goes wrong:** `satori` is not in `serverExternalPackages` and Next.js standalone tries to bundle it, causing build failures or runtime errors.

**Why it happens:** `satori` is not in Next.js 15's automatic externals list (unlike `better-sqlite3`, `sharp`, `node-cron`). Phase 3 already added `openai` manually — satori may need the same treatment.

**How to avoid:** Verify `satori` behavior in standalone build. If it fails, add `'satori'` to `serverExternalPackages` in `next.config.ts`. Current config already has `['better-sqlite3', 'node-cron', 'pdf-parse', 'openai']`.

**Warning signs:** Build error mentioning satori cannot be bundled; or runtime `Cannot find module 'satori'` in standalone.

---

## Code Examples

### Complete Slide Render Pipeline (from validated patterns)

```typescript
// Source: scripts/validate/04-satori-sharp.ts + src/lib/image-gen.ts
// Location: src/lib/carousel-gen.ts

import satori from 'satori'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { uploadToR2 } from '@/lib/r2'

function loadFonts() {
  const dir = path.join(process.cwd(), 'public', 'fonts')
  return [
    { name: 'Inter', data: fs.readFileSync(path.join(dir, 'Inter-Regular.woff')),  weight: 400, style: 'normal' as const },
    { name: 'Inter', data: fs.readFileSync(path.join(dir, 'Inter-SemiBold.woff')), weight: 600, style: 'normal' as const },
    { name: 'Inter', data: fs.readFileSync(path.join(dir, 'Inter-Bold.woff')),     weight: 700, style: 'normal' as const },
  ]
}

export async function renderCarouselSlides(params: {
  templateId: string
  brandId: number
  brandStyle: BrandStyle
  slides: SlideData[]
}): Promise<{ r2Keys: string[]; thumbKeys: string[] }> {
  const fonts = loadFonts()
  const bucket = process.env.R2_MEDIA_BUCKET ?? 'social-media'
  const timestamp = Date.now()
  const r2Keys: string[] = []
  const thumbKeys: string[] = []

  for (let i = 0; i < params.slides.length; i++) {
    const slide = params.slides[i]
    const vnode = TEMPLATES[params.templateId](params.brandStyle, slide)

    // Satori: vnode → SVG
    const svg = await satori(vnode as any, { width: 1080, height: 1080, fonts })

    // sharp: SVG → PNG
    const png = await sharp(Buffer.from(svg)).png().toBuffer()

    // Thumbnail: 400x400 JPEG
    const thumb = await sharp(Buffer.from(svg))
      .resize(400, 400, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer()

    const slideKey = `brands/${params.brandId}/carousels/${timestamp}/slide-${i}.png`
    const thumbKey = `brands/${params.brandId}/carousels/${timestamp}/slide-${i}-thumb.jpg`

    await uploadToR2(bucket, slideKey, png)
    await uploadToR2(bucket, thumbKey, thumb)

    r2Keys.push(slideKey)
    thumbKeys.push(thumbKey)
  }

  return { r2Keys, thumbKeys }
}
```

### AI Slide Content Generation (matches generate.ts patterns)

```typescript
// Source: src/app/actions/generate.ts patterns
// Location: src/app/actions/carousels.ts

'use server'
import Anthropic from '@anthropic-ai/sdk'
import { getModelConfig, checkAiSpend, logAiSpend } from '@/lib/ai'
import { getBreaker } from '@/lib/circuit-breaker'

const anthropic = new Anthropic()

export interface SlideContent {
  slides: Array<{ title: string; body: string }>
}

export async function generateSlideContent(
  brandId: number,
  sourceText: string,
  slideCount: number,
): Promise<{ slides: SlideContent['slides']; error?: string }> {
  const underLimit = await checkAiSpend()
  if (!underLimit) return { slides: [], error: 'Daily AI spend limit reached' }

  const modelConfig = getModelConfig()
  const prompt = buildSlideGenerationPrompt(sourceText, slideCount)

  try {
    const response = await getBreaker('anthropic').call(() =>
      anthropic.messages.create({
        model: modelConfig.primary,
        max_tokens: 2048,
        system: 'You are a carousel content writer. Respond with ONLY valid JSON -- no markdown fences.',
        messages: [{ role: 'user', content: prompt }],
      })
    )

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = parseJsonResponse<SlideContent>(text)

    // Validate slide count — pad or trim as needed
    let slides = parsed.slides ?? []
    if (slides.length < slideCount) {
      while (slides.length < slideCount) slides.push({ title: '', body: '' })
    } else if (slides.length > slideCount) {
      slides = slides.slice(0, slideCount)
    }

    const costUsd = calculateCostUsd(modelConfig.primary, response.usage.input_tokens, response.usage.output_tokens)
    logAiSpend({ brandId, model: modelConfig.primary, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costUsd })

    return { slides }
  } catch (err) {
    return { slides: [], error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
```

---

## Template Design: 3-5 Layouts

Based on brand schema fields and social carousel best practices, the following 3 templates cover the main visual aesthetics. The planner should target exactly 3 to match the "3-5" requirement while being achievable in 2 days.

| Template ID | Visual Style | Best For | Key Brand Fields Used |
|-------------|-------------|----------|----------------------|
| `minimal` | Dark bg, white text, accent color number/title | Professional, thought leadership | primaryColor (accent), voiceTone |
| `bold` | Full primaryColor bg on hook/CTA, white content slides | High-energy, consumer brands | primaryColor (full bg), secondaryColor (body text) |
| `gradient` | Linear gradient (primary→secondary) header bar, light bg body | Modern, polished | primaryColor + secondaryColor gradient |

All 3 templates share:
- Slide number indicator (top left, accent color)
- Title (large, bold, white or dark)
- Body text (smaller, secondary color)
- CTA slide: brand.ctaText + account handle (from connected social accounts)
- Optional logo: `{ type: 'img' }` at bottom corner if `brand.logoUrl` is set

---

## Carousel UI Design

The carousel page follows established patterns in the codebase:

| Pattern | Source | Apply Here |
|---------|--------|------------|
| Server page + client section | generate/page.tsx + generate-section.tsx | carousels/page.tsx + carousel-section.tsx |
| useTransition for async server actions | generate-section.tsx | generateSlideContent() + renderAndSaveCarousel() |
| Separate loading states per operation | genCost/isPending/isSaving in generate-section | isPendingContent / isPendingRender transitions |
| Textarea per editable item | generate-section.tsx content tabs | One Textarea per slide title + body |
| Error display pattern | `<div className="rounded-md bg-destructive/10">` | Same for carousel errors |

For template picker: radio-button-style cards showing CSS mockup (not real Satori PNG). Show brand primary color as background color in the mockup. This avoids server roundtrips during selection.

For slide preview: CSS representation of each slide in a horizontal scroll or numbered list. Actual PNG preview only after clicking "Render" (final step).

The route should be `/brands/[id]/carousels` — add a "Carousels" link to the brand detail page (matching "Media Library" link added in Phase 3).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| puppeteer/headless Chrome for HTML → image | Satori + sharp | ~2023 (Satori v0.1) | 10x faster, no binary, works in serverless/containers |
| JSX components for Satori | Object-vnode approach | Project decision (Phase 0) | No JSX transform needed in server-only lib files |
| WOFF2 fonts (common CDN default) | WOFF fonts only for Satori | Validated Phase 0 | WOFF2 rejected; WOFF from @fontsource works |

---

## Open Questions

1. **Does `satori` need to be added to `serverExternalPackages`?**
   - What we know: `satori` is pure JS (no native deps); Next.js 15 auto-externals list includes `sharp` but may or may not include `satori`
   - What's unclear: Whether Next.js standalone bundling of `satori` causes issues
   - Recommendation: Wave 0 task — test build with `satori` in carousel-gen.ts; if standalone fails, add `'satori'` to `serverExternalPackages` in `next.config.ts`

2. **How to display slide handle (e.g. "@brandname") on CTA slide?**
   - What we know: `brand.bioLink` is a URL (not a handle); connected social accounts have `username` field
   - What's unclear: Which account username to show (brand may have multiple platforms)
   - Recommendation: The carousel renderer receives a `handle` param passed from the action; the action picks the first connected account username, or uses brand name as fallback

3. **Should carousel images be associated with a post?**
   - What we know: `generatedImages.postId` is nullable — images can exist without posts
   - What's unclear: Whether the user wants to attach a carousel to a specific post at generation time vs later
   - Recommendation: Keep `carousels.postId` nullable (same pattern as generatedImages). Association with posts can be done later when scheduling is implemented in Phase 5.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — validation scripts only (same as Phase 0 pattern) |
| Config file | none |
| Quick run command | `npx tsx scripts/validate/04-satori-sharp.ts` (existing, still valid) |
| Full suite command | `npx tsx scripts/validate/04-satori-sharp.ts` (carousel render verified via browser preview) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CARO-01 | 3 Satori templates render with brand colors + fonts | smoke | `npx tsx scripts/validate/04-satori-sharp.ts` (existing validates pipeline) | Yes (validates pipeline; template rendering verified via browser) |
| CARO-02 | First slide = hook layout, last slide = CTA layout | unit | manual — visual inspection of rendered PNGs | Wave 0 |
| CARO-03 | AI generates slide content JSON from source text | integration | manual — generate via UI, confirm slide count + structure | N/A (UI test) |
| CARO-04 | User can preview, pick template, edit slides | e2e | manual — browser walkthrough | N/A (UI test) |
| CARO-05 | Satori → sharp → R2 stores PNG per slide | smoke | manual — check R2 keys in media library or DB after generation | N/A (manual verify) |

### Sampling Rate

- **Per task commit:** `npx tsx scripts/validate/04-satori-sharp.ts` (confirms Satori+sharp pipeline still works)
- **Per wave merge:** Build check (`npm run build`) confirms no bundling issues with satori in standalone
- **Phase gate:** Full browser walkthrough: generate slides from source text → pick template → edit → render → confirm PNGs appear in R2 (via DB or carousel list page)

### Wave 0 Gaps

- [ ] Copy `inter-latin-700-normal.woff` → `public/fonts/Inter-Bold.woff`
- [ ] Copy `inter-latin-600-normal.woff` → `public/fonts/Inter-SemiBold.woff`
- [ ] `src/db/schema.ts` — add `carousels` + `carouselSlides` tables
- [ ] Drizzle migration for new tables
- [ ] Verify `satori` bundling behavior in standalone build (may need to add to `serverExternalPackages`)

---

## Sources

### Primary (HIGH confidence)

- `scripts/validate/04-satori-sharp.ts` — Phase 0 validated Satori object-vnode + WOFF font + sharp PNG pipeline (2026-03-16)
- `00-01-SUMMARY.md` patterns-established — WOFF-only constraint, 1080x1080 confirmed, async main() pattern (2026-03-16)
- `src/db/schema.ts` — brand fields available: primaryColor, secondaryColor, logoUrl, ctaText, watermarkPosition, watermarkOpacity
- `src/lib/image-gen.ts` — R2 upload pattern, sharp thumbnail pattern, uploadToR2 usage
- `src/lib/r2.ts` — uploadToR2(), getR2PublicUrl() APIs confirmed
- `src/app/actions/generate.ts` — Anthropic client pattern, parseJsonResponse, calculateCostUsd, logAiSpend, getBreaker
- `package.json` — All required deps confirmed installed: satori@^0.10.0, sharp@^0.33.0, @anthropic-ai/sdk@^0.79.0, @fontsource/inter (devDep)
- `node_modules/@fontsource/inter/files/` — Latin WOFF files for weights 400, 500, 600, 700 confirmed present

### Secondary (MEDIUM confidence)

- Satori GitHub README (https://github.com/vercel/satori) — supported CSS subset, image requirements, font format constraints
- `next.config.ts` — current serverExternalPackages list: `['better-sqlite3', 'node-cron', 'pdf-parse', 'openai']`

### Tertiary (LOW confidence)

- Satori CSS `margin: 'auto'` behavior in flexbox — needs local test to confirm exact support; use `justifyContent: 'space-between'` as safer alternative

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and validated in production
- Architecture: HIGH — follows proven patterns from generate.ts and image-gen.ts
- Satori template CSS: MEDIUM — core layout patterns confirmed; edge cases (margin:auto, img sizing) need local testing during implementation
- Pitfalls: HIGH — most pitfalls are already-discovered and documented in Phase 0 + STATE.md decisions

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (stable tech; Satori 0.10.x API has not changed since Phase 0 validation)
