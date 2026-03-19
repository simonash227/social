'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { ChevronLeft, Pin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { pinGoldenExample, unpinGoldenExample } from '@/app/actions/learnings'

interface GoldenPost {
  postId: number
  content: string
  engagementScore: number
  platform: string
  collectedAt: string
  isGoldenPinned: number
  publishedAt: string | null
}

interface GoldenExamplesSectionProps {
  posts: GoldenPost[]
  brandId: number
  brandName: string
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function GoldenPostCard({
  post,
  injectionRank,
  onPin,
  onUnpin,
  isPending,
}: {
  post: GoldenPost
  injectionRank: number | null
  onPin: (postId: number) => void
  onUnpin: (postId: number) => void
  isPending: boolean
}) {
  const isPinned = post.isGoldenPinned === 1
  const isInjected = injectionRank !== null && injectionRank <= 5

  return (
    <Card className={isPinned ? 'border-blue-300 dark:border-blue-700' : ''}>
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Top row */}
        <div className="flex items-center gap-2 flex-wrap">
          {isPinned && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
              <Pin className="h-3 w-3" />
              Pinned
            </span>
          )}
          {isInjected && (
            <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
              Injected into prompts
            </Badge>
          )}
          <Badge variant="outline" className="text-xs capitalize">{post.platform}</Badge>
          <span className="ml-auto text-xs font-medium text-muted-foreground">
            Score: {post.engagementScore}
          </span>
        </div>

        {/* Content preview */}
        <p className="text-sm leading-relaxed text-foreground/90">
          {post.content.slice(0, 300)}{post.content.length > 300 ? '…' : ''}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {formatDate(post.collectedAt)}
          </span>
          <div>
            {isPinned ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs"
                disabled={isPending}
                onClick={() => onUnpin(post.postId)}
              >
                Unpin
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs"
                disabled={isPending}
                onClick={() => onPin(post.postId)}
              >
                <Pin className="h-3 w-3 mr-1" />
                Pin
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function GoldenExamplesSection({
  posts,
  brandId,
  brandName,
}: GoldenExamplesSectionProps) {
  const [isPending, startTransition] = useTransition()

  function handlePin(postId: number) {
    startTransition(async () => {
      const result = await pinGoldenExample(postId, brandId)
      if (result.error) {
        console.error('Pin failed:', result.error)
      }
    })
  }

  function handleUnpin(postId: number) {
    startTransition(async () => {
      const result = await unpinGoldenExample(postId, brandId)
      if (result.error) {
        console.error('Unpin failed:', result.error)
      }
    })
  }

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          href={`/brands/${brandId}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to {brandName}
        </Link>
        <h1 className="text-2xl font-bold">{brandName} Golden Examples</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Your best-performing posts, used as style references in content generation
        </p>
      </div>

      {/* Info note */}
      <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
        The top 5 examples (pinned first) are injected into generation prompts as few-shot style references.
      </div>

      {/* Post list */}
      {posts.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6">
            <p className="text-sm text-muted-foreground">
              No golden examples yet. Posts that reach the 90th percentile of engagement will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {posts.map((post, index) => (
            <GoldenPostCard
              key={post.postId}
              post={post}
              injectionRank={index + 1}
              onPin={handlePin}
              onUnpin={handleUnpin}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}
