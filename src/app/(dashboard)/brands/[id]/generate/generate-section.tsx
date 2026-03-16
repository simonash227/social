'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  generateContent,
  saveGeneratedPosts,
  type GenerationResult,
} from '@/app/actions/generate'
import { ChevronDown, ChevronUp, Sparkles, Save } from 'lucide-react'

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

  // Platform selection
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([])

  // Generation results
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [editedContent, setEditedContent] = useState<Record<string, string>>({})
  const [expandedHooks, setExpandedHooks] = useState<string | null>(null)

  // Loading states
  const [isPending, startTransition] = useTransition()
  const [isSaving, startSavingTransition] = useTransition()

  // Error state
  const [error, setError] = useState<string | null>(null)

  // ─── Handlers ────────────────────────────────────────────────────────────────

  function togglePlatform(platform: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    )
  }

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      const res = await generateContent(brandId, selectedPlatforms, sourceText, sourceUrl)
      if (res.error) {
        setError(res.error)
      } else {
        setResult(res)
        setEditedContent(
          Object.fromEntries(
            Object.entries(res.platforms).map(([k, v]) => [k, v.content])
          )
        )
        setError(null)
      }
    })
  }

  function handleGenerateAgain() {
    setResult(null)
    setEditedContent({})
    setExpandedHooks(null)
    handleGenerate()
  }

  function handleSave() {
    startSavingTransition(async () => {
      const res = await saveGeneratedPosts(brandId, editedContent, sourceText, sourceUrl)
      if (res?.error) {
        setError(res.error)
      }
      // saveGeneratedPosts calls redirect() on success, so no action needed here
    })
  }

  function updateEditedContent(platform: string, content: string) {
    setEditedContent((prev) => ({ ...prev, [platform]: content }))
  }

  // ─── Derived values ──────────────────────────────────────────────────────────

  const canGenerate =
    !isPending &&
    (sourceText.trim().length > 0 || sourceUrl.trim().length > 0) &&
    selectedPlatforms.length > 0

  const platformKeys = result ? Object.keys(result.platforms) : []

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Source Input Section */}
      <section className="space-y-3">
        <Label htmlFor="source-url">Source Material</Label>
        <Input
          id="source-url"
          type="url"
          placeholder="Paste a URL (article, blog post, etc.)"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <Textarea
          id="source-text"
          placeholder="Type or paste your source content here..."
          rows={6}
          value={sourceText}
          onChange={(e) => setSourceText(e.target.value)}
        />
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
        {isPending ? 'Generating...' : 'Generate Content'}
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

      {/* Results Section */}
      {result && !isPending && platformKeys.length > 0 && (
        <div className="space-y-6">
          <Tabs defaultValue={platformKeys[0]}>
            <TabsList>
              {platformKeys.map((platform) => (
                <TabsTrigger key={platform} value={platform}>
                  {getPlatformLabel(platform)}
                </TabsTrigger>
              ))}
            </TabsList>

            {platformKeys.map((platform) => {
              const platformData = result.platforms[platform]
              const content = editedContent[platform] ?? ''
              const limit = PLATFORM_LIMITS[platform] ?? 2200
              const charCount = content.length

              return (
                <TabsContent key={platform} value={platform}>
                  <div className="space-y-3 pt-3">
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
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={isSaving}>
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

          {/* Cost Display */}
          <p className="text-xs text-muted-foreground">
            AI cost: ${result.totalCostUsd.toFixed(4)}
          </p>
        </div>
      )}
    </div>
  )
}
