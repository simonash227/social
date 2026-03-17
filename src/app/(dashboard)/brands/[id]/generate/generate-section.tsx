'use client'

import { useState, useTransition, type ChangeEvent } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  generateContent,
  refineAndGate,
  saveGeneratedPosts,
  extractSource,
  type RefinedGenerationResult,
} from '@/app/actions/generate'
import { generateImage } from '@/app/actions/images'
import { ChevronDown, ChevronUp, Sparkles, Save, Upload, CheckCircle, AlertCircle, Loader2, ImageIcon } from 'lucide-react'

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280,
  x: 280,
  linkedin: 3000,
  instagram: 2200,
  tiktok: 2200,
}

const PLATFORM_LABELS: Record<string, string> = {
  twitter: 'Twitter / X',
  x: 'Twitter / X',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  pinterest: 'Pinterest',
  threads: 'Threads',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform.toLowerCase()] ?? platform
}

function getCharCountColor(current: number, limit: number): string {
  const ratio = current / limit
  if (ratio >= 1.0) return 'text-destructive'
  if (ratio >= 0.9) return 'text-yellow-500'
  return 'text-muted-foreground'
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface Account {
  id: number
  platform: string
  username: string
}

interface GenerateSectionProps {
  brandId: number
  brandName: string
  accounts: Account[]
}

// ─── Component ───────────────────────────────────────────────────────────────

export function GenerateSection({ brandId, brandName, accounts }: GenerateSectionProps) {
  // Source inputs
  const [sourceUrl, setSourceUrl] = useState('')
  const [sourceText, setSourceText] = useState('')

  // PDF upload state
  const [pdfFileName, setPdfFileName] = useState<string | null>(null)

  // Extraction status
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'extracting' | 'done' | 'error'>('idle')
  const [extractionMessage, setExtractionMessage] = useState('')
  const [, startExtractionTransition] = useTransition()

  // Platform selection
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

  // Generation results
  const [result, setResult] = useState<RefinedGenerationResult | null>(null)
  const [editedContent, setEditedContent] = useState<Record<string, string>>({})
  const [expandedHooks, setExpandedHooks] = useState<string | null>(null)

  // Loading states
  const [isPending, startTransition] = useTransition()
  const [isSaving, startSavingTransition] = useTransition()
  const [loadingMessage, setLoadingMessage] = useState('Generating...')

  // Generation cost tracking
  const [genCost, setGenCost] = useState(0)

  // Error state
  const [error, setError] = useState<string | null>(null)

  // Image generation state
  const [imagePrompt, setImagePrompt] = useState('')
  const [imageResult, setImageResult] = useState<{ imageId: number; error?: string } | null>(null)
  const [isGeneratingImage, startImageTransition] = useTransition()

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function togglePlatform(platform: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    )
  }

  function handlePdfUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPdfFileName(file.name)

    const reader = new FileReader()
    reader.onload = (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer
      if (!arrayBuffer) return

      // Convert ArrayBuffer to base64
      const uint8Array = new Uint8Array(arrayBuffer)
      let binary = ''
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i])
      }
      const base64 = btoa(binary)

      startExtractionTransition(async () => {
        setExtractionStatus('extracting')
        setExtractionMessage('Extracting PDF text...')

        const result = await extractSource('', base64)

        if (result.text) {
          setSourceText(result.text)
          setExtractionStatus('done')
          setExtractionMessage(`Extracted ${result.text.length.toLocaleString()} characters`)
        } else {
          setExtractionStatus('error')
          setExtractionMessage(result.error ?? 'Could not extract PDF content')
        }
      })
    }
    reader.readAsArrayBuffer(file)
  }

  function handleUrlExtract() {
    startExtractionTransition(async () => {
      setExtractionStatus('extracting')
      setExtractionMessage('Extracting content...')

      const result = await extractSource(sourceUrl)

      if (result.text) {
        setSourceText(result.text)
        setExtractionStatus('done')
        setExtractionMessage(
          `Extracted: ${result.title ?? 'content'} (${result.text.length.toLocaleString()} chars)`
        )
      } else {
        setExtractionStatus('error')
        setExtractionMessage(result.error ?? 'Could not extract content')
      }
    })
  }

  function handleGenerate() {
    setError(null)
    setLoadingMessage('Generating...')
    startTransition(async () => {
      // Phase 1: Generate raw content
      const genResult = await generateContent(brandId, selectedPlatforms, sourceText, sourceUrl)
      if (genResult.error) {
        setError(genResult.error)
        return
      }

      // Track generation cost separately
      setGenCost(genResult.totalCostUsd)

      // Phase 2: Refine and quality gate
      setLoadingMessage('Refining...')
      const refined = await refineAndGate(brandId, genResult)
      if (refined.error) {
        setError(refined.error)
        return
      }

      setResult(refined)
      // Only populate editedContent for non-discarded platforms
      setEditedContent(
        Object.fromEntries(
          Object.entries(refined.platforms)
            .filter(([, v]) => !v.discarded)
            .map(([k, v]) => [k, v.content])
        )
      )
      setError(null)
    })
  }

  function handleGenerateAgain() {
    setResult(null)
    setEditedContent({})
    setExpandedHooks(null)
    setGenCost(0)
    handleGenerate()
  }

  function handleSave() {
    startSavingTransition(async () => {
      // Build quality data from refined results
      const qualityData: Record<string, { score: number; details: NonNullable<RefinedGenerationResult['platforms'][string]['qualityDetails']> }> = {}
      if (result) {
        for (const [platform, data] of Object.entries(result.platforms)) {
          if (!data.discarded) {
            qualityData[platform] = {
              score: data.qualityScore,
              details: data.qualityDetails,
            }
          }
        }
      }

      const res = await saveGeneratedPosts(
        brandId,
        editedContent,
        sourceText,
        sourceUrl,
        Object.keys(qualityData).length > 0 ? qualityData : undefined
      )
      if (res?.error) {
        setError(res.error)
      }
      // saveGeneratedPosts calls redirect() on success, so no action needed here
    })
  }

  function updateEditedContent(platform: string, content: string) {
    setEditedContent((prev) => ({ ...prev, [platform]: content }))
  }

  function handleGenerateImage() {
    startImageTransition(async () => {
      const result = await generateImage(brandId, imagePrompt)
      setImageResult(result)
    })
  }

  // ─── Derived values ──────────────────────────────────────────────────────────

  const isExtracting = extractionStatus === 'extracting'

  const canGenerate =
    !isPending &&
    (sourceText.trim().length > 0 || sourceUrl.trim().length > 0 || pdfFileName !== null) &&
    selectedPlatforms.length > 0

  const platformKeys = result ? Object.keys(result.platforms) : []

  const hasPassingContent = result
    ? Object.values(result.platforms).some(p => !p.discarded)
    : false

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Source Input Section */}
      <section className="space-y-3">
        <Label htmlFor="source-url">Source Material</Label>

        {/* URL Input with Extract button */}
        <div className="flex gap-2">
          <Input
            id="source-url"
            type="url"
            placeholder="Paste a URL (YouTube video, article, blog post, etc.)"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            className="flex-1"
          />
          {sourceUrl.trim() && !sourceText && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUrlExtract}
              disabled={isExtracting}
              className="shrink-0"
            >
              {isExtracting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Extract
            </Button>
          )}
        </div>

        {/* "or" divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* PDF Upload */}
        <div>
          <label
            htmlFor="pdf-upload"
            className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <Upload className="h-4 w-4 shrink-0" />
            {pdfFileName ? (
              <span className="truncate text-foreground">{pdfFileName}</span>
            ) : (
              <span>Upload a PDF</span>
            )}
          </label>
          <input
            id="pdf-upload"
            type="file"
            accept=".pdf"
            className="sr-only"
            onChange={handlePdfUpload}
          />
        </div>

        {/* "or" divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Source Text */}
        <Textarea
          id="source-text"
          placeholder="Type or paste your source content here..."
          rows={6}
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
        />

        {/* Extraction Status */}
        {extractionStatus !== 'idle' && (
          <div className={`flex items-start gap-2 text-sm ${
            extractionStatus === 'done' ? 'text-green-500' :
            extractionStatus === 'error' ? 'text-destructive' :
            'text-muted-foreground'
          }`}>
            {extractionStatus === 'extracting' && (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            )}
            {extractionStatus === 'done' && (
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            {extractionStatus === 'error' && (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>
              {extractionMessage}
              {extractionStatus === 'error' && (
                <span className="ml-1 text-muted-foreground">
                  You can still type content manually below.
                </span>
              )}
            </span>
          </div>
        )}
      </section>

      {/* Platform Selection Section */}
      <section className="space-y-3">
        <Label>Target Platforms</Label>
        {accounts.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">
              No connected accounts. Connect accounts on{' '}
              <a
                href="https://app.upload-post.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Upload-Post
              </a>
              , then sync from the brand page.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <label
                key={account.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-input accent-primary"
                  checked={selectedPlatforms.includes(account.platform)}
                  onChange={() => togglePlatform(account.platform)}
                />
                <div>
                  <span className="text-sm font-medium">
                    {getPlatformLabel(account.platform)}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    @{account.username}
                  </span>
                </div>
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        disabled={!canGenerate}
        size="lg"
        className="w-full"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {isPending ? loadingMessage : 'Generate Content'}
      </Button>

      {/* Error Display */}
      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isPending && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-48" />
        </div>
      )}

      {/* Image Generation Section */}
      <Separator className="my-8" />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Image Generation
        </h2>
        <p className="text-sm text-muted-foreground">
          Generate an AI image to accompany your content. The image will use your brand&apos;s visual style.
        </p>

        {/* Image Prompt Input */}
        <div className="space-y-2">
          <Textarea
            placeholder="Describe the image you want to generate..."
            rows={3}
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
          />
          <Button
            type="button"
            onClick={handleGenerateImage}
            disabled={imagePrompt.trim() === '' || isGeneratingImage}
          >
            <ImageIcon className="mr-2 h-4 w-4" />
            {isGeneratingImage ? 'Generating image...' : 'Generate Image'}
          </Button>
        </div>

        {/* Image Result */}
        {imageResult?.error && (
          <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {imageResult.error}
          </div>
        )}
        {imageResult?.imageId ? (
          <div className="rounded-md border border-green-500/30 bg-green-500/5 px-4 py-3 space-y-2">
            <p className="text-sm text-green-500 font-medium">Image generated successfully!</p>
            <Link
              href={`/brands/${brandId}/media`}
              className="text-sm text-primary underline underline-offset-2 hover:no-underline"
            >
              View in Media Library
            </Link>
            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setImageResult(null)
                  setImagePrompt('')
                }}
              >
                Generate Another
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Results Section */}
      {result && !isPending && platformKeys.length > 0 && (
        <div className="space-y-6">
          <Tabs defaultValue={platformKeys[0]}>
            <TabsList>
              {platformKeys.map((platform) => {
                const isDiscarded = result.platforms[platform]?.discarded
                return (
                  <TabsTrigger
                    key={platform}
                    value={platform}
                    className={isDiscarded ? 'opacity-50 line-through' : ''}
                  >
                    {getPlatformLabel(platform)}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {platformKeys.map((platform) => {
              const platformData = result.platforms[platform]
              const content = editedContent[platform] ?? ''
              const limit = PLATFORM_LIMITS[platform] ?? 2200
              const charCount = content.length

              return (
                <TabsContent key={platform} value={platform}>
                  <div className="space-y-3 pt-3">
                    {platformData.discarded ? (
                      /* Discarded platform: show error card */
                      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 space-y-2">
                        <p className="text-sm font-medium text-destructive">Content Discarded</p>
                        <p className="text-sm text-muted-foreground">
                          Quality score too low ({platformData.qualityScore}/10).
                          {platformData.discardReason && (
                            <> Reason: {platformData.discardReason}</>
                          )}
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Quality Score Badge */}
                        <div className="flex items-center gap-2">
                          <Badge variant={platformData.qualityScore >= 8 ? 'default' : 'secondary'}>
                            Quality: {platformData.qualityScore}/10
                          </Badge>
                          {platformData.qualityWarning && (
                            <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
                              Warning
                            </Badge>
                          )}
                        </div>

                        {/* Hook Variants Toggle */}
                        {platformData.hookVariants.length > 0 && (
                          <div>
                            <button
                              type="button"
                              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() =>
                                setExpandedHooks(
                                  expandedHooks === platform ? null : platform
                                )
                              }
                            >
                              {expandedHooks === platform ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              View hook variants ({platformData.hookVariants.length})
                            </button>

                            {expandedHooks === platform && (
                              <div className="mt-2 space-y-1.5 rounded-md border p-3">
                                {platformData.hookVariants
                                  .sort((a, b) => b.score - a.score)
                                  .map((variant, idx) => {
                                    const isWinner =
                                      variant.text === platformData.winningHook
                                    return (
                                      <div
                                        key={idx}
                                        className={`flex items-start justify-between gap-3 rounded-md px-2 py-1.5 text-sm ${
                                          isWinner
                                            ? 'bg-primary/10 font-medium'
                                            : ''
                                        }`}
                                      >
                                        <span className="flex-1">
                                          {isWinner && (
                                            <Badge
                                              variant="default"
                                              className="mr-2 text-[10px]"
                                            >
                                              Winner
                                            </Badge>
                                          )}
                                          {variant.text}
                                        </span>
                                        <Badge variant="secondary" className="shrink-0">
                                          {variant.score}/10
                                        </Badge>
                                      </div>
                                    )
                                  })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Content Textarea */}
                        <Textarea
                          rows={10}
                          value={content}
                          onChange={(e) =>
                            updateEditedContent(platform, e.target.value)
                          }
                        />

                        {/* Character Count */}
                        <div className="flex justify-end">
                          <span
                            className={`text-xs ${getCharCountColor(charCount, limit)}`}
                          >
                            {charCount} / {limit} characters
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>

          {/* All platforms discarded warning */}
          {result && !hasPassingContent && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              All content was discarded due to low quality scores. Try with different or more detailed source material.
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={isSaving || !hasPassingContent}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save as Draft'}
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateAgain}
              disabled={isPending}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Again
            </Button>
          </div>

          {/* Combined Cost Display */}
          <p className="text-xs text-muted-foreground">
            AI cost: ${((genCost ?? 0) + (result?.totalCostUsd ?? 0)).toFixed(4)}
          </p>
        </div>
      )}
    </div>
  )
}
