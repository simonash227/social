'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  approveLearning,
  rejectLearning,
  toggleLearning,
  runManualAnalysis,
} from '@/app/actions/learnings'
import type { LearningStats } from '@/lib/learning-validator'

interface Learning {
  id: number
  type: string
  description: string
  confidence: string
  status: string
  isActive: number
  supportingPostIds: number[] | null
  platform: string | null
  createdAt: string
}

interface LearningsSectionProps {
  learnings: Learning[]
  brandId: number
  brandName: string
  hasEnoughData: boolean
  dataCount: number
  effectiveness: Record<number, LearningStats>
}

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  const diffMonths = Math.floor(diffDays / 30)
  if (diffMonths === 1) return '1 month ago'
  return `${diffMonths} months ago`
}

function TypeBadge({ type }: { type: string }) {
  if (type === 'avoid_pattern') {
    return (
      <Badge variant="destructive" className="text-xs uppercase font-semibold">
        AVOID
      </Badge>
    )
  }
  const label = type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return <Badge variant="default" className="text-xs">{label}</Badge>
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  if (confidence === 'high') {
    return <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">High</Badge>
  }
  if (confidence === 'medium') {
    return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 hover:bg-amber-200">Medium</Badge>
  }
  return <Badge variant="secondary" className="text-xs">Low</Badge>
}

