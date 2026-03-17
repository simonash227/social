import satori from 'satori'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { uploadToR2 } from '@/lib/r2'

// ─── Exported Types ───────────────────────────────────────────────────────────

export interface BrandStyle {
  primaryColor: string      // e.g. "#6366f1"
  secondaryColor?: string   // fallback to primaryColor if undefined
  logoUrl?: string           // optional logo for CTA slide
  fontFamily: string         // always "Inter"
}

export interface SlideData {
  type: 'hook' | 'content' | 'cta'
  title: string
  body?: string
  slideNumber: number
  totalSlides: number
  ctaText?: string           // only on type='cta'
  handle?: string            // e.g. "@brandname" on CTA slide
}

export const TEMPLATE_IDS = ['minimal', 'bold', 'gradient'] as const
export type TemplateId = typeof TEMPLATE_IDS[number]

// ─── Font Loading ─────────────────────────────────────────────────────────────

function loadFonts() {
  const dir = path.join(process.cwd(), 'public', 'fonts')
  return [
    { name: 'Inter', data: fs.readFileSync(path.join(dir, 'Inter-Regular.woff')),  weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: fs.readFileSync(path.join(dir, 'Inter-SemiBold.woff')), weight: 600 as const, style: 'normal' as const },
    { name: 'Inter', data: fs.readFileSync(path.join(dir, 'Inter-Bold.woff')),     weight: 700 as const, style: 'normal' as const },
  ]
}

// ─── Template: Minimal ────────────────────────────────────────────────────────
// Dark background (#0f0f0f), white text, brand primaryColor for accents.
// CTA slide uses primaryColor as background.

function templateMinimal(brand: BrandStyle, slide: SlideData): object {
  const accent = brand.primaryColor

  // Build logo element for CTA slide
  let logoEl: object | null = null
  if (slide.type === 'cta' && brand.logoUrl) {
    try {
      logoEl = {
        type: 'img',
        props: {
          src: brand.logoUrl,
          style: {
            position: 'absolute' as const,
            bottom: 40,
            right: 40,
            width: 60,
            height: 60,
          },
        },
      }
    } catch {
      // Non-fatal: render without logo
      logoEl = null
    }
  }

  const isCta = slide.type === 'cta'
  const bg = isCta ? accent : '#0f0f0f'
  const titleColor = isCta ? '#ffffff' : '#ffffff'
  const bodyColor = '#cccccc'

  const children: object[] = [
    // Slide number indicator
    {
      type: 'div',
      props: {
        style: { fontSize: 16, color: accent, fontWeight: 400, marginBottom: 0 },
        children: `${slide.slideNumber} / ${slide.totalSlides}`,
      },
    },
    // Main content area
    {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column' as const,
          flex: 1,
          justifyContent: 'center',
          paddingTop: 40,
          paddingBottom: 40,
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                fontSize: 56,
                fontWeight: 700,
                color: titleColor,
                lineHeight: 1.15,
                marginBottom: 24,
              },
              children: slide.title,
            },
          },
          slide.body ? {
            type: 'div',
            props: {
              style: {
                fontSize: 28,
                fontWeight: 400,
                color: isCta ? 'rgba(255,255,255,0.85)' : bodyColor,
                lineHeight: 1.5,
              },
              children: slide.body,
            },
          } : null,
          isCta && slide.ctaText ? {
            type: 'div',
            props: {
              style: {
                fontSize: 32,
                fontWeight: 600,
                color: '#ffffff',
                marginTop: 32,
              },
              children: slide.ctaText,
            },
          } : null,
          isCta && slide.handle ? {
            type: 'div',
            props: {
              style: {
                fontSize: 20,
                fontWeight: 400,
                color: accent,
                marginTop: 12,
              },
              children: slide.handle,
            },
          } : null,
        ].filter(Boolean),
      },
    },
  ].filter(Boolean) as object[]

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'space-between',
        width: 1080,
        height: 1080,
        background: bg,
        padding: 64,
        fontFamily: 'Inter',
        position: 'relative' as const,
      },
      children: [...children, logoEl].filter(Boolean),
    },
  }
}

// ─── Template: Bold ───────────────────────────────────────────────────────────
// Full primaryColor background on hook + CTA, white background on content slides.
// Large 64px bold title. Left border strip on content slides.

