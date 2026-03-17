'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Sparkles, Loader2 } from 'lucide-react'
import { generateSlideContent, renderAndSaveCarousel } from '@/app/actions/carousels'
import type { TEMPLATE_IDS } from '@/lib/carousel-gen'

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateId = typeof TEMPLATE_IDS[number]

interface SlideItem {
  title: string
  body: string
}

interface ExistingSlide {
  slideIndex: number
  title: string
  thumbUrl: string | null
  r2Key: string
}

interface ExistingCarousel {
  id: number
  templateId: string
  slideCount: number
  status: string
  createdAt: string
  slides: ExistingSlide[]
}

interface CarouselSectionProps {
  brandId: number
  brandName: string
  primaryColor: string
  secondaryColor: string | null
  existingCarousels: ExistingCarousel[]
}

// ─── Template CSS Mockups ─────────────────────────────────────────────────────

interface TemplateMockupProps {
  templateId: TemplateId
  primaryColor: string
  secondaryColor: string | null
  selected: boolean
  onClick: () => void
}

function TemplateMockup({ templateId, primaryColor, secondaryColor, selected, onClick }: TemplateMockupProps) {
  const secondary = secondaryColor ?? primaryColor

  let preview: React.ReactNode

  if (templateId === 'minimal') {
    preview = (
      <div
        style={{ background: '#0f0f0f', width: '100%', height: 96, borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      >
        <div style={{ fontSize: 8, color: primaryColor }}>1 / 5</div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, paddingTop: 6 }}>
          <div style={{ height: 8, width: '75%', background: '#ffffff', borderRadius: 2 }} />
          <div style={{ height: 5, width: '55%', background: '#cccccc', borderRadius: 2 }} />
        </div>
        <div style={{ height: 2, width: 24, background: primaryColor, borderRadius: 1 }} />
      </div>
    )
  } else if (templateId === 'bold') {
    preview = (
      <div
        style={{ background: primaryColor, width: '100%', height: 96, borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}
      >
        <div style={{ height: 10, width: '70%', background: '#ffffff', borderRadius: 2 }} />
        <div style={{ height: 5, width: '50%', background: 'rgba(255,255,255,0.7)', borderRadius: 2 }} />
      </div>
    )
  } else {
    // gradient
    preview = (
      <div style={{ background: '#1a1a1a', width: '100%', height: 96, borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            height: 18,
            background: `linear-gradient(135deg, ${primaryColor}, ${secondary})`,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 8,
            paddingRight: 8,
            justifyContent: 'space-between',
          }}
        >
          <div style={{ height: 5, width: 30, background: 'rgba(255,255,255,0.8)', borderRadius: 2 }} />
          <div style={{ height: 4, width: 15, background: 'rgba(255,255,255,0.6)', borderRadius: 2 }} />
        </div>
        <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 4, justifyContent: 'center' }}>
          <div style={{ height: 8, width: '65%', background: '#ffffff', borderRadius: 2 }} />
          <div style={{ height: 5, width: '45%', background: '#bbbbbb', borderRadius: 2 }} />
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border-2 p-2 text-left transition-all ${
        selected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
      }`}
    >
      {preview}
      <p className="mt-2 text-center text-xs font-medium capitalize text-muted-foreground">
        {templateId}
      </p>
    </button>
  )
}

// ─── Slide Badge ──────────────────────────────────────────────────────────────

function getSlideBadge(index: number, totalSlides: number) {
  if (index === 0) return <Badge className="bg-green-600 text-white text-xs">Hook</Badge>
  if (index === totalSlides - 1) return <Badge className="bg-blue-600 text-white text-xs">CTA</Badge>
  return <Badge variant="secondary" className="text-xs">Slide {index + 1}</Badge>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(createdAt: string): string {
  try {
    return new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return createdAt
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CarouselSection({
  brandId,
  brandName: _brandName,
  primaryColor,
  secondaryColor,
  existingCarousels: initialCarousels,
}: CarouselSectionProps) {
  // Source + slide count
  const [sourceText, setSourceText] = useState('')
  const [slideCount, setSlideCount] = useState(5)

  // Generated slides state
  const [generatedSlides, setGeneratedSlides] = useState<SlideItem[] | null>(null)
  const [genCostUsd, setGenCostUsd] = useState(0)

  // Template selection
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>('minimal')

  // Transitions
  const [isPendingGenerate, startGenerateTransition] = useTransition()
  const [isPendingRender, startRenderTransition] = useTransition()

  // Status
  const [error, setError] = useState<string | null>(null)
  const [renderSuccess, setRenderSuccess] = useState(false)
  const [renderCarouselId, setRenderCarouselId] = useState<number | null>(null)

  // Existing carousels (can be refreshed after render)
  const [existingCarousels, setExistingCarousels] = useState<ExistingCarousel[]>(initialCarousels)

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function handleGenerate() {
    if (!sourceText.trim()) return
    setError(null)
    setRenderSuccess(false)
    setGeneratedSlides(null)

    startGenerateTransition(async () => {
      const result = await generateSlideContent(brandId, sourceText, slideCount)
      if (result.error) {
        setError(result.error)
        return
      }
      setGeneratedSlides(result.slides)
      setGenCostUsd(result.costUsd)
    })
  }

  function handleSlideChange(index: number, field: 'title' | 'body', value: string) {
    setGeneratedSlides(prev => {
      if (!prev) return prev
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function handleRender() {
    if (!generatedSlides) return
    setError(null)
    setRenderSuccess(false)

    startRenderTransition(async () => {
      const result = await renderAndSaveCarousel({
        brandId,
        templateId: selectedTemplate,
        sourceText,
        slides: generatedSlides,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      setRenderSuccess(true)
      setRenderCarouselId(result.carouselId)

      // Refresh existing carousels list by re-importing the action
      // (we reload by calling getCarousels indirectly via a page refresh signal)
      // For now, we optimistically add a placeholder entry
      const newEntry: ExistingCarousel = {
        id: result.carouselId,
        templateId: selectedTemplate,
        slideCount: generatedSlides.length,
        status: 'ready',
        createdAt: new Date().toISOString(),
        slides: generatedSlides.map((s, i) => ({
          slideIndex: i,
          title: s.title,
          thumbUrl: null,
          r2Key: '',
        })),
      }
      setExistingCarousels(prev => [newEntry, ...prev])
    })
  }

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const canGenerate = !isPendingGenerate && sourceText.trim().length > 0

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">

      {/* Source Input Section */}
      <section className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="source-text">Source Content</Label>
          <Textarea
            id="source-text"
            placeholder="Paste article, notes, or key points for your carousel..."
            rows={6}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="slide-count" className="whitespace-nowrap">Slide Count</Label>
            <Input
              id="slide-count"
              type="number"
              min={3}
              max={8}
              value={slideCount}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10)
                if (!isNaN(v) && v >= 3 && v <= 8) setSlideCount(v)
              }}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">(3–8)</span>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!canGenerate}
          size="lg"
          className="w-full"
        >
          {isPendingGenerate ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating slide content...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Slides
            </>
          )}
        </Button>

        {genCostUsd > 0 && (
          <p className="text-xs text-muted-foreground">
            Generation cost: ${genCostUsd.toFixed(4)}
          </p>
        )}
      </section>

      {/* Error Display */}
      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Template Picker + Slide Editor + Render (shown after generation) */}
      {generatedSlides && !isPendingGenerate && (
        <>
          <Separator />

          {/* Template Picker */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Choose a Template</h2>
            <div className="grid grid-cols-3 gap-4">
              {(['minimal', 'bold', 'gradient'] as TemplateId[]).map((tid) => (
                <TemplateMockup
                  key={tid}
                  templateId={tid}
                  primaryColor={primaryColor}
                  secondaryColor={secondaryColor}
                  selected={selectedTemplate === tid}
                  onClick={() => setSelectedTemplate(tid)}
                />
              ))}
            </div>
          </section>

          <Separator />

          {/* Slide Editor */}
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Edit Slides</h2>
            <div className="space-y-4">
              {generatedSlides.map((slide, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    {getSlideBadge(index, generatedSlides.length)}
                    <span className="text-xs text-muted-foreground">
                      {index === 0
                        ? 'Hook — grab attention in 5-8 words'
                        : index === generatedSlides.length - 1
                          ? 'CTA — summarize value + call to action'
                          : 'Key insight for this slide'}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="Slide title..."
                      value={slide.title}
                      onChange={(e) => handleSlideChange(index, 'title', e.target.value)}
                    />
                    <Textarea
                      placeholder="Slide body text (optional for hook)..."
                      rows={index === 0 || index === generatedSlides.length - 1 ? 2 : 3}
                      value={slide.body}
                      onChange={(e) => handleSlideChange(index, 'body', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          {/* Render Button */}
          <section className="space-y-4">
            <Button
              onClick={handleRender}
              disabled={isPendingRender}
              size="lg"
              className="w-full"
            >
              {isPendingRender ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rendering {slideCount} slides...
                </>
              ) : (
                'Render Carousel'
              )}
            </Button>

            {renderSuccess && (
              <div className="rounded-md border border-green-500/30 bg-green-500/5 px-4 py-3 space-y-1">
                <p className="text-sm font-medium text-green-500">
                  Carousel rendered successfully!
                </p>
                {renderCarouselId && (
                  <p className="text-xs text-muted-foreground">
                    Carousel #{renderCarouselId} saved. View it in the Previous Carousels section below.
                  </p>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {/* Previous Carousels */}
      {existingCarousels.length > 0 && (
        <>
          <Separator />
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Previous Carousels</h2>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {existingCarousels.map((carousel) => {
                const firstSlide = carousel.slides[0]
                return (
                  <div
                    key={carousel.id}
                    className="rounded-lg border border-border overflow-hidden space-y-2"
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      {firstSlide?.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={firstSlide.thumbUrl}
                          alt={firstSlide.title || 'Carousel slide'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-xs text-muted-foreground text-center px-2">
                          {firstSlide?.title || 'No preview'}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="px-3 pb-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {carousel.templateId}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {carousel.slideCount} slides
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(carousel.createdAt)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
