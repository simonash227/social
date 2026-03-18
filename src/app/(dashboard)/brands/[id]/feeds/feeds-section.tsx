'use client'

import { useState, useTransition } from 'react'
import {
  addFeed,
  updateFeed,
  deleteFeed,
  updateAutomationLevel,
  type FeedWithStats,
} from '@/app/actions/feeds'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SocialAccount {
  id: number
  platform: string
  username: string
}

interface FeedsSectionProps {
  brandId: number
  brandName: string
  automationLevel: 'manual' | 'semi' | 'mostly' | 'full'
  feeds: FeedWithStats[]
  accounts: SocialAccount[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FEED_TYPE_LABELS: Record<string, string> = {
  rss: 'RSS',
  youtube: 'YouTube',
  reddit: 'Reddit',
  google_news: 'Google News',
}

const POLL_INTERVAL_OPTIONS = [
  { value: '1', label: '1 min' },
  { value: '5', label: '5 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '60 min' },
]

const RELEVANCE_OPTIONS = [3, 4, 5, 6, 7, 8, 9].map((v) => ({
  value: String(v),
  label: `${v}/10`,
}))

const AUTOMATION_LEVEL_OPTIONS = [
  { value: 'manual', label: 'Manual', description: 'No auto-generation' },
  { value: 'semi', label: 'Semi', description: 'Drafts only' },
  { value: 'mostly', label: 'Mostly', description: 'Auto above quality 7' },
  { value: 'full', label: 'Full', description: 'Auto-schedule all' },
]

const AUTOMATION_BADGE_COLORS: Record<string, string> = {
  manual: 'bg-muted text-muted-foreground',
  semi: 'bg-blue-500/20 text-blue-400',
  mostly: 'bg-yellow-500/20 text-yellow-400',
  full: 'bg-green-500/20 text-green-400',
}

const URL_FORMAT_HINTS: Record<string, string> = {
  rss: 'Direct feed URL (e.g., https://blog.example.com/feed.xml)',
  youtube: 'https://www.youtube.com/feeds/videos.xml?channel_id=UC...',
  reddit: 'https://www.reddit.com/r/SUBREDDIT/.rss',
  google_news: 'https://news.google.com/rss/search?q=TOPIC',
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FeedsSection({
  brandId,
  automationLevel: initialAutomationLevel,
  feeds: initialFeeds,
  accounts,
}: FeedsSectionProps) {
  const [automationLevel, setAutomationLevel] = useState(initialAutomationLevel)
  const [feeds, setFeeds] = useState(initialFeeds)

  // Add feed form state
  const [addUrl, setAddUrl] = useState('')
  const [addType, setAddType] = useState<'rss' | 'youtube' | 'reddit' | 'google_news'>('rss')
  const [addError, setAddError] = useState<string | null>(null)
  const [isAddPending, startAddTransition] = useTransition()

  // Automation level
  const [isAutoPending, startAutoTransition] = useTransition()

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [isDeletePending, startDeleteTransition] = useTransition()

  // Per-feed update
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [, startUpdateTransition] = useTransition()

  function handleAutomationChange(value: string | null) {
    if (!value) return
    const level = value as 'manual' | 'semi' | 'mostly' | 'full'
    setAutomationLevel(level)
    startAutoTransition(async () => {
      await updateAutomationLevel(brandId, level)
    })
  }

  function handleAddFeed() {
    setAddError(null)
    startAddTransition(async () => {
      const result = await addFeed(brandId, addUrl, addType)
      if (result.error) {
        setAddError(result.error)
      } else {
        setAddUrl('')
        // Server will revalidate and update feeds list via server component
      }
    })
  }

  function handleToggleEnabled(feed: FeedWithStats) {
    const newEnabled = feed.enabled === 1 ? 0 : 1
    setFeeds((prev) =>
      prev.map((f) => (f.id === feed.id ? { ...f, enabled: newEnabled } : f))
    )
    setUpdatingId(feed.id)
    startUpdateTransition(async () => {
      await updateFeed(feed.id, { enabled: newEnabled })
      setUpdatingId(null)
    })
  }

  function handleUpdateFeed(
    feedId: number,
    updates: { pollInterval?: number; relevanceThreshold?: number; targetPlatforms?: string[] }
  ) {
    setFeeds((prev) =>
      prev.map((f) => (f.id === feedId ? { ...f, ...updates } : f))
    )
    setUpdatingId(feedId)
    startUpdateTransition(async () => {
      await updateFeed(feedId, updates)
      setUpdatingId(null)
    })
  }

  function handleDeleteFeed(feedId: number) {
    setDeletingId(feedId)
  }

  function handleConfirmDelete(feedId: number) {
    startDeleteTransition(async () => {
      await deleteFeed(feedId)
      setFeeds((prev) => prev.filter((f) => f.id !== feedId))
      setDeletingId(null)
    })
  }

  function handleCancelDelete() {
    setDeletingId(null)
  }

  function handlePlatformToggle(feed: FeedWithStats, platform: string) {
    const current = feed.targetPlatforms ?? []
    const next = current.includes(platform)
      ? current.filter((p) => p !== platform)
      : [...current, platform]
    // null means all platforms, empty array means none
    const newPlatforms = next.length === 0 ? null : next
    handleUpdateFeed(feed.id, { targetPlatforms: newPlatforms ?? undefined })
  }

  return (
    <div className="space-y-8">
      {/* Automation Level */}
      <div className="rounded-lg border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Automation Level</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Controls how much automation runs for this brand
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${AUTOMATION_BADGE_COLORS[automationLevel]}`}>
            {AUTOMATION_LEVEL_OPTIONS.find((o) => o.value === automationLevel)?.label}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {AUTOMATION_LEVEL_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleAutomationChange(option.value)}
              disabled={isAutoPending}
              className={`rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                automationLevel === option.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'
              } disabled:opacity-50`}
            >
              <div className="font-medium">{option.label}</div>
              <div className="text-xs opacity-70">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Add Feed Form */}
      <div className="rounded-lg border p-5 space-y-4">
        <h2 className="text-sm font-semibold">Add Feed Source</h2>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Feed Type
            </label>
            <select
              value={addType}
              onChange={(e) => setAddType(e.target.value as typeof addType)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="rss">RSS</option>
              <option value="youtube">YouTube Channel</option>
              <option value="reddit">Reddit</option>
              <option value="google_news">Google News</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Feed URL
            </label>
            <input
              type="url"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground">{URL_FORMAT_HINTS[addType]}</p>
          </div>
          {addError && (
            <p className="text-xs text-destructive">{addError}</p>
          )}
          <button
            onClick={handleAddFeed}
            disabled={isAddPending || !addUrl.trim()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isAddPending ? 'Adding...' : 'Add Feed'}
          </button>
        </div>
      </div>

      {/* Feed List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold">Active Feeds</h2>
        {feeds.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">No feed sources configured.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add an RSS feed above to start automated content discovery.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {feeds.map((feed) => (
              <FeedCard
                key={feed.id}
                feed={feed}
                accounts={accounts}
                isUpdating={updatingId === feed.id}
                isDeleting={deletingId === feed.id}
                isDeletePending={isDeletePending}
                onToggleEnabled={handleToggleEnabled}
                onUpdateFeed={handleUpdateFeed}
                onDeleteFeed={handleDeleteFeed}
                onConfirmDelete={handleConfirmDelete}
                onCancelDelete={handleCancelDelete}
                onPlatformToggle={handlePlatformToggle}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Feed Card Component ──────────────────────────────────────────────────────

interface FeedCardProps {
  feed: FeedWithStats
  accounts: SocialAccount[]
  isUpdating: boolean
  isDeleting: boolean
  isDeletePending: boolean
  onToggleEnabled: (feed: FeedWithStats) => void
  onUpdateFeed: (
    feedId: number,
    updates: { pollInterval?: number; relevanceThreshold?: number; targetPlatforms?: string[] }
  ) => void
  onDeleteFeed: (feedId: number) => void
  onConfirmDelete: (feedId: number) => void
  onCancelDelete: () => void
  onPlatformToggle: (feed: FeedWithStats, platform: string) => void
}

function FeedCard({
  feed,
  accounts,
  isUpdating,
  isDeleting,
  isDeletePending,
  onToggleEnabled,
  onUpdateFeed,
  onDeleteFeed,
  onConfirmDelete,
  onCancelDelete,
  onPlatformToggle,
}: FeedCardProps) {
  const isEnabled = feed.enabled === 1
  const hasFailures = feed.consecutiveFailures > 0

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${isUpdating ? 'opacity-70' : ''}`}>
      {/* Top row: URL, type badge, status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
              {FEED_TYPE_LABELS[feed.type] ?? feed.type}
            </span>
            <span
              title={feed.url}
              className="truncate text-sm font-mono text-muted-foreground max-w-xs"
            >
              {feed.url.length > 60 ? feed.url.slice(0, 60) + '...' : feed.url}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span
              className={`inline-block size-2 rounded-full ${
                isEnabled ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            {isEnabled ? 'Active' : 'Disabled'}
            {hasFailures && (
              <span className="text-destructive">({feed.consecutiveFailures} failures)</span>
            )}
            <span className="ml-2">
              {feed.totalEntries} entries, {feed.relevantEntries} relevant, {feed.processedEntries} processed
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onToggleEnabled(feed)}
            disabled={isUpdating}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              isEnabled
                ? 'bg-muted text-muted-foreground hover:text-foreground'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            } disabled:opacity-50`}
          >
            {isEnabled ? 'Disable' : 'Enable'}
          </button>
          {isDeleting ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Delete?</span>
              <button
                onClick={() => onConfirmDelete(feed.id)}
                disabled={isDeletePending}
                className="rounded bg-destructive px-2 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
              >
                {isDeletePending ? 'Deleting...' : 'Yes'}
              </button>
              <button
                onClick={onCancelDelete}
                disabled={isDeletePending}
                className="rounded bg-muted px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => onDeleteFeed(feed.id)}
              className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Config row: poll interval, threshold */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <label className="text-muted-foreground">Poll interval:</label>
          <select
            value={String(feed.pollInterval ?? 5)}
            onChange={(e) => onUpdateFeed(feed.id, { pollInterval: parseInt(e.target.value, 10) })}
            disabled={isUpdating}
            className="rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          >
            {POLL_INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-muted-foreground">Relevance threshold:</label>
          <select
            value={String(feed.relevanceThreshold ?? 6)}
            onChange={(e) => onUpdateFeed(feed.id, { relevanceThreshold: parseInt(e.target.value, 10) })}
            disabled={isUpdating}
            className="rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          >
            {RELEVANCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Target platforms */}
      {accounts.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Target platforms (leave unchecked for all):</p>
          <div className="flex flex-wrap gap-3">
            {accounts.map((account) => {
              const checked = feed.targetPlatforms
                ? feed.targetPlatforms.includes(account.platform)
                : false
              return (
                <label
                  key={account.id}
                  className="flex items-center gap-1.5 text-xs cursor-pointer has-[:checked]:text-foreground text-muted-foreground"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onPlatformToggle(feed, account.platform)}
                    disabled={isUpdating}
                    className="accent-primary"
                  />
                  {account.platform}
                </label>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
