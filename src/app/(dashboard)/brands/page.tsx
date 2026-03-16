import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BrandCard } from '@/components/brand-card'
import { getDb } from '@/db'
import { brands, socialAccounts } from '@/db/schema'
import { count } from 'drizzle-orm'

export default async function BrandsPage() {
  const db = getDb()

  const allBrands = await db.select().from(brands).all()

  // Fetch account counts for all brands in one query
  const accountCounts = await db
    .select({ brandId: socialAccounts.brandId, cnt: count() })
    .from(socialAccounts)
    .groupBy(socialAccounts.brandId)
    .all()

  const countMap = new Map(accountCounts.map((r) => [r.brandId, r.cnt]))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Brands</h1>
        <Button render={<Link href="/brands/new" />}>
          New Brand
        </Button>
      </div>

      {allBrands.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <p className="text-muted-foreground mb-4">No brands yet.</p>
          <Button variant="outline" render={<Link href="/brands/new" />}>
            Create your first brand
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allBrands.map((brand) => (
            <BrandCard
              key={brand.id}
              brand={brand}
              accountCount={countMap.get(brand.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
