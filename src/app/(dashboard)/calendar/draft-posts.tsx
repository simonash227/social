'use client'

import { useTransition } from 'react'
import { schedulePost } from '@/app/actions/schedule'
import { useRouter } from 'next/navigation'

interface DraftPost {
  id: number
  content: string
  brandName: string
  platforms: string[]
  createdAt: string
}

interface DraftPostsProps {
  drafts: DraftPost[]
}

export function DraftPosts({ drafts }: DraftPostsProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSchedule(postId: number) {
    // Schedule 1 hour from now as default
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    startTransition(async () => {
      const result = await schedulePost(postId, scheduledAt)
      if (result.error) {
        console.error('Failed to schedule:', result.error)
      } else {
        router.refresh()
      }
    })
  }

  if (drafts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold text-foreground mb-2">Draft Posts</h2>
        <p className="text-sm text-muted-foreground">
          No draft posts. Generate content from a brand page first.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-lg font-semibold text-foreground mb-3">Draft Posts</h2>
      <div className="space-y-2">
        {drafts.map((draft) => (
          <div
            key={draft.id}
            className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {draft.brandName}
                </span>
                {draft.platforms.map((p) => (
                  <span
                    key={p}
                    className="text-xs rounded bg-muted px-1.5 py-0.5 text-muted-foreground"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <p className="text-sm text-foreground truncate">
                {draft.content.slice(0, 120)}{draft.content.length > 120 ? '...' : ''}
              </p>
            </div>
            <button
              onClick={() => handleSchedule(draft.id)}
              disabled={isPending}
              className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isPending ? 'Scheduling...' : 'Schedule'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
