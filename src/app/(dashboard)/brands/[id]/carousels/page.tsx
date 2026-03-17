import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDb } from '@/db'
import { brands } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { getCarousels } from '@/app/actions/carousels'
import { CarouselSection } from './carousel-section'

interface CarouselPageProps {
  params: Promise<{ id: string }>
}

export default async function CarouselPage({ params }: CarouselPageProps) {
  const { id } = await params
  const brandId = parseInt(id, 10)

  if (isNaN(brandId)) notFound()

  const db = getDb()
  const brand = await db.select().from(brands).where(eq(brands.id, brandId)).get()

  if (!brand) notFound()

  const existingCarousels = await getCarousels(brandId)

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
        <h1 className="text-2xl font-bold">Carousels</h1>
        <p className="text-muted-foreground">
          Create branded carousel slides for {brand.name}
        </p>
      </div>

      <CarouselSection
        brandId={brandId}
        brandName={brand.name}
        primaryColor={brand.primaryColor ?? '#6366f1'}
        secondaryColor={brand.secondaryColor ?? null}
        existingCarousels={existingCarousels}
      />
    </div>
  )
}
