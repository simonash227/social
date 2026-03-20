import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDb } from '@/db'
import { brands, socialAccounts, posts, postPlatforms, postAnalytics } from '@/db/schema'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, ImageIcon, LayoutGrid, Rss, BarChart3, Brain, Star } from 'lucide-react'
import { DeleteBrandDialog } from './delete-dialog' // uses deleteBrand server action
import { AccountsSection } from './accounts-section'

interface BrandDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function BrandDetailPage({ params }: BrandDetailPageProps) {
  const { id } = await params
  const brandId = parseInt(id, 10)

  if (isNaN(brandId)) notFound()

  const db = getDb()
  const brand = await db.select().from(brands).where(eq(brands.id, brandId)).get()

  if (!brand) notFound()

  const accounts = await db
    .select()
    .from(socialAccounts)
    .where(eq(socialAccounts.brandId, brandId))
    .all()

  // Quick stats queries
  const publishedCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(and(eq(posts.brandId, brandId), eq(posts.status, 'published')))
    .get()

  const scheduledCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(and(eq(posts.brandId, brandId), eq(posts.status, 'scheduled')))
    .get()

  const avgEngResult = await db
    .select({ avg: sql<number | null>`avg(${postAnalytics.engagementScore})` })
    .from(postAnalytics)
    .innerJoin(posts, eq(postAnalytics.postId, posts.id))
    .where(eq(posts.brandId, brandId))
    .get()

  const topTierCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(postAnalytics)
    .innerJoin(posts, eq(postAnalytics.postId, posts.id))
    .where(and(eq(posts.brandId, brandId), eq(postAnalytics.performerTier, 'top')))
    .get()

  const publishedCount = publishedCountResult?.count ?? 0
  const scheduledCount = scheduledCountResult?.count ?? 0
  const avgEngagement = avgEngResult?.avg != null ? Math.round(avgEngResult.avg) : null
  const topTierCount = topTierCountResult?.count ?? 0