function templateBold(brand: BrandStyle, slide: SlideData): object {
  const accent = brand.primaryColor
  const isColorSlide = slide.type === 'hook' || slide.type === 'cta'
  const bg = isColorSlide ? accent : '#ffffff'
  const titleColor = isColorSlide ? '#ffffff' : '#111111'
  const bodyColor = '#333333'

  // Logo for CTA slide
  let logoEl: object | null = null
  if (slide.type === 'cta' && brand.logoUrl) {
    try {
      logoEl = {
        type: 'img',
        props: {
          src: brand.logoUrl,
          style: {
            position: 'absolute' as const,
            bottom: 40,
            right: 40,
            width: 60,
            height: 60,
          },
        },
      }
    } catch {
      logoEl = null
    }
  }

  // Left accent border strip for content slides
  const leftBorder: object | null = !isColorSlide ? {
    type: 'div',
    props: {
      style: {
        position: 'absolute' as const,
        left: 0,
        top: 0,
        bottom: 0,
        width: 8,
        background: accent,
      },
    },
  } : null

  const mainContent: object[] = [
    {
      type: 'div',
      props: {
        style: {
          fontSize: 16,
          color: isColorSlide ? 'rgba(255,255,255,0.7)' : accent,
          fontWeight: 400,
          marginBottom: 24,
        },
        children: `${slide.slideNumber} / ${slide.totalSlides}`,
      },
    },
    {
      type: 'div',
      props: {
        style: {
          fontSize: 64,
          fontWeight: 700,
          color: titleColor,
          lineHeight: 1.1,
          marginBottom: 24,
        },
        children: slide.title,
      },
    },
    slide.body ? {
      type: 'div',
      props: {
        style: {
          fontSize: 28,
          fontWeight: 400,
          color: isColorSlide ? 'rgba(255,255,255,0.85)' : bodyColor,
          lineHeight: 1.5,
        },
        children: slide.body,
      },
    } : null,
    slide.type === 'cta' && slide.ctaText ? {
      type: 'div',
      props: {
        style: {
          fontSize: 32,
          fontWeight: 600,
          color: '#ffffff',
          marginTop: 32,
        },
        children: slide.ctaText,
      },
    } : null,
    slide.type === 'cta' && slide.handle ? {
      type: 'div',
      props: {
        style: {
          fontSize: 20,
          fontWeight: 400,
          color: 'rgba(255,255,255,0.8)',
          marginTop: 12,
        },
        children: slide.handle,
      },
    } : null,
  ].filter(Boolean) as object[]

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column' as const,
        justifyContent: 'center',
        width: 1080,
        height: 1080,
        background: bg,
        padding: !isColorSlide ? '64px 64px 64px 88px' : '64px',
        fontFamily: 'Inter',
        position: 'relative' as const,
      },
      children: [leftBorder, ...mainContent, logoEl].filter(Boolean),
    },
  }
}

// ─── Template: Gradient ───────────────────────────────────────────────────────
// Top header bar (80px) with linear gradient. Dark #1a1a1a body. CTA: full gradient bg.

