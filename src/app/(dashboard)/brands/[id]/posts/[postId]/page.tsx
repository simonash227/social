import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDb } from '@/db'
import { posts, postPlatforms, brands } from '@/db/schema'
import { and, eq, isNotNull } from 'drizzle-orm'
import { Badge } from '@/components/ui/badge'

interface PostDetailPageProps {
  params: Promise<{ id: string; postId: string }>
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'published') return 'default'
  if (status === 'failed') return 'destructive'
  if (status === 'scheduled') return 'secondary'
  return 'outline'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { id, postId: postIdStr } = await params
  const brandId = parseInt(id, 10)
  const postId = parseInt(postIdStr, 10)

  if (isNaN(brandId) || isNaN(postId)) notFound()

  const db = getDb()

  const post = await db.select().from(posts).where(eq(posts.id, postId)).get()

  if (!post || post.brandId !== brandId) notFound()

  const brand = await db.select().from(brands).where(eq(brands.id, brandId)).get()

  if (!brand) notFound()

  const platforms = await db
    .select()
    .from(postPlatforms)
    .where(eq(postPlatforms.postId, postId))
    .all()

  // Query runner-up variants when this post has a variantGroup
  const runnerUps = post.variantGroup
    ? await db
        .select()
        .from(posts)
        .where(
          and(
            eq(posts.variantGroup, post.variantGroup),
            isNotNull(posts.variantOf),
          ),
        )
        .all()
    : []

  const truncatedTitle = post.content.slice(0, 60) + (post.content.length > 60 ? '…' : '')

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <Link
          href={`/brands/${brandId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; {brand.name}
        </Link>
        <h1 className="text-xl font-bold leading-snug">{truncatedTitle}</h1>
      </div>

      {/* Runner-up notice — shown when this IS a runner-up post */}
      {post.variantOf != null && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          This is a runner-up variant.{' '}
          <Link
            href={`/brands/${brandId}/posts/${post.variantOf}`}
            className="font-medium underline underline-offset-2 hover:no-underline"
          >
            View winning post
          </Link>
        </div>
      )}

      {/* Post info card */}
      <section className="rounded-md border px-4 py-4 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Post Details
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(post.status)} className="capitalize">
            {post.status}
          </Badge>
          {platforms.map((pp) => (
            <Badge key={pp.id} variant="outline" className="text-xs">
              {pp.platform}
            </Badge>
          ))}
          {post.postActiveLearningIds != null && post.postActiveLearningIds.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              Learnings used: {post.postActiveLearningIds.length}
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Quality Score</span>
            <p className="mt-0.5 font-medium">
              {post.qualityScore != null ? `${post.qualityScore}/10` : 'No score'}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Created</span>
            <p className="mt-0.5">{formatDate(post.createdAt)}</p>
          </div>
          {post.scheduledAt && (
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Scheduled</span>
              <p className="mt-0.5">{formatDate(post.scheduledAt)}</p>
            </div>
          )}
          {post.sourceUrl && (
            <div className="col-span-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Source</span>
              <p className="mt-0.5">
                <a
                  href={post.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline break-all"
                >
                  {post.sourceUrl}
                </a>
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Content section */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Content
        </h2>
        {platforms.length > 1 ? (
          <div className="space-y-4">
            {platforms.map((pp) => (
              <div key={pp.id} className="rounded-md border px-4 py-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {pp.platform}
                </p>
                <p className="text-sm whitespace-pre-wrap">
                  {pp.content ?? post.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border px-4 py-3">
            <p className="text-sm whitespace-pre-wrap">{post.content}</p>
          </div>
        )}
      </section>

      {/* Runner-up Variants section */}
      {post.variantGroup != null && runnerUps.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Variants
          </h2>
          <details className="rounded-md border">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              Runner-up Variants ({runnerUps.length})
            </summary>
            <div className="divide-y">
              {runnerUps
                .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))
                .map((v) => (
                  <div key={v.id} className="px-4 py-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Score: {v.qualityScore != null ? `${v.qualityScore}/10` : 'n/a'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {v.content}
                    </p>
                  </div>
                ))}
            </div>
          </details>
        </section>
      )}
    </div>
  )
}
