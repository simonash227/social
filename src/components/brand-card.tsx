import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { brands } from '@/db/schema'
import type { InferSelectModel } from 'drizzle-orm'

type Brand = InferSelectModel<typeof brands>

interface BrandCardProps {
  brand: Brand
  accountCount: number
}

export function BrandCard({ brand, accountCount }: BrandCardProps) {
  return (
    <Link href={`/brands/${brand.id}`} className="group block">
      <Card className="transition-colors group-hover:border-primary/50 h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-base">{brand.name}</CardTitle>
              <CardDescription className="truncate">{brand.niche}</CardDescription>
            </div>
            {/* Color swatches */}
            <div className="flex shrink-0 gap-1.5 pt-0.5">
              {brand.primaryColor && (
                <span
                  className="block size-5 rounded-full border border-border"
                  style={{ backgroundColor: brand.primaryColor }}
                  title={`Primary: ${brand.primaryColor}`}
                />
              )}
              {brand.secondaryColor && (
                <span
                  className="block size-5 rounded-full border border-border"
                  style={{ backgroundColor: brand.secondaryColor }}
                  title={`Secondary: ${brand.secondaryColor}`}
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {accountCount === 0
              ? 'No connected accounts'
              : `${accountCount} connected account${accountCount === 1 ? '' : 's'}`}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
