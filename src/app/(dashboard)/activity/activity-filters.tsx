'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

interface ActivityFiltersProps {
  brands: { id: number; name: string }[]
  currentBrand: string
  currentLevel: string
  currentType: string
  totalCount: number
}

const LOG_TYPES = [
  'backup',
  'ai_spend',
  'publish',
  'feed_poll',
  'analytics',
  'generation',
  'auto_generate',
  'scheduler',
]

export function ActivityFilters({
  brands,
  currentBrand,
  currentLevel,
  currentType,
  totalCount,
}: ActivityFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`?${params.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={currentBrand}
        onChange={(e) => updateFilter('brand', e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All Brands</option>
        {brands.map((b) => (
          <option key={b.id} value={String(b.id)}>
            {b.name}
          </option>
        ))}
      </select>

      <select
        value={currentLevel}
        onChange={(e) => updateFilter('level', e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All Levels</option>
        <option value="info">Info</option>
        <option value="warn">Warn</option>
        <option value="error">Error</option>
      </select>

      <select
        value={currentType}
        onChange={(e) => updateFilter('type', e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All Types</option>
        {LOG_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <span className="text-sm text-muted-foreground ml-auto">{totalCount} entries</span>
    </div>
  )
}
