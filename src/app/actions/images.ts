'use server'

import { getDb } from '@/db'
import { brands, generatedImages } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'
import { checkAiSpend, logAiSpend } from '@/lib/ai'
import { generateBrandImage } from '@/lib/image-gen'
import { getR2PublicUrl } from '@/lib/r2'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MediaImage {
  id: number
  brandId: number
  prompt: string
  fullUrl: string
  thumbUrl: string
  costUsd: string
  type: string
  createdAt: string
}

// ─── Server Actions ───────────────────────────────────────────────────────────

/**
 * Generate a brand-consistent image using gpt-image-1.
 * Applies watermark, creates thumbnail, uploads both to R2, and records metadata.
 */
export async function generateImage(
  brandId: number,
  prompt: string,
): Promise<{ imageId: number; error?: string }> {
  try {
    const db = getDb()

    // 1. Query brand for style directives
    const brand = db.select().from(brands).where(eq(brands.id, brandId)).get()
    if (!brand) {
      return { imageId: 0, error: 'Brand not found' }
    }

    // 2. Build brand style directive from brand profile
    const colorPalette = [brand.primaryColor, brand.secondaryColor]
      .filter(Boolean)
      .join(' and ')
    const brandStyleDirective = [
      `Create an image for a ${brand.niche} brand.`,
      colorPalette ? `Use a color palette featuring ${colorPalette}.` : '',
      `The visual style should be ${brand.voiceTone}.`,
    ]
      .filter(Boolean)
      .join(' ')

    // 3. Check AI spend limit
    const underLimit = await checkAiSpend()
    if (!underLimit) {
      return { imageId: 0, error: 'Daily AI spend limit reached' }
    }

    // 4. Generate image (OpenAI -> watermark -> thumbnail -> R2)
    const result = await generateBrandImage({
      prompt,
      brandStyleDirective,
      logoUrl: brand.logoUrl ?? undefined,
      watermarkPosition: brand.watermarkPosition ?? undefined,
      watermarkOpacity: brand.watermarkOpacity ?? undefined,
      brandId,
    })

    // 5. Record in database
    const bucket = process.env.R2_MEDIA_BUCKET ?? 'social-media'
    const inserted = db.insert(generatedImages).values({
      brandId,
      postId: null,
      prompt,
      fullKey: result.fullKey,
      thumbKey: result.thumbKey,
      r2Bucket: bucket,
      costUsd: result.costUsd,
      type: 'generated',
    }).returning({ id: generatedImages.id }).get()

    // 6. Log AI spend (image generation has no token counts -- just cost)
    logAiSpend({
      brandId,
      model: 'gpt-image-1',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: result.costUsd,
    })

    return { imageId: inserted.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during image generation'
    return { imageId: 0, error: message }
  }
}

/**
 * Regenerate an image using a new prompt.
 * Looks up the existing image's brandId and delegates to generateImage.
 */
export async function regenerateImage(
  imageId: number,
  newPrompt: string,
): Promise<{ imageId: number; error?: string }> {
  try {
    const db = getDb()

    const existing = db.select({ brandId: generatedImages.brandId })
      .from(generatedImages)
      .where(eq(generatedImages.id, imageId))
      .get()

    if (!existing) {
      return { imageId: 0, error: 'Image not found' }
    }

    return generateImage(existing.brandId, newPrompt)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during image regeneration'
    return { imageId: 0, error: message }
  }
}

/**
 * Retrieve the media library for a brand.
 * Returns all generated images ordered by creation date (newest first),
 * with public URLs constructed from R2 keys.
 */
export async function getMediaLibrary(brandId: number): Promise<MediaImage[]> {
  const db = getDb()

  const rows = db.select()
    .from(generatedImages)
    .where(eq(generatedImages.brandId, brandId))
    .orderBy(desc(generatedImages.createdAt))
    .all()

  return rows.map((row) => ({
    id: row.id,
    brandId: row.brandId,
    prompt: row.prompt,
    fullUrl: getR2PublicUrl(row.fullKey),
    thumbUrl: getR2PublicUrl(row.thumbKey),
    costUsd: row.costUsd,
    type: row.type,
    createdAt: row.createdAt,
  }))
}