  // Recent 5 posts with platform info — exclude runner-up variants (variantOf is not null)
  const recentPosts = await db
    .select({
      id: posts.id,
      content: posts.content,
      status: posts.status,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .where(and(
      eq(posts.brandId, brandId),
      isNull(posts.variantOf),
    ))
    .orderBy(desc(posts.createdAt))
    .limit(5)
    .all()

  // Get platforms and analytics for recent posts
  const recentPostIds = recentPosts.map((p) => p.id)
  const recentPlatforms = recentPostIds.length > 0
    ? await db
        .select({ postId: postPlatforms.postId, platform: postPlatforms.platform, status: postPlatforms.status })
        .from(postPlatforms)
        .where(sql`${postPlatforms.postId} IN (${sql.raw(recentPostIds.join(','))})`)
        .all()
    : []

  const recentAnalytics = recentPostIds.length > 0
    ? await db
        .select({ postId: postAnalytics.postId, engagementScore: postAnalytics.engagementScore })
        .from(postAnalytics)
        .where(sql`${postAnalytics.postId} IN (${sql.raw(recentPostIds.join(','))})`)
        .orderBy(desc(postAnalytics.engagementScore))
        .all()
    : []

  // Build lookup maps
  const platformsByPost = new Map<number, string[]>()
  for (const pp of recentPlatforms) {
    if (!platformsByPost.has(pp.postId)) platformsByPost.set(pp.postId, [])
    platformsByPost.get(pp.postId)!.push(pp.platform)
  }

  const topAnalyticsByPost = new Map<number, number | null>()
  for (const pa of recentAnalytics) {
    if (!topAnalyticsByPost.has(pa.postId)) {
      topAnalyticsByPost.set(pa.postId, pa.engagementScore)
    }
  }

  function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    if (status === 'published') return 'default'
    if (status === 'failed') return 'destructive'
    if (status === 'scheduled') return 'secondary'
    return 'outline'
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{brand.name}</h1>
            {brand.primaryColor && (
              <span
                className="block size-5 rounded-full border border-border"
                style={{ backgroundColor: brand.primaryColor }}
              />
            )}
            {brand.secondaryColor && (
              <span
                className="block size-5 rounded-full border border-border"
                style={{ backgroundColor: brand.secondaryColor }}
              />
            )}
          </div>
          <p className="text-muted-foreground">{brand.niche}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" render={<Link href={`/brands/${brand.id}/generate`} />}>
            <Sparkles className="mr-2 h-4 w-4" />
            Generate Content
          </Button>
          <Button variant="outline" size="sm" render={<Link href={`/brands/${brand.id}/media`} />}>
            <ImageIcon className="mr-2 h-4 w-4" />
            Media Library
          </Button>
          <Button variant="outline" size="sm" render={<Link href={`/brands/${brand.id}/carousels`} />}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Carousels
          </Button>
          <Button variant="outline" size="sm" render={<Link href={`/brands/${brand.id}/feeds`} />}>
            <Rss className="mr-2 h-4 w-4" />
            Feed Sources
          </Button>
          <Button variant="outline" size="sm" render={<Link href={`/brands/${brand.id}/analytics`} />}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </Button>
          <Button variant="outline" size="sm" render={<Link href={`/brands/${brand.id}/learnings`} />}>
            <Brain className="mr-2 h-4 w-4" />
            Learnings
          </Button>
          <Button variant="outline" size="sm" render={<Link href={`/brands/${brand.id}/golden-examples`} />}>
            <Star className="mr-2 h-4 w-4" />
            Golden Examples
          </Button>
          <Button variant="outline" size="sm" render={<Link href={`/brands/${brand.id}/edit`} />}>
            Edit Brand
          </Button>
        </div>
      </div>

      <Separator />

      {/* Quick Stats */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Quick Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Published</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{publishedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Scheduled</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{scheduledCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Avg Engagement</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{avgEngagement != null ? avgEngagement : 'N/A'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Top Tier Posts</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className="text-2xl font-bold">{topTierCount}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Separator />

      {/* Identity */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Brand Identity
        </h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              Voice &amp; Tone
            </p>
            <p className="text-sm">{brand.voiceTone}</p>
          </div>
          {brand.targetAudience && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Target Audience
              </p>
              <p className="text-sm">{brand.targetAudience}</p>
            </div>
          )}
          {brand.goals && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                Goals
              </p>
              <p className="text-sm">{brand.goals}</p>
            </div>
          )}
        </div>
      </section>

      {/* Content Strategy */}
      {(brand.topics?.length || brand.dosList?.length || brand.dontsList?.length) && (
        <>
          <Separator />
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Content Strategy
            </h2>
            {brand.topics?.length ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Topics
                </p>
                <div className="flex flex-wrap gap-2">
                  {brand.topics.map((topic) => (
                    <Badge key={topic} variant="secondary">{topic}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {brand.dosList?.length ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Dos
                  </p>
                  <ul className="space-y-1">
                    {brand.dosList.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <span className="text-green-500 mt-0.5">+</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {brand.dontsList?.length ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Don&apos;ts
                  </p>
                  <ul className="space-y-1">
                    {brand.dontsList.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <span className="text-red-500 mt-0.5">-</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </section>
        </>
      )}

      {/* Visual Style */}
      {(brand.primaryColor || brand.secondaryColor || brand.logoUrl || brand.watermarkPosition) && (
        <>
          <Separator />
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Visual Style
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {brand.primaryColor && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Primary</p>
                  <div className="flex items-center gap-2">
                    <span
                      className="size-5 rounded-full border border-border"
                      style={{ backgroundColor: brand.primaryColor }}
                    />
                    <span>{brand.primaryColor}</span>
                  </div>
                </div>
              )}
              {brand.secondaryColor && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Secondary</p>
                  <div className="flex items-center gap-2">
                    <span
                      className="size-5 rounded-full border border-border"
                      style={{ backgroundColor: brand.secondaryColor }}
                    />
                    <span>{brand.secondaryColor}</span>
                  </div>
                </div>
              )}
              {brand.watermarkPosition && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Watermark</p>
                  <p>{brand.watermarkPosition}</p>
                </div>
              )}
              {brand.watermarkOpacity != null && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Opacity</p>
                  <p>{brand.watermarkOpacity}%</p>
                </div>
              )}
            </div>
            {brand.logoUrl && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Logo URL</p>
                <a href={brand.logoUrl} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline break-all">
                  {brand.logoUrl}
                </a>
              </div>
            )}
          </section>
        </>
      )}

      {/* Engagement */}
      {(brand.ctaText || brand.bioTemplate || brand.bioLink || brand.bannedHashtags?.length) && (
        <>
          <Separator />
          <section className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Engagement
            </h2>
            {brand.ctaText && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">CTA Text</p>
                <p className="text-sm">{brand.ctaText}</p>
              </div>
            )}
            {brand.bioTemplate && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Bio Template</p>
                <p className="text-sm font-mono bg-muted p-2 rounded">{brand.bioTemplate}</p>
              </div>
            )}
            {brand.bioLink && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Bio Link</p>
                <a href={brand.bioLink} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                  {brand.bioLink}
                </a>
              </div>
            )}
            {brand.bannedHashtags?.length ? (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Banned Hashtags</p>
                <div className="flex flex-wrap gap-2">
                  {brand.bannedHashtags.map((tag) => (
                    <Badge key={tag} variant="destructive">{tag}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        </>
      )}

      {/* Warmup Date */}
      {brand.warmupDate && (
        <>
          <Separator />
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Account Settings
            </h2>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Warmup Date</p>
              <p className="text-sm">{brand.warmupDate}</p>
            </div>
          </section>
        </>
      )}

      {/* Connected Accounts */}
      <Separator />
      <AccountsSection brandId={brandId} accounts={accounts} />

      {/* Recent Posts */}
      <Separator />
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent Posts</h2>
        {recentPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No posts yet.{' '}
            <Link href={`/brands/${brand.id}/generate`} className="text-primary hover:underline">
              Generate your first content.
            </Link>
          </p>
        ) : (
          <div className="space-y-2">
            {recentPosts.map((post) => {
              const platforms = platformsByPost.get(post.id) ?? []
              const engagement = topAnalyticsByPost.get(post.id) ?? null
              return (
                <Link
                  key={post.id}
                  href={`/brands/${brand.id}/posts/${post.id}`}
                  className="flex items-start gap-3 rounded-md border px-4 py-3 text-sm hover:bg-muted/50 transition-colors"
                >
                  <span className="flex-1 text-sm leading-snug text-muted-foreground" title={post.content}>
                    {post.content.slice(0, 80)}{post.content.length > 80 ? '…' : ''}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={statusVariant(post.status)} className="text-xs capitalize">
                      {post.status}
                    </Badge>
                    {platforms.map((p) => (
                      <Badge key={p} variant="outline" className="text-xs">
                        {p}
                      </Badge>
                    ))}
                    {engagement != null && (
                      <span className="text-xs text-muted-foreground">score {engagement}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Delete */}
      <Separator />
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-destructive">
          Danger Zone
        </h2>
        <p className="text-sm text-muted-foreground">
          Permanently delete this brand and all connected accounts. This cannot be undone.
        </p>
        <DeleteBrandDialog brandId={brand.id} brandName={brand.name} />
      </section>
    </div>
  )
}