function LearningCard({
  learning,
  stats,
  onAction,
  isPending,
}: {
  learning: Learning
  stats?: LearningStats
  onAction: (action: string, id: number, value?: boolean) => void
  isPending: boolean
}) {
  const supportingCount = learning.supportingPostIds?.length ?? 0
  const isAvoid = learning.type === 'avoid_pattern'

  const cardClass = learning.status === 'pending'
    ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700'
    : isAvoid
      ? 'border-red-200 bg-red-50/30 dark:bg-red-950/10 dark:border-red-800/50'
      : ''

  // Use validated confidence from A/B data when available, falling back to AI-assigned
  const displayConfidence = stats?.confidence ?? learning.confidence
  const showAiConfidence = stats && stats.confidence !== learning.confidence

  return (
    <Card className={cardClass}>
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Top row: type, confidence, platform */}
        <div className="flex items-center flex-wrap gap-2">
          <TypeBadge type={learning.type} />
          <ConfidenceBadge confidence={displayConfidence} />
          {showAiConfidence && (
            <span className="text-[10px] text-muted-foreground">(AI: {learning.confidence})</span>
          )}
          {learning.platform ? (
            <Badge variant="outline" className="text-xs capitalize">{learning.platform}</Badge>
          ) : (
            <span className="text-xs text-muted-foreground">All platforms</span>
          )}
          {/* Status badge for non-pending */}
          {learning.status === 'approved' && learning.isActive === 1 && (
            <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700 ml-auto">Active</Badge>
          )}
          {learning.status === 'approved' && learning.isActive === 0 && (
            <Badge variant="secondary" className="text-xs ml-auto">Paused</Badge>
          )}
          {learning.status === 'rejected' && (
            <Badge variant="destructive" className="text-xs ml-auto">Rejected</Badge>
          )}
          {learning.status === 'auto_deactivated' && (
            <Badge variant="destructive" className="text-xs ml-auto bg-amber-600 hover:bg-amber-700">Auto-deactivated</Badge>
          )}
          {learning.status === 'pending' && (
            <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 ml-auto">Pending Review</Badge>
          )}
        </div>

        {/* Description */}
        <p className="text-sm leading-relaxed">{learning.description}</p>

        {/* A/B effectiveness panel */}
        {stats && (
          <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">With this learning:</span>
              <span className="font-medium">{stats.withCount} posts, avg {stats.withAvgEngagement}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Without this learning:</span>
              <span className="font-medium">{stats.withoutCount} posts, avg {stats.withoutAvgEngagement}</span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className="text-muted-foreground">Engagement delta:</span>
              <span className={`font-semibold ${stats.engagementDelta > 0 ? 'text-green-500' : stats.engagementDelta < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                {stats.engagementDelta > 0 ? '+' : ''}{stats.engagementDelta}
              </span>
            </div>
          </div>
        )}

        {/* Footer row: metadata + actions */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{supportingCount} supporting post{supportingCount !== 1 ? 's' : ''}</span>
            <span>{formatRelativeDate(learning.createdAt)}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {learning.status === 'pending' && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700"
                  disabled={isPending}
                  onClick={() => onAction('approve', learning.id)}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 px-3 text-xs"
                  disabled={isPending}
                  onClick={() => onAction('reject', learning.id)}
                >
                  Reject
                </Button>
              </>
            )}
            {learning.status === 'approved' && learning.isActive === 1 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs"
                disabled={isPending}
                onClick={() => onAction('toggle', learning.id, false)}
              >
                Pause
              </Button>
            )}
            {learning.status === 'approved' && learning.isActive === 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-3 text-xs"
                disabled={isPending}
                onClick={() => onAction('toggle', learning.id, true)}
              >
                Activate
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function LearningsSection({
  learnings,
  brandId,
  brandName,
  hasEnoughData,
  dataCount,
  effectiveness,
}: LearningsSectionProps) {
  const [isPending, startTransition] = useTransition()
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null)
  const [showRejected, setShowRejected] = useState(false)

  const activeLearnings = learnings.filter(
    (l) => l.status !== 'rejected' && l.status !== 'auto_deactivated'
  )
  const hiddenLearnings = learnings.filter(
    (l) => l.status === 'rejected' || l.status === 'auto_deactivated'
  )

  function handleAction(action: string, id: number, value?: boolean) {
    startTransition(async () => {
      let result: { error?: string }
      if (action === 'approve') {
        result = await approveLearning(id)
      } else if (action === 'reject') {
        result = await rejectLearning(id)
      } else {
        result = await toggleLearning(id, value ?? true)
      }
      if (result.error) {
        console.error('Learning action failed:', result.error)
      }
    })
  }

  function handleRunAnalysis() {
    setAnalysisMessage(null)
    startTransition(async () => {
      const result = await runManualAnalysis(brandId)
      if (result.error) {
        setAnalysisMessage(`Error: ${result.error}`)
      } else {
        setAnalysisMessage('Analysis complete. New learnings will appear below.')
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
        <h1 className="text-2xl font-bold">{brandName} Learnings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          AI-extracted patterns from your top and bottom performers
        </p>
      </div>

      {/* Run Analysis area */}
      <div className="flex items-center gap-3 flex-wrap">
        {hasEnoughData ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={handleRunAnalysis}
          >
            {isPending ? 'Running...' : 'Run Analysis'}
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Not enough data yet &mdash; need {30 - dataCount} more posts with engagement scores
          </Button>
        )}
        {analysisMessage && (
          <p className="text-sm text-muted-foreground">{analysisMessage}</p>
        )}
      </div>

      {/* Learnings list */}
      {learnings.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6">
            <p className="text-sm text-muted-foreground">
              No learnings yet. Learnings are generated weekly from your top and bottom performing posts.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeLearnings.map((learning) => (
            <LearningCard
              key={learning.id}
              learning={learning}
              stats={effectiveness[learning.id]}
              onAction={handleAction}
              isPending={isPending}
            />
          ))}

          {/* Hidden learnings toggle (rejected + auto-deactivated) */}
          {hiddenLearnings.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setShowRejected((prev) => !prev)}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                {showRejected
                  ? `Hide ${hiddenLearnings.length} hidden learning${hiddenLearnings.length !== 1 ? 's' : ''}`
                  : `Show ${hiddenLearnings.length} hidden learning${hiddenLearnings.length !== 1 ? 's' : ''}`}
              </button>
              {showRejected && (
                <div className="mt-3 space-y-3">
                  {hiddenLearnings.map((learning) => (
                    <LearningCard
                      key={learning.id}
                      learning={learning}
                      stats={effectiveness[learning.id]}
                      onAction={handleAction}
                      isPending={isPending}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
