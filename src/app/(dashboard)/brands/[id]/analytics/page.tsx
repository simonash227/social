import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDb } from '@/db'
import { brands, posts, postAnalytics } from '@/db/schema'
import { and, desc, eq, sql } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft } from 'lucide-react'

interface AnalyticsPageProps {
  params: Promise<{ id: string }>
}

export default async function BrandAnalyticsPage({ params }: AnalyticsPageProps) {
  const { id } = await params
  const brandId = parseInt(id, 10)
  if (isNaN(brandId)) notFound()

  const db = getDb()

  const brand = await db
    .select({ id: brands.id, name: brands.name })
    .from(brands)
    .where(eq(brands.id, brandId))
    .get()

  if (!brand) notFound()

  // All analytics for this brand
  const allAnalytics = await db
    .select({
      id: postAnalytics.id,
      postId: postAnalytics.postId,
      platform: postAnalytics.platform,
      views: postAnalytics.views,
      likes: postAnalytics.likes,
      comments: postAnalytics.comments,
      shares: postAnalytics.shares,
      engagementScore: postAnalytics.engagementScore,
      performerTier: postAnalytics.performerTier,
      collectedAt: postAnalytics.collectedAt,
      postContent: posts.content,
    })
    .from(postAnalytics)
    .innerJoin(posts, eq(postAnalytics.postId, posts.id))
    .where(eq(posts.brandId, brandId))
    .orderBy(desc(postAnalytics.collectedAt))
    .all()

  const hasData = allAnalytics.length > 0

  // Overall stats
  const totalPublishedResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(and(eq(posts.brandId, brandId), eq(posts.status, 'published')))
    .get()

  const totalPublished = totalPublishedResult?.count ?? 0
  const overallAvgEngagement =
    hasData
      ? Math.round(
          allAnalytics.reduce((sum, a) => sum + (a.engagementScore ?? 0), 0) / allAnalytics.length
        )
      : null
  const topPerformerCount = allAnalytics.filter((a) => a.performerTier === 'top').length
  const underPerformerCount = allAnalytics.filter((a) => a.performerTier === 'under').length

  // Per-platform breakdown
  const platformMap = new Map<string, {
    count: number
    totalEngagement: number
    top: number
    average: number
    under: number
  }>()

  for (const a of allAnalytics) {
    if (!platformMap.has(a.platform)) {
      platformMap.set(a.platform, { count: 0, totalEngagement: 0, top: 0, average: 0, under: 0 })
    }
    const entry = platformMap.get(a.platform)!
    entry.count++
    entry.totalEngagement += a.engagementScore ?? 0
    if (a.performerTier === 'top') entry.top++
    else if (a.performerTier === 'average') entry.average++
    else if (a.performerTier === 'under') entry.under++
  }

  // Top 5 performing posts by engagement score
  const top5 = [...allAnalytics]
    .sort((a, b) => (b.engagementScore ?? 0) - (a.engagementScore ?? 0))
    .slice(0, 5)

  function tierVariant(tier: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (tier === 'top') return 'default'
    if (tier === 'under') return 'destructive'
    return 'secondary'
  }

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          href={`/brands/${brand.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to {brand.name}
        </Link>
        <h1 className="text-2xl font-bold">{brand.name} Analytics</h1>
        <p className="text-muted-foreground mt-1 text-sm">Engagement metrics and performance breakdown</p>
      </div>

      {!hasData ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              No analytics data collected yet. The analytics cron runs every 6 hours for posts published at least 48 hours ago.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overall Stats */}
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Overall</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Published</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-2xl font-bold">{totalPublished}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Engagement</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-2xl font-bold">{overallAvgEngagement ?? 'N/A'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top Performers</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-2xl font-bold">{topPerformerCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-1 pt-4 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Underperformers</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-2xl font-bold">{underPerformerCount}</p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Per-Platform Breakdown */}
          {platformMap.size > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                By Platform
              </h2>
              <div className="space-y-3">
                {Array.from(platformMap.entries()).map(([platform, stats]) => (
                  <Card key={platform}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-medium capitalize min-w-[80px]">{platform}</span>
                        <span className="text-sm text-muted-foreground">{stats.count} posts</span>
                        <span className="text-sm text-muted-foreground">
                          avg {stats.count > 0 ? Math.round(stats.totalEngagement / stats.count) : 0}
                        </span>
                        <div className="flex items-center gap-2 ml-auto">
                          {stats.top > 0 && (
                            <Badge variant="default" className="text-xs">
                              {stats.top} top
                            </Badge>
                          )}
                          {stats.average > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {stats.average} avg
                            </Badge>
                          )}
                          {stats.under > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {stats.under} under
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Top Performers Table */}
          {top5.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Top Performers
              </h2>
              <div className="space-y-2">
                {top5.map((a) => (
                  <div key={a.id} className="rounded-md border px-4 py-3 space-y-2">
                    <div className="flex items-start gap-3">
                      <span className="flex-1 text-sm leading-snug" title={a.postContent}>
                        {a.postContent.slice(0, 60)}{a.postContent.length > 60 ? '…' : ''}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs capitalize">{a.platform}</Badge>
                        <Badge variant={tierVariant(a.performerTier)} className="text-xs capitalize">
                          {a.performerTier ?? 'unknown'}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-medium">
                          score {a.engagementScore ?? 0}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {a.views != null && <span>{a.views.toLocaleString()} views</span>}
                      {a.likes != null && <span>{a.likes.toLocaleString()} likes</span>}
                      {a.comments != null && <span>{a.comments.toLocaleString()} comments</span>}
                      {a.shares != null && <span>{a.shares.toLocaleString()} shares</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
