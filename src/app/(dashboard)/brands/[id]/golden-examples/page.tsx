import { notFound } from 'next/navigation'
import { getDb } from '@/db'
import { brands, posts, postAnalytics } from '@/db/schema'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { GoldenExamplesSection } from './golden-examples-section'

interface GoldenExamplesPageProps {
  params: Promise<{ id: string }>
}

interface GoldenPost {
  postId: number
  content: string
  engagementScore: number
  platform: string
  collectedAt: string
  isGoldenPinned: number
  publishedAt: string | null
}

export default async function GoldenExamplesPage({ params }: GoldenExamplesPageProps) {
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

  // Query all published posts with engagement scores for this brand
  // Exclude variant losers (variantOf IS NOT NULL)
  const rows = await db
    .select({
      postId: posts.id,
      content: posts.content,
      engagementScore: postAnalytics.engagementScore,
      platform: postAnalytics.platform,
      collectedAt: postAnalytics.collectedAt,
      isGoldenPinned: posts.isGoldenPinned,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .innerJoin(postAnalytics, eq(postAnalytics.postId, posts.id))
    .where(
      and(
        eq(posts.brandId, brandId),
        eq(posts.status, 'published'),
        isNotNull(postAnalytics.engagementScore),
        isNull(posts.variantOf)
      )
    )
    .all()

  if (rows.length === 0) {
    return (
      <GoldenExamplesSection
        posts={[]}
        brandId={brand.id}
        brandName={brand.name}
      />
    )
  }

  // Calculate 90th percentile threshold
  const scores = rows
    .map((r) => r.engagementScore ?? 0)
    .sort((a, b) => a - b)

  const p90Index = Math.floor(scores.length * 0.9)
  const p90Threshold = scores[p90Index] ?? 0

  // Cutoff date for "recent" = last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // Split into three groups: pinned, recent top, historic top
  const pinned: GoldenPost[] = []
  const recentTop: GoldenPost[] = []
  const historicTop: GoldenPost[] = []

  for (const row of rows) {
    const score = row.engagementScore ?? 0
    const post: GoldenPost = {
      postId: row.postId,
      content: row.content,
      engagementScore: score,
      platform: row.platform,
      collectedAt: row.collectedAt,
      isGoldenPinned: row.isGoldenPinned,
      publishedAt: row.publishedAt,
    }

    if (row.isGoldenPinned === 1) {
      pinned.push(post)
    } else if (score >= p90Threshold && (row.publishedAt ?? '') >= thirtyDaysAgo) {
      recentTop.push(post)
    } else if (score >= p90Threshold) {
      historicTop.push(post)
    }
  }

  // Sort each group by engagement score descending
  recentTop.sort((a, b) => b.engagementScore - a.engagementScore)
  historicTop.sort((a, b) => b.engagementScore - a.engagementScore)

  // Merge: pinned first, then recent top, then historic top (show ALL qualifying posts)
  const allPosts = [...pinned, ...recentTop, ...historicTop]

  return (
    <GoldenExamplesSection
      posts={allPosts}
      brandId={brand.id}
      brandName={brand.name}
    />
  )
}
