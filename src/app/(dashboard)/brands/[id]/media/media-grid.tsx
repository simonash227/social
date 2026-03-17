'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { regenerateImage, type MediaImage } from '@/app/actions/images'
import { X, RefreshCw } from 'lucide-react'

interface MediaGridProps {
  images: MediaImage[]
  brandId: number
}

export function MediaGrid({ images, brandId: _brandId }: MediaGridProps) {
  const router = useRouter()
  const [selectedImage, setSelectedImage] = useState<MediaImage | null>(null)
  const [regeneratePrompt, setRegeneratePrompt] = useState('')
  const [isRegenerating, startRegenerateTransition] = useTransition()
  const [regenerateError, setRegenerateError] = useState<string | null>(null)

  function handleSelectImage(image: MediaImage) {
    setSelectedImage(image)
    setRegeneratePrompt(image.prompt)
    setRegenerateError(null)
  }

  function handleClose() {
    setSelectedImage(null)
    setRegeneratePrompt('')
    setRegenerateError(null)
  }

  function handleRegenerate() {
    if (!selectedImage) return
    setRegenerateError(null)
    startRegenerateTransition(async () => {
      const result = await regenerateImage(selectedImage.id, regeneratePrompt)
      if (result.error) {
        setRegenerateError(result.error)
      } else {
        router.refresh()
        setSelectedImage(null)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image) => (
          <button
            key={image.id}
            type="button"
            className="group text-left"
            onClick={() => handleSelectImage(image)}
          >
            <div className="overflow-hidden rounded-lg border border-border transition-colors group-hover:border-primary">
              <img
                src={image.thumbUrl}
                alt={image.prompt}
                className="aspect-square w-full object-cover"
              />
            </div>
            <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
              {image.prompt}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground/60">
              {new Date(image.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </button>
        ))}
      </div>

      {/* Detail View */}
      {selectedImage && (
        <div className="rounded-lg border bg-card p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="font-semibold">Image Detail</h3>
              <p className="text-xs text-muted-foreground">
                Generated{' '}
                {new Date(selectedImage.createdAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                &middot; Cost: ${selectedImage.costUsd}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Full-size image */}
          <div className="overflow-hidden rounded-lg border border-border">
            <img
              src={selectedImage.fullUrl}
              alt={selectedImage.prompt}
              className="w-full object-contain"
            />
          </div>

          {/* Prompt */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Original Prompt
            </p>
            <p className="text-sm">{selectedImage.prompt}</p>
          </div>

          {/* Regenerate */}
          <div className="space-y-3 rounded-md border p-4">
            <p className="text-sm font-medium">Regenerate with new prompt</p>
            <Textarea
              rows={3}
              value={regeneratePrompt}
              onChange={(e) => setRegeneratePrompt(e.target.value)}
              placeholder="Enter a new prompt to regenerate this image..."
            />
            {regenerateError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {regenerateError}
              </div>
            )}
            <Button
              type="button"
              onClick={handleRegenerate}
              disabled={regeneratePrompt.trim() === '' || isRegenerating}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {isRegenerating ? 'Regenerating...' : 'Regenerate with new prompt'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
