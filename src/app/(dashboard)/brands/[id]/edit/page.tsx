import { notFound } from 'next/navigation'
import { getDb } from '@/db'
import { brands } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { BrandForm } from '@/components/brand-form'

interface EditBrandPageProps {
  params: Promise<{ id: string }>
}

export default async function EditBrandPage({ params }: EditBrandPageProps) {
  const { id } = await params
  const brandId = parseInt(id, 10)

  if (isNaN(brandId)) notFound()

  const db = getDb()
  const brand = await db.select().from(brands).where(eq(brands.id, brandId)).get()

  if (!brand) notFound()

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Edit Brand</h1>
      <BrandForm action="edit" brand={brand} />
    </div>
  )
}
