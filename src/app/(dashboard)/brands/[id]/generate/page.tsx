import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDb } from '@/db'
import { brands, socialAccounts } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { GenerateSection } from './generate-section'

interface GeneratePageProps {
  params: Promise<{ id: string }>
}

export default async function GeneratePage({ params }: GeneratePageProps) {
  const { id } = await params
  const brandId = parseInt(id, 10)

  if (isNaN(brandId)) notFound()

  const db = getDb()
  const brand = await db.select().from(brands).where(eq(brands.id, brandId)).get()

  if (!brand) notFound()

  const connectedAccounts = await db
    .select({
      id: socialAccounts.id,
      platform: socialAccounts.platform,
      username: socialAccounts.username,
    })
    .from(socialAccounts)
    .where(
      and(
        eq(socialAccounts.brandId, brandId),
        eq(socialAccounts.status, 'connected')
      )
    )
    .all()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 text-muted-foreground"
          render={<Link href={`/brands/${brand.id}`} />}
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to {brand.name}
        </Button>
        <h1 className="text-2xl font-bold">Generate Content</h1>
        <p className="text-muted-foreground">
          Create platform-optimized posts for {brand.name}
        </p>
      </div>

      <GenerateSection
        brandId={brandId}
        brandName={brand.name}
        accounts={connectedAccounts}
      />
    </div>
  )
}
