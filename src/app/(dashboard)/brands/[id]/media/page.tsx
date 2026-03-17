import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getDb } from '@/db'
import { brands } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ImageIcon } from 'lucide-react'
import { getMediaLibrary } from '@/app/actions/images'
import { MediaGrid } from './media-grid'

interface MediaPageProps {
  params: Promise<{ id: string }>
}

export default async function MediaPage({ params }: MediaPageProps) {
  const { id } = await params
  const brandId = parseInt(id, 10)

  if (isNaN(brandId)) notFound()

  const db = getDb()
  const brand = await db.select().from(brands).where(eq(brands.id, brandId)).get()

  if (!brand) notFound()

  const images = await getMediaLibrary(brandId)

  return (
    <div className="mx-auto max-w-5xl space-y-6">
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
        <h1 className="text-2xl font-bold">Media Library</h1>
        <p className="text-muted-foreground">Generated images for {brand.name}</p>
      </div>

      {/* Content */}
      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-4 text-sm text-muted-foreground">No images generated yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate images from the{' '}
            <Link
              href={`/brands/${brand.id}/generate`}
              className="text-primary underline underline-offset-2 hover:no-underline"
            >
              content generation page
            </Link>
            .
          </p>
        </div>
      ) : (
        <MediaGrid images={images} brandId={brandId} />
      )}
    </div>
  )
}
