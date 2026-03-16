import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDb } from '@/db'
import { brands, socialAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { DeleteBrandDialog } from './delete-dialog' // uses deleteBrand server action

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
        <Button variant="outline" size="sm" render={<Link href={`/brands/${brand.id}/edit`} />}>
          Edit Brand
        </Button>
      </div>

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
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Connected Accounts
          </h2>
          <Button
            variant="outline"
            size="sm"
            render={<a href="https://app.upload-post.com" target="_blank" rel="noreferrer" />}
          >
            Connect Account
          </Button>
        </div>

        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No connected accounts yet.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium capitalize">{account.platform}</p>
                  <p className="text-xs text-muted-foreground">@{account.username}</p>
                </div>
                <Badge
                  variant={account.status === 'connected' ? 'default' : 'destructive'}
                >
                  {account.status}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Manage your social accounts on Upload-Post, then they&apos;ll appear here automatically.
        </p>
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
