'use server'

import Anthropic from '@anthropic-ai/sdk'
import { getDb } from '@/db'
import { brands, socialAccounts, carousels, carouselSlides } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { getModelConfig, checkAiSpend, logAiSpend } from '@/lib/ai'
import { getBreaker } from '@/lib/circuit-breaker'
import { renderCarouselSlides, type BrandStyle, type SlideData, type TemplateId, TEMPLATE_IDS } from '@/lib/carousel-gen'
import { getR2PublicUrl } from '@/lib/r2'

// ─── Module-level Anthropic client ───────────────────────────────────────────

const anthropic = new Anthropic()

// ─── Internal helpers (duplicated from generate.ts -- small private utilities) ──

function parseJsonResponse<T>(text: string): T {
  // Strip markdown fences if present
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    throw new Error(`Failed to parse AI response as JSON. Raw text: ${cleaned.slice(0, 200)}`)
  }
}

function calculateCostUsd(model: string, inputTokens: number, outputTokens: number): string {
  // Prices per million tokens
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-20250514':  { input: 3.00,  output: 15.00 },
    'claude-opus-4-20250514':    { input: 15.00, output: 75.00 },
    'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
  }
  const p = pricing[model] ?? { input: 3.00, output: 15.00 }
  const cost = (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
  return cost.toFixed(6)
}

// ─── Exported server actions ─────────────────────────────────────────────────

interface SlideContentItem {
  title: string
  body: string
}

interface GenerateSlidesJson {
  slides: SlideContentItem[]
}

/**
 * Generate AI slide content from source text.
 * Returns an array of { title, body } for each slide.
 */