function templateGradient(brand: BrandStyle, slide: SlideData): object {
  const primary = brand.primaryColor
  const secondary = brand.secondaryColor ?? `${primary}99` // ~60% opacity fallback
  const gradientStyle = `linear-gradient(135deg, ${primary}, ${secondary})`

  const isCta = slide.type === 'cta'

  // Logo for CTA slide
  let logoEl: object | null = null
  if (isCta && brand.logoUrl) {
    try {
      logoEl = {
        type: 'img',
        props: {
          src: brand.logoUrl,
          style: {
            position: 'absolute' as const,
            bottom: 40,
            right: 40,
            width: 60,
            height: 60,
          },
        },
      }
    } catch {
      logoEl = null
    }
  }

  if (isCta) {
    // CTA slide: full gradient background
    const ctaChildren: object[] = [
      {
        type: 'div',
        props: {
          style: {
            fontSize: 16,
            color: 'rgba(255,255,255,0.7)',
            fontWeight: 400,
            marginBottom: 48,
          },
          children: `${slide.slideNumber} / ${slide.totalSlides}`,
        },
      },
      {
        type: 'div',
        props: {
          style: {
            fontSize: 48,
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1.2,
            marginBottom: 24,
          },
          children: slide.title,
        },
      },
      slide.body ? {
        type: 'div',
        props: {
          style: {
            fontSize: 26,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.85)',
            lineHeight: 1.5,
            marginBottom: 32,
          },
          children: slide.body,
        },
      } : null,
      slide.ctaText ? {
        type: 'div',
        props: {
          style: {
            fontSize: 32,
            fontWeight: 600,
            color: '#ffffff',
            marginTop: 16,
          },
          children: slide.ctaText,
        },
      } : null,
      slide.handle ? {
        type: 'div',
        props: {
          style: {
            fontSize: 20,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.8)',
            marginTop: 12,
          },
          children: slide.handle,
        },
      } : null,
    ].filter(Boolean) as object[]

    return {
      type: 'div',
      props: {
        style: {
          display: 'flex',
          flexDirection: 'column' as const,
          justifyContent: 'center',
          width: 1080,
          height: 1080,
          background: gradientStyle,
          padding: 64,
          fontFamily: 'Inter',
          position: 'relative' as const,
        },
        children: [...ctaChildren, logoEl].filter(Boolean),
      },
    }
  }

  // Non-CTA slides: header bar + dark body
  const bodyChildren: object[] = [
    {
      type: 'div',
      props: {
        style: {
          fontSize: 48,
          fontWeight: 700,
          color: '#ffffff',
          lineHeight: 1.2,
          marginBottom: 24,
        },
        children: slide.title,
      },
    },
    slide.body ? {
      type: 'div',
      props: {
        style: {
          fontSize: 26,
          fontWeight: 400,
          color: '#bbbbbb',
          lineHeight: 1.5,
        },
        children: slide.body,
      },
    } : null,
  ].filter(Boolean) as object[]

  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: 'column' as const,
        width: 1080,
        height: 1080,
        background: '#1a1a1a',
        fontFamily: 'Inter',
        position: 'relative' as const,
      },
      children: [
        // Header bar with gradient
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'row' as const,
              alignItems: 'center',
              justifyContent: 'space-between',
              width: 1080,
              height: 80,
              background: gradientStyle,
              paddingLeft: 64,
              paddingRight: 64,
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 20,
                    fontWeight: 600,
                    color: '#ffffff',
                  },
                  children: brand.fontFamily,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontSize: 16,
                    color: 'rgba(255,255,255,0.8)',
                    fontWeight: 400,
                  },
                  children: `${slide.slideNumber} / ${slide.totalSlides}`,
                },
              },
            ],
          },
        },
        // Content below header
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              flexDirection: 'column' as const,
              flex: 1,
              padding: 64,
              paddingTop: 48,
            },
            children: bodyChildren,
          },
        },
      ],
    },
  }
}

// ─── Templates Registry ───────────────────────────────────────────────────────

const TEMPLATES: Record<TemplateId, (brand: BrandStyle, slide: SlideData) => object> = {
  minimal: templateMinimal,
  bold: templateBold,
  gradient: templateGradient,
}

// ─── Render Pipeline ──────────────────────────────────────────────────────────

/**
 * Render a set of carousel slides using the specified template, then upload
 * all PNGs and thumbnails to R2 in parallel.
 *
 * Returns the R2 keys for each slide image and thumbnail.
 */
export async function renderCarouselSlides(params: {
  templateId: TemplateId
  brandId: number
  brandStyle: BrandStyle
  slides: SlideData[]
}): Promise<{ r2Keys: string[]; thumbKeys: string[] }> {
  const { templateId, brandId, brandStyle, slides } = params

  // Load fonts once for all slides
  const fonts = loadFonts()

  const timestamp = Date.now()
  const bucket = process.env.R2_MEDIA_BUCKET ?? 'social-media'

  // Render each slide sequentially (satori is CPU-bound; parallel would fight for same CPU)
  const rendered: Array<{ pngBuffer: Buffer; thumbBuffer: Buffer; index: number }> = []

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]
    const vnode = TEMPLATES[templateId](brandStyle, slide)

    // Satori: vnode -> SVG string
    const svg = await satori(vnode as Parameters<typeof satori>[0], {
      width: 1080,
      height: 1080,
      fonts,
    })

    const svgBuffer = Buffer.from(svg)

    // sharp: SVG -> PNG (full size)
    const pngBuffer = await sharp(svgBuffer).png().toBuffer()

    // sharp: SVG -> JPEG thumbnail 400x400
    const thumbBuffer = await sharp(svgBuffer)
      .resize(400, 400, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer()

    rendered.push({ pngBuffer, thumbBuffer, index: i })
  }

  // Build R2 key arrays
  const r2Keys: string[] = rendered.map(
    r => `brands/${brandId}/carousels/${timestamp}/slide-${r.index}.png`
  )
  const thumbKeys: string[] = rendered.map(
    r => `brands/${brandId}/carousels/${timestamp}/slide-${r.index}-thumb.jpg`
  )

  // Upload all slides and thumbnails to R2 in parallel
  await Promise.all([
    ...rendered.map((r, i) => uploadToR2(bucket, r2Keys[i], r.pngBuffer)),
    ...rendered.map((r, i) => uploadToR2(bucket, thumbKeys[i], r.thumbBuffer)),
  ])

  return { r2Keys, thumbKeys }
}
