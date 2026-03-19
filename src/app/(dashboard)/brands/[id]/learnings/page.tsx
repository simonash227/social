import { notFound } from 'next/navigation'
import { getDb } from '@/db'
import { brands, brandLearnings, posts, postAnalytics } from '@/db/schema'
import { desc, eq, isNotNull, sql } from 'drizzle-orm'
import { LearningsSection } from './learnings-section'

interface LearningsPageProps {
  params: Promise<{ id: string }>
}

export default async function LearningsPage({ params }: LearningsPageProps) {
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

  // All learnings for this brand ordered newest first
  const learnings = await db
    .select({
      id: brandLearnings.id,
      type: brandLearnings.type,
      description: brandLearnings.description,
      confidence: brandLearnings.confidence,
      status: brandLearnings.status,
      isActive: brandLearnings.isActive,
      supportingPostIds: brandLearnings.supportingPostIds,
      platform: brandLearnings.platform,
      createdAt: brandLearnings.createdAt,
    })
    .from(brandLearnings)
    .where(eq(brandLearnings.brandId, brandId))
    .orderBy(desc(brandLearnings.createdAt))
    .all()

  // Count posts with non-null engagement scores (30-post threshold check)
  const engagementCountResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(postAnalytics)
    .innerJoin(posts, eq(postAnalytics.postId, posts.id))
    .where(
      sql`${posts.brandId} = ${brandId} AND ${postAnalytics.engagementScore} IS NOT NULL`
    )
    .get()

  const dataCount = engagementCountResult?.count ?? 0
  const hasEnoughData = dataCount >= 30

  return (
    <LearningsSection
      learnings={learnings}
      brandId={brand.id}
      brandName={brand.name}
      hasEnoughData={hasEnoughData}
      dataCount={dataCount}
    />
  )
}