export async function generateSlideContent(
  brandId: number,
  sourceText: string,
  slideCount: number,
): Promise<{ slides: SlideContentItem[]; costUsd: number; error?: string }> {
  const emptyResult = { slides: [], costUsd: 0 }

  try {
    // 1. Check AI spend limit
    const underLimit = await checkAiSpend()
    if (!underLimit) {
      return { ...emptyResult, error: 'Daily AI spend limit reached' }
    }

    // 2. Look up brand for context
    const db = getDb()
    const brand = db.select().from(brands).where(eq(brands.id, brandId)).get()
    if (!brand) {
      return { ...emptyResult, error: 'Brand not found' }
    }

    // 3. Get model config
    const modelConfig = getModelConfig()
    const model = modelConfig.primary

    // 4. Build prompt
    const prompt = [
      `You are creating a ${slideCount}-slide carousel for the brand "${brand.name}".`,
      `Brand niche: ${brand.niche}`,
      `Voice and tone: ${brand.voiceTone}`,
      '',
      'SOURCE TEXT TO TURN INTO CAROUSEL SLIDES:',
      sourceText,
      '',
      `Create exactly ${slideCount} slides following these rules:`,
      `- Slide 1 (Hook): Attention-grabbing title, 5-8 words. Body is optional (can be empty string).`,
      `- Slides 2 to ${slideCount - 1} (Content): Each covers one key insight. Title: short label (2-5 words). Body: 1-2 sentences max.`,
      `- Slide ${slideCount} (CTA): Summarize value + call to action. Title = summary phrase. Body = CTA text.`,
      '',
      'Return ONLY valid JSON -- no markdown fences, no commentary:',
      '{',
      '  "slides": [',
      '    { "title": "...", "body": "..." },',
      `    ... (exactly ${slideCount} items)`,
      '  ]',
      '}',
    ].join('\n')

    // 5. Call Anthropic via circuit breaker
    const response = await getBreaker('anthropic').call(() =>
      anthropic.messages.create({
        model,
        max_tokens: 2048,
        system: 'You are a carousel content expert. Respond with ONLY valid JSON -- no markdown fences, no commentary.',
        messages: [{ role: 'user', content: prompt }],
      })
    )

    // 6. Parse response
    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = parseJsonResponse<GenerateSlidesJson>(rawText)
    let slides = parsed.slides ?? []

    // 7. Validate slide count -- pad or trim if AI didn't match exactly
    if (slides.length !== slideCount) {
      console.warn(`[carousel] AI returned ${slides.length} slides, expected ${slideCount}. Adjusting.`)
      if (slides.length < slideCount) {
        // Pad with empty slides
        while (slides.length < slideCount) {
          slides.push({ title: '', body: '' })
        }
      } else {
        // Trim to requested count
        slides = slides.slice(0, slideCount)
      }
    }

    // 8. Log AI spend
    const costStr = calculateCostUsd(model, response.usage.input_tokens, response.usage.output_tokens)
    logAiSpend({
      brandId,
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      costUsd: costStr,
    })

    return { slides, costUsd: parseFloat(costStr) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during slide generation'
    return { ...emptyResult, error: message }
  }
}

/**
 * Render carousel slides to PNGs via Satori+sharp, upload to R2, and persist
 * carousel + slide records to the database.
 */
export async function renderAndSaveCarousel(params: {
  brandId: number
  templateId: string
  sourceText: string
  slides: SlideContentItem[]
}): Promise<{ carouselId: number; error?: string }> {
  const { brandId, templateId, sourceText, slides } = params

  try {
    const db = getDb()

    // 1. Look up brand
    const brand = db.select().from(brands).where(eq(brands.id, brandId)).get()
    if (!brand) {
      return { carouselId: 0, error: 'Brand not found' }
    }

    // 2. Look up first connected social account for CTA handle
    const account = db
      .select({ username: socialAccounts.username })
      .from(socialAccounts)
      .where(eq(socialAccounts.brandId, brandId))
      .limit(1)
      .get()

    const handle = account ? `@${account.username}` : `@${brand.name}`

    // 3. Build BrandStyle
    const brandStyle: BrandStyle = {
      primaryColor: brand.primaryColor ?? '#6366f1',
      secondaryColor: brand.secondaryColor ?? undefined,
      logoUrl: brand.logoUrl ?? undefined,
      fontFamily: 'Inter',
    }

    // 4. Map slides to SlideData[]
    const totalSlides = slides.length
    const slideDataArray: SlideData[] = slides.map((slide, index) => {
      const slideNumber = index + 1
      if (index === 0) {
        return {
          type: 'hook' as const,
          title: slide.title,
          body: slide.body || undefined,
          slideNumber,
          totalSlides,
        }
      }
      if (index === totalSlides - 1) {
        return {
          type: 'cta' as const,
          title: slide.title,
          body: slide.body || undefined,
          slideNumber,
          totalSlides,
          ctaText: brand.ctaText ?? 'Follow for more',
          handle,
        }
      }
      return {
        type: 'content' as const,
        title: slide.title,
        body: slide.body || undefined,
        slideNumber,
        totalSlides,
      }
    })

    // 5. Validate + normalize templateId
    const validTemplateId: TemplateId = (TEMPLATE_IDS as readonly string[]).includes(templateId)
      ? (templateId as TemplateId)
      : 'minimal'

    // 6. Render slides via Satori + sharp + R2
    const { r2Keys, thumbKeys } = await renderCarouselSlides({
      templateId: validTemplateId,
      brandId,
      brandStyle,
      slides: slideDataArray,
    })

    // 7. Insert carousel record
    const carouselResult = db.insert(carousels).values({
      brandId,
      templateId: validTemplateId,
      sourceText,
      slideCount: slides.length,
      status: 'ready',
    }).returning({ id: carousels.id }).get()

    const carouselId = carouselResult.id

    // 8. Insert carousel slide records
    for (let i = 0; i < slides.length; i++) {
      db.insert(carouselSlides).values({
        carouselId,
        slideIndex: i,
        title: slides[i].title,
        body: slides[i].body || null,
        r2Key: r2Keys[i],
        thumbKey: thumbKeys[i] ?? null,
      }).run()
    }

    return { carouselId }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to render and save carousel'
    return { carouselId: 0, error: message }
  }
}

/**
 * Retrieve all carousels for a brand, with nested slide data.
 */
export async function getCarousels(brandId: number): Promise<Array<{
  id: number
  templateId: string
  slideCount: number
  status: string
  createdAt: string
  slides: Array<{ slideIndex: number; title: string; thumbUrl: string | null; r2Key: string }>
}>> {
  const db = getDb()

  // Query carousels ordered by newest first
  const carouselRows = db
    .select()
    .from(carousels)
    .where(eq(carousels.brandId, brandId))
    .orderBy(carousels.createdAt)
    .all()
    .reverse()

  const result = []

  for (const carousel of carouselRows) {
    const slideRows = db
      .select()
      .from(carouselSlides)
      .where(eq(carouselSlides.carouselId, carousel.id))
      .orderBy(carouselSlides.slideIndex)
      .all()

    const slides = slideRows.map(slide => {
      let thumbUrl: string | null = null
      if (slide.thumbKey) {
        try {
          thumbUrl = getR2PublicUrl(slide.thumbKey)
        } catch {
          // Non-fatal: R2_MEDIA_PUBLIC_BASE may not be set in dev
          thumbUrl = null
        }
      }

      return {
        slideIndex: slide.slideIndex,
        title: slide.title,
        thumbUrl,
        r2Key: slide.r2Key,
      }
    })

    result.push({
      id: carousel.id,
      templateId: carousel.templateId,
      slideCount: carousel.slideCount,
      status: carousel.status,
      createdAt: carousel.createdAt,
      slides,
    })
  }

  return result
}
