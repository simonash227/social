'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { syncAccounts } from '@/app/actions/accounts'

// Platform display labels with simple text identifiers
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

function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform.toLowerCase()] ?? platform
}

interface SocialAccount {
  id: number
  platform: string
  username: string
  status: 'connected' | 'disconnected'
  failureCount: number
}

interface AccountsSectionProps {
  brandId: number
  accounts: SocialAccount[]
}

export function AccountsSection({ brandId, accounts }: AccountsSectionProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [syncResult, setSyncResult] = useState<{ synced?: number; error?: string } | null>(null)

  function handleSync() {
    startTransition(async () => {
      setSyncResult(null)
      const result = await syncAccounts(brandId)
      setSyncResult(result)
      if (!result.error) {
        router.refresh()
      }
    })
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Connected Accounts
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isPending}
          >
            {isPending ? 'Syncing...' : 'Sync Accounts'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={
              <a
                href="https://app.upload-post.com"
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            Connect Account
          </Button>
        </div>
      </div>

      {syncResult && (
        <div
          className={`rounded-md px-3 py-2 text-sm ${
            syncResult.error
              ? 'bg-destructive/10 text-destructive'
              : 'bg-green-500/10 text-green-600 dark:text-green-400'
          }`}
        >
          {syncResult.error
            ? `Sync failed: ${syncResult.error}`
            : syncResult.synced === 0
            ? 'All accounts up to date.'
            : `Synced ${syncResult.synced} account${syncResult.synced !== 1 ? 's' : ''}.`}
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">No connected accounts yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect accounts on{' '}
            <a
              href="https://app.upload-post.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              Upload-Post
            </a>
            , then click &ldquo;Sync Accounts&rdquo; to see them here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{getPlatformLabel(account.platform)}</p>
                <p className="text-xs text-muted-foreground">@{account.username}</p>
              </div>
              <Badge variant={account.status === 'connected' ? 'default' : 'destructive'}>
                {account.status === 'connected' ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Manage your social accounts on Upload-Post, then click &ldquo;Sync Accounts&rdquo; to
        update this list.
      </p>
    </section>
  )
}
