import Link from 'next/link'
import { getDb } from '@/db'
import { brands, posts, postAnalytics } from '@/db/schema'
import { eq, and, gte, sql, desc } from 'drizzle-orm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Clock, BarChart3 } from 'lucide-react'

export default async function HomePage() {
  const db = getDb()

  // Fetch all brands
  const allBrands = await db
    .select({ id: brands.id, name: brands.name, niche: brands.niche, primaryColor: brands.primaryColor })
    .from(brands)
    .all()

  // Weekly digest: posts published in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const weeklyPublishedResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(and(eq(posts.status, 'published'), gte(posts.publishedAt, sevenDaysAgo)))
    .get()

  const weeklyPublishedCount = weeklyPublishedResult?.count ?? 0

  // Weekly engagement: sum of engagementScore from postAnalytics this week
  const weeklyEngagementResult = await db
    .select({ total: sql<number>`coalesce(sum(${postAnalytics.engagementScore}), 0)` })
    .from(postAnalytics)
    .where(gte(postAnalytics.collectedAt, sevenDaysAgo))
    .get()

  const weeklyEngagement = weeklyEngagementResult?.total ?? 0

  // Top performer this week
  const topPerformer = await db
    .select({
      content: posts.content,
      platform: postAnalytics.platform,
      score: postAnalytics.engagementScore,
    })
    .from(postAnalytics)
    .innerJoin(posts, eq(postAnalytics.postId, posts.id))
    .where(gte(postAnalytics.collectedAt, sevenDaysAgo))
    .orderBy(desc(postAnalytics.engagementScore))
    .limit(1)
    .get()

  // Per-brand stats
  const brandStats = await Promise.all(
    allBrands.map(async (brand) => {
      // Published post count
      const publishedResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(posts)
        .where(and(eq(posts.brandId, brand.id), eq(posts.status, 'published')))
        .get()

      // Average engagement score
      const avgEngResult = await db
        .select({ avg: sql<number | null>`avg(${postAnalytics.engagementScore})` })
        .from(postAnalytics)
        .innerJoin(posts, eq(postAnalytics.postId, posts.id))
        .where(eq(posts.brandId, brand.id))
        .get()

      // Next scheduled post
      const nextScheduled = await db
        .select({ scheduledAt: posts.scheduledAt })
        .from(posts)
        .where(and(eq(posts.brandId, brand.id), eq(posts.status, 'scheduled')))
        .orderBy(posts.scheduledAt)
        .limit(1)
        .get()

      return {
        ...brand,
        publishedCount: publishedResult?.count ?? 0,
        avgEngagement: avgEngResult?.avg != null ? Math.round(avgEngResult.avg) : null,
        nextScheduledAt: nextScheduled?.scheduledAt ?? null,
      }
    })
  )

  function formatDateTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Your content engine at a glance</p>
      </div>

      {/* Weekly Digest */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">This Week</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Posts Published
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{weeklyPublishedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">in the last 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Total Engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{weeklyEngagement > 0 ? weeklyEngagement.toLocaleString() : '—'}</p>
              <p className="text-xs text-muted-foreground mt-1">engagement score this week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Top Performer
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topPerformer ? (
                <>
                  <p className="text-sm font-medium leading-snug">
                    {topPerformer.content.slice(0, 60)}{topPerformer.content.length > 60 ? '…' : ''}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">{topPerformer.platform}</Badge>
                    <span className="text-xs text-muted-foreground">score {topPerformer.score}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No posts published this week.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Brand Cards */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Brands</h2>
        {brandStats.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm mb-3">No brands yet. Get started by creating your first brand.</p>
              <Link href="/brands" className="text-sm font-medium text-primary hover:underline">
                Create your first brand →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {brandStats.map((brand) => (
              <Link key={brand.id} href={`/brands/${brand.id}`} className="block group">
                <Card className="h-full transition-colors group-hover:bg-muted/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      {brand.primaryColor && (
                        <span
                          className="inline-block size-3 rounded-full border border-border flex-shrink-0"
                          style={{ backgroundColor: brand.primaryColor }}
                        />
                      )}
                      <CardTitle className="text-base">{brand.name}</CardTitle>
                    </div>
                    <CardDescription>{brand.niche}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Published</span>
                      <span className="font-medium">{brand.publishedCount}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        Avg Engagement
                      </span>
                      <span className="font-medium">
                        {brand.avgEngagement != null ? brand.avgEngagement : 'No data'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Next Scheduled
                      </span>
                      <span className="font-medium text-xs">
                        {brand.nextScheduledAt ? formatDateTime(brand.nextScheduledAt) : 'None scheduled'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
