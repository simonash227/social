import { getDb } from '@/db'
import { activityLog, brands } from '@/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ActivityFilters } from './activity-filters'

interface ActivityPageProps {
  searchParams: Promise<{ brand?: string; level?: string; type?: string }>
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function levelVariant(level: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (level === 'error') return 'destructive'
  if (level === 'warn') return 'outline'
  return 'secondary'
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const params = await searchParams
  const brandFilter = params.brand ?? ''
  const levelFilter = params.level ?? ''
  const typeFilter = params.type ?? ''

  const db = getDb()

  // Build WHERE conditions
  const conditions = []
  if (brandFilter) conditions.push(eq(activityLog.brandId, parseInt(brandFilter, 10)))
  if (levelFilter) conditions.push(eq(activityLog.level, levelFilter as 'info' | 'warn' | 'error'))
  if (typeFilter) conditions.push(eq(activityLog.type, typeFilter))

  const entries = await db
    .select({
      id: activityLog.id,
      brandId: activityLog.brandId,
      type: activityLog.type,
      level: activityLog.level,
      message: activityLog.message,
      createdAt: activityLog.createdAt,
    })
    .from(activityLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(activityLog.createdAt))
    .limit(200)
    .all()

  // Fetch brands for filter dropdown + name resolution
  const allBrands = await db
    .select({ id: brands.id, name: brands.name })
    .from(brands)
    .all()

  const brandMap = new Map(allBrands.map((b) => [b.id, b.name]))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
        <p className="mt-2 text-muted-foreground">System events, cron jobs, and errors across all brands</p>
      </div>

      <ActivityFilters
        brands={allBrands}
        currentBrand={brandFilter}
        currentLevel={levelFilter}
        currentType={typeFilter}
        totalCount={entries.length}
      />

      <div className="space-y-1">
        {entries.length === 0 ? (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">No activity log entries found.</p>
          </Card>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${
                entry.level === 'error'
                  ? 'border-destructive/40 bg-destructive/5'
                  : entry.level === 'warn'
                  ? 'border-yellow-500/30 bg-yellow-500/5'
                  : 'border-border'
              }`}
            >
              {/* Timestamp */}
              <span
                className="min-w-[5rem] text-xs text-muted-foreground pt-0.5 flex-shrink-0"
                title={entry.createdAt}
              >
                {formatRelativeTime(entry.createdAt)}
              </span>

              {/* Level badge */}
              <Badge
                variant={levelVariant(entry.level ?? 'info')}
                className="flex-shrink-0 text-xs capitalize"
              >
                {entry.level}
              </Badge>

              {/* Type badge */}
              <Badge variant="outline" className="flex-shrink-0 text-xs">
                {entry.type}
              </Badge>

              {/* Message */}
              <span
                className="flex-1 text-sm leading-snug truncate"
                title={entry.message}
              >
                {entry.message}
              </span>

              {/* Brand */}
              {entry.brandId && brandMap.has(entry.brandId) && (
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {brandMap.get(entry.brandId)}
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
