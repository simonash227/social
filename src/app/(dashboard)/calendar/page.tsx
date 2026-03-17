import { getCalendarEvents, getSchedulingSlots } from '@/app/actions/schedule'
import { getDb } from '@/db'
import { brands, socialAccounts } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { CalendarView } from './calendar-view'
import { SlotConfig } from './slot-config'
import Link from 'next/link'

interface CalendarPageProps {
  searchParams: Promise<{ brand?: string; schedule?: string }>
}

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams
  const brandIdParam = params.brand ? parseInt(params.brand, 10) : undefined
  const showSchedule = params.schedule === '1'

  const db = getDb()

  // Fetch all brands for filter dropdown
  const allBrands = db
    .select({ id: brands.id, name: brands.name })
    .from(brands)
    .all() as { id: number; name: string }[]

  // Fetch calendar events (optionally filtered by brand)
  const events = await getCalendarEvents(brandIdParam)

  // If a brand is selected, fetch slots and connected platforms
  let slots: Awaited<ReturnType<typeof getSchedulingSlots>> = []
  let connectedPlatforms: string[] = []

  if (brandIdParam && !isNaN(brandIdParam)) {
    slots = await getSchedulingSlots(brandIdParam)

    const accounts = db
      .select({ platform: socialAccounts.platform })
      .from(socialAccounts)
      .where(eq(socialAccounts.brandId, brandIdParam))
      .all() as { platform: string }[]

    connectedPlatforms = [...new Set(accounts.map(a => a.platform))]
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Calendar</h1>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Brand filter */}
          {allBrands.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Brand:</span>
              <div className="flex gap-1 flex-wrap">
                <Link
                  href="/calendar"
                  className={`rounded-md px-3 py-1 text-sm transition-colors ${
                    !brandIdParam
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All
                </Link>
                {allBrands.map((brand) => (
                  <Link
                    key={brand.id}
                    href={`/calendar?brand=${brand.id}${showSchedule ? '&schedule=1' : ''}`}
                    className={`rounded-md px-3 py-1 text-sm transition-colors ${
                      brandIdParam === brand.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {brand.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Configure Schedule toggle (only when brand is selected) */}
          {brandIdParam && !isNaN(brandIdParam) && (
            <Link
              href={`/calendar?brand=${brandIdParam}${showSchedule ? '' : '&schedule=1'}`}
              className={`rounded-md px-3 py-1 text-sm border transition-colors ${
                showSchedule
                  ? 'border-primary text-primary bg-primary/10'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Configure Schedule
            </Link>
          )}
        </div>
      </div>

      {/* Calendar */}
      <div className="rounded-lg border border-border bg-card p-4">
        <CalendarView events={events} />
      </div>

      {/* Slot Config (visible when brand is selected and schedule toggle is on) */}
      {brandIdParam && !isNaN(brandIdParam) && showSchedule && (
        <SlotConfig
          brandId={brandIdParam}
          initialSlots={slots.map(s => ({
            platform: s.platform,
            hour: s.hour,
            minute: s.minute,
          }))}
          platforms={connectedPlatforms}
        />
      )}
    </div>
  )
}
