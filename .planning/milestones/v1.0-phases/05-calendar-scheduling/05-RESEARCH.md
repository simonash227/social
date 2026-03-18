# Phase 5: Calendar + Scheduling - Research

**Researched:** 2026-03-18
**Domain:** Calendar UI (FullCalendar), drag-and-drop scheduling, cron-based auto-publish, Upload-Post text publishing API
**Confidence:** HIGH

---

## Summary

Phase 5 builds on the existing post schema (`posts.scheduledAt`, `postPlatforms`) to add calendar visualization and auto-publishing. The `posts` table already has `scheduled_at` and `status` columns. `postPlatforms` already tracks per-platform `status`, `failureCount`, and `requestId`. No major schema additions are strictly required—only a new `schedulingSlots` table for SCHED-04 (configurable posting times per brand/platform) and a `retryAt` column for SCHED-07.

FullCalendar v6.1.20 is the clear library choice: it supports React 19, handles CSS injection internally (no global CSS import needed), provides week and month views out of the box via plugins, and has a clean `eventDrop` callback for updating `scheduled_at`. The Upload-Post API has a dedicated `POST /api/upload_text` endpoint for text-only content with a `scheduled_date` ISO-8601 field—but the project publishes immediately from the cron (we own the scheduling, not Upload-Post).

The auto-publish cron follows the same pattern already in `src/lib/cron.ts`: add a `'* * * * *'` (every minute) schedule inside `initCron()`, query posts with `status='scheduled'` and `scheduled_at <= now`, call Upload-Post per platform, update `postPlatforms.status` to `published` or increment `failureCount`, and flip `posts.status` to `failed` when `failureCount >= 3`.

**Primary recommendation:** Use FullCalendar v6 (`@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`) for the calendar UI; extend `initCron()` with the publish cron; add a `scheduling_slots` table for configurable time slots.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCHED-01 | Week and month calendar views showing scheduled and published posts | FullCalendar dayGrid + timeGrid plugins; query posts JOIN postPlatforms for event data |
| SCHED-02 | Drag-and-drop rescheduling of posts | FullCalendar `editable=true` + `interactionPlugin` + `eventDrop` callback updates `posts.scheduled_at` via server action |
| SCHED-03 | Platform color coding, content type icons, status indicators on calendar | FullCalendar `eventContent` render prop for custom event rendering; color map per platform |
| SCHED-04 | Slot-based scheduling with configurable posting times per brand per platform | New `scheduling_slots` table: `(brandId, platform, hour, minute)`; "schedule to next slot" action applies jitter |
| SCHED-05 | Timing jitter (±15 min random offset) on all scheduled posts | `Math.random() * 30 - 15` minutes in JS when computing `scheduled_at`; applied at schedule-time |
| SCHED-06 | Auto-publish cron job runs every 1 min, publishes via Upload-Post | Extend `initCron()` with `cron.schedule('* * * * *', ...)` pattern already in use |
| SCHED-07 | Publish retry logic: 3 retries with 5 min backoff, then status=failed | `postPlatforms.failureCount >= 3` → set `posts.status = 'failed'`; `retryAt` column gates re-attempts |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @fullcalendar/react | 6.1.20 | React adapter for FullCalendar | Officially supported React connector; peer deps include React 19 |
| @fullcalendar/core | 6.1.20 | FullCalendar engine | Required peer dep of all FC packages |
| @fullcalendar/daygrid | 6.1.20 | Month view (`dayGridMonth`) | Ships with FC; zero config for standard month grid |
| @fullcalendar/timegrid | 6.1.20 | Week view (`timeGridWeek`) | Ships with FC; shows hourly time slots |
| @fullcalendar/interaction | 6.1.20 | Drag-and-drop support | Required for `editable` events; adds `eventDrop` callback |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-cron | 3.0.3 | Cron scheduling | Already in project; add `'* * * * *'` schedule to `initCron()` |
| drizzle-orm | 0.45.1 | DB queries for scheduling | Already in project; use for `lt(posts.scheduledAt, now)` queries |
| lucide-react | 0.577.0 | Platform icons + status indicators | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| FullCalendar | react-big-calendar | react-big-calendar has React 19 JSX transform warning (issue #2785); FullCalendar v6 explicitly lists `^19` as peer dep |
| FullCalendar | @dnd-kit/core + custom grid | dnd-kit is great for lists/kanban but building a full week/month grid is significant hand-roll work |
| Upload-Post for scheduling | Post immediately from cron | Project owns scheduling logic; Upload-Post `scheduled_date` field is not used—we call Upload-Post when the cron fires |

**Installation:**
```bash
npm install @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── (dashboard)/
│       └── calendar/
│           ├── page.tsx              # Server component: fetch posts + brands
│           └── calendar-view.tsx     # 'use client': FullCalendar wrapper
├── app/actions/
│   └── schedule.ts                   # Server actions: schedulePost, reschedulePost, getSchedulingSlots
├── lib/
│   └── cron.ts                       # Extended: add publish-cron + publishDuePosts helper
│   └── publish.ts                    # New: Upload-Post publish logic + retry handler
└── db/
    └── schema.ts                     # Extended: schedulingSlots table, retryAt on postPlatforms
```

### Pattern 1: FullCalendar in Next.js App Router

**What:** FullCalendar v6 injects its own CSS via JavaScript—no CSS file import needed in `globals.css`. The calendar component must be a client component.

**When to use:** Any interactive calendar with drag-and-drop.

```typescript
// Source: https://fullcalendar.io/docs/react
'use client'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventDropArg } from '@fullcalendar/core'

interface CalendarEvent {
  id: string
  title: string
  start: string  // ISO-8601
  color?: string
  extendedProps?: Record<string, unknown>
}

export function CalendarView({ events }: { events: CalendarEvent[] }) {
  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
      initialView="dayGridMonth"
      headerToolbar={{
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek',
      }}
      events={events}
      editable={true}
      eventDrop={handleEventDrop}
    />
  )

  function handleEventDrop(info: EventDropArg) {
    const postId = parseInt(info.event.id, 10)
    const newStart = info.event.start
    if (!newStart) { info.revert(); return }
    // Call server action to update scheduled_at
    reschedulePost(postId, newStart.toISOString())
      .catch(() => info.revert())
  }
}
```

### Pattern 2: Auto-Publish Cron (extending initCron)

**What:** Add a `'* * * * *'` schedule inside the existing `initCron()` singleton in `src/lib/cron.ts`.

**When to use:** Every minute; fetches posts with `scheduled_at <= now` and `status='scheduled'`.

```typescript
// Source: existing cron.ts pattern in this project
cron.schedule('* * * * *', async () => {
  try {
    const { publishDuePosts } = await import('./publish')
    await publishDuePosts()
  } catch (err) {
    console.error('[cron] auto-publish failed:', err)
  }
})
```

### Pattern 3: Retry Logic with 5-Minute Backoff

**What:** `postPlatforms.failureCount` and `postPlatforms.retryAt` gate re-attempts. Cron skips platforms where `retryAt > now`.

```typescript
// publish.ts pattern
async function attemptPlatformPublish(platform: PostPlatformRow): Promise<void> {
  try {
    const result = await callUploadPostText(platform)
    // success: update status = 'published', requestId
  } catch (err) {
    const newCount = platform.failureCount + 1
    const retryAt = newCount < 3
      ? new Date(Date.now() + 5 * 60 * 1000).toISOString()  // +5 min
      : null
    const newStatus = newCount >= 3 ? 'failed' : 'pending'
    // update postPlatforms SET failureCount, retryAt, status
    if (newCount >= 3) {
      // check if all platforms for this post failed -> set posts.status = 'failed'
    }
  }
}
```

### Pattern 4: Upload-Post Text Publishing

**What:** Call `POST /api/upload_text` with the user (Upload-Post username), platform array, title (post content), and optional metadata.

```typescript
// upload-post.ts extension
export async function publishTextPost(params: {
  uploadPostUsername: string
  platforms: string[]
  content: string
  requestId: string
}): Promise<{ success: boolean; results: Record<string, unknown> }> {
  return getBreaker('upload-post').call(async () => {
    const body = new URLSearchParams()
    body.append('user', params.uploadPostUsername)
    params.platforms.forEach(p => body.append('platform[]', p))
    body.append('title', params.content)
    // NOTE: We do NOT pass scheduled_date — publish immediately

    const res = await fetch('https://api.upload-post.com/api/upload_text', {
      method: 'POST',
      headers: { Authorization: `Apikey ${getApiKey()}` },
      body,
    })
    if (!res.ok) throw new Error(`Upload-Post error: ${res.status}`)
    return res.json()
  })
}
```

Note: The Upload-Post API uses `multipart/form-data` or `application/x-www-form-urlencoded` (platform[] array syntax). Check the OpenAPI spec at `https://docs.upload-post.com/openapi.json` to confirm exact content-type. The existing `upload-post.ts` uses `Authorization: Apikey` header—same auth model.

### Pattern 5: Slot-Based Scheduling

**What:** `scheduling_slots` table stores `(brandId, platform, hour, minute)` as allowed posting times. When scheduling a post, find the next available slot after now, apply ±15 min jitter.

```typescript
// schedule.ts action
function computeScheduledAt(slots: SlotRow[], afterTime: Date): string {
  const jitterMs = (Math.random() * 30 - 15) * 60 * 1000  // ±15 min in ms
  const nextSlot = findNextSlot(slots, afterTime)
  return new Date(nextSlot.getTime() + jitterMs).toISOString()
}
```

### Anti-Patterns to Avoid
- **Passing `scheduled_date` to Upload-Post:** The project owns scheduling—Upload-Post should publish immediately when called by the cron. Do not delegate scheduling to Upload-Post.
- **Importing FullCalendar in a Server Component:** FullCalendar requires browser APIs. Always mark the calendar wrapper with `'use client'`.
- **Re-registering cron on every request:** The existing `__cronRegistered` singleton guard in `initCron()` already prevents this. Do not bypass it.
- **Blocking the cron with synchronous DB calls:** `publishDuePosts` should be async and catch per-platform errors individually so one failure does not stop others.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Calendar week/month grid | Custom date grid with divs | FullCalendar | Handles DST, locale, time zones, overflow, responsive layout |
| Drag-and-drop date change | Mouse event tracking | FullCalendar interactionPlugin | Handles edge cases: snap-to-slot, revert on cancel, touch |
| Cron job scheduling | setInterval or setTimeout | node-cron (already installed) | node-cron persists across Next.js hot reload with the singleton guard |

**Key insight:** FullCalendar ships as one cohesive system—mixing custom drag logic with a calendar grid library creates visual inconsistencies and accessibility gaps.

---

## Common Pitfalls

### Pitfall 1: FullCalendar CSS Not Applied
**What goes wrong:** Calendar renders with no styling—raw HTML list of events.
**Why it happens:** Attempting to import FullCalendar CSS from `node_modules` in old Next.js versions used to throw "Global CSS cannot be imported from within node_modules."
**How to avoid:** FullCalendar v6 injects CSS via JS—do NOT add any CSS import. No `globals.css` entry needed.
**Warning signs:** Unstyled calendar output; check for missing FC CSS import.

### Pitfall 2: FullCalendar in Server Component
**What goes wrong:** `ReferenceError: window is not defined` at build time.
**Why it happens:** FullCalendar accesses `window` and DOM APIs on import.
**How to avoid:** Wrap the calendar in a client component with `'use client'` at the top. The server page fetches data and passes events as a serializable prop.
**Warning signs:** Build error mentioning `window`, `document`, or `requestAnimationFrame`.

### Pitfall 3: Duplicate Cron Registration on Railway Redeploy
**What goes wrong:** Two cron jobs run concurrently, doubling publish attempts.
**Why it happens:** Railway may restart the process; if `initCron` is called on every health check without the singleton guard it re-registers.
**How to avoid:** The `__cronRegistered` globalThis guard already prevents this. Ensure the new publish cron is added INSIDE `initCron()` before the guard sets the flag—not called from elsewhere.
**Warning signs:** Posts published twice; duplicate `activityLog` entries.

### Pitfall 4: Race Condition in Publish Cron
**What goes wrong:** Two cron ticks overlap and both pick up the same posts.
**Why it happens:** If `publishDuePosts()` takes longer than 60 seconds, the next cron tick starts while the previous one is still running.
**How to avoid:** Use an in-memory mutex flag (`__publishRunning` on `globalThis`) to skip the cron tick if previous run is in progress.
**Warning signs:** Duplicate publish errors; `failureCount` incrementing unexpectedly.

### Pitfall 5: Upload-Post `platform[]` Array Encoding
**What goes wrong:** Only the first platform is published; others are silently dropped.
**Why it happens:** The Upload-Post API expects `platform[]` as repeated form fields (PHP/multipart style). JSON body sends an array at a different key.
**How to avoid:** Use `URLSearchParams` with repeated `.append('platform[]', value)` calls, or `multipart/form-data`. Verify against the OpenAPI spec.
**Warning signs:** Only one platform shows in Upload-Post response `results` object.

### Pitfall 6: postPlatforms status vs posts status Out of Sync
**What goes wrong:** A post shows `status='published'` on the calendar when one platform actually failed.
**Why it happens:** Updating `posts.status` too eagerly before checking all `postPlatforms`.
**How to avoid:** Set `posts.status = 'published'` only when ALL platforms in `postPlatforms` for that post have `status='published'`. If any are still pending/failed, keep `posts.status = 'scheduled'` or `'failed'` appropriately.
**Warning signs:** Calendar shows published posts that Upload-Post reports as failed.

---

## Code Examples

### Fetch Posts for Calendar (Server Component)
```typescript
// page.tsx (server component) — fetch scheduled + published posts
import { getDb } from '@/db'
import { posts, postPlatforms } from '@/db/schema'
import { inArray } from 'drizzle-orm'

const db = getDb()
const rows = db
  .select({
    id: posts.id,
    content: posts.content,
    status: posts.status,
    scheduledAt: posts.scheduledAt,
    publishedAt: posts.publishedAt,
    brandId: posts.brandId,
  })
  .from(posts)
  .where(inArray(posts.status, ['scheduled', 'published']))
  .all()
```

### reschedulePost Server Action
```typescript
'use server'
import { getDb } from '@/db'
import { posts } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function reschedulePost(postId: number, newScheduledAt: string) {
  const db = getDb()
  db.update(posts)
    .set({ scheduledAt: newScheduledAt, updatedAt: new Date().toISOString() })
    .where(eq(posts.id, postId))
    .run()
}
```

### Platform Color Map
```typescript
// Source: project convention (lucide-react already used for icons)
export const PLATFORM_COLORS: Record<string, string> = {
  x:         '#000000',
  twitter:   '#000000',
  instagram: '#E1306C',
  linkedin:  '#0077B5',
  tiktok:    '#010101',
  facebook:  '#1877F2',
  threads:   '#000000',
  reddit:    '#FF4500',
  bluesky:   '#0085FF',
}
```

### Scheduling Slot DB Schema
```typescript
// schema.ts addition
export const schedulingSlots = sqliteTable('scheduling_slots', {
  id:        integer().primaryKey({ autoIncrement: true }),
  brandId:   integer('brand_id').notNull().references(() => brands.id),
  platform:  text().notNull(),
  hour:      integer().notNull(),    // 0-23
  minute:    integer().notNull(),    // 0-59
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})
```

### postPlatforms Schema Extension (retryAt)
```typescript
// Add to postPlatforms in schema.ts
retryAt: text('retry_at'),  // ISO-8601; null = eligible now
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Import FullCalendar CSS manually | v6 injects CSS via JS | FC v6 (2023) | No CSS import needed; resolves Next.js CSS-from-node_modules error |
| `react` peer dep declared as `^18` | FC 6.1.20 declares `^16.7 || ^17 || ^18 || ^19` | 2024-2025 | Safe to install with React 19 (confirmed via npm show) |
| Upload-Post had only video upload | Text post API at `/api/upload_text` added | 2024+ | Supports X, LinkedIn, Facebook, Threads, Reddit, Bluesky |

---

## Open Questions

1. **Upload-Post text API content-type**
   - What we know: Endpoint is `POST /api/upload_text`; uses `platform[]` array fields
   - What's unclear: Whether it accepts `application/x-www-form-urlencoded` or requires `multipart/form-data`
   - Recommendation: Fetch `https://docs.upload-post.com/openapi.json` during implementation to confirm. As fallback, `multipart/form-data` with `FormData` works for both.

2. **Upload-Post response `request_id` field**
   - What we know: The video upload API returns `request_id` for analytics matching (INFRA-05). The text upload API returns `job_id` for scheduled posts.
   - What's unclear: Whether synchronous text posts (no `scheduled_date`) return a `request_id` for analytics correlation.
   - Recommendation: Check Upload-Post response in Phase 7 (analytics). For now, store whatever ID field is returned in `postPlatforms.requestId`.

3. **FullCalendar dark mode**
   - What we know: Project uses dark mode only (`html className=dark`). FullCalendar v6 ships with a default light theme.
   - What's unclear: Whether FullCalendar v6 responds to CSS variables or needs a custom theme override.
   - Recommendation: Override FullCalendar CSS variables in `globals.css` using `.fc { --fc-border-color: ... }` etc. The FullCalendar CSS variable reference is at `https://fullcalendar.io/docs/css-customization`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected (no jest.config, vitest.config, pytest.ini in project) |
| Config file | None — Wave 0 must establish if desired |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHED-01 | Calendar page renders week/month views | manual | Human: visit `/calendar` in browser | N/A |
| SCHED-02 | Drag event updates `scheduled_at` in DB | manual | Human: drag event, verify DB update | N/A |
| SCHED-03 | Platform colors and status indicators visible | manual | Human: visual inspection | N/A |
| SCHED-04 | Slot config UI saves to `scheduling_slots` table | manual | Human: configure slots, verify save | N/A |
| SCHED-05 | Jitter applied (±15 min) to scheduled_at | manual | Human: schedule post, inspect `scheduled_at` offset | N/A |
| SCHED-06 | Publish cron fires every minute, calls Upload-Post | manual | Human: set `scheduled_at` to past, check activity log | N/A |
| SCHED-07 | After 3 failures, post status becomes 'failed' | manual | Human: use invalid account, verify failureCount progression | N/A |

### Wave 0 Gaps
- No test framework is present in the project; all verification is human-driven per the existing phase pattern (human verification plan at end of each phase).

*(Existing test infrastructure: None — project uses human verification plans as the quality gate.)*

---

## Sources

### Primary (HIGH confidence)
- npm show output (live) — `@fullcalendar/react` 6.1.20 peerDeps confirm React 19 support (`^16.7.0 || ^17 || ^18 || ^19`)
- `https://fullcalendar.io/docs/react` — React component setup, plugins list
- `https://fullcalendar.io/docs/eventDrop` — eventDrop callback signature and `info.event.start`
- `https://fullcalendar.io/docs/event-dragging-resizing` — `editable` setting, drag-and-drop docs
- `http://docs.upload-post.com/api/upload-text/` — Full request schema for `POST /api/upload_text`
- Project source: `src/lib/cron.ts`, `src/lib/upload-post.ts`, `src/db/schema.ts` — existing patterns

### Secondary (MEDIUM confidence)
- `https://fullcalendar.io/docs/upgrading-from-v5` — v6 CSS injection (no import needed)
- GitHub issue fullcalendar/fullcalendar-react #2785 — React 19 JSX transform warning in react-big-calendar (confirms FC v6 is better choice)

### Tertiary (LOW confidence)
- Upload-Post OpenAPI spec at `https://docs.upload-post.com/openapi.json` — not fetched; text API content-type unconfirmed
- FullCalendar dark mode CSS variable override — based on general FC CSS customization docs, not verified against project's Tailwind v4 setup

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm show confirms versions and React 19 compatibility
- Architecture: HIGH — based on existing project patterns (cron.ts, upload-post.ts, server actions)
- Pitfalls: HIGH for FC CSS/client component (documented FC v6 behavior); MEDIUM for Upload-Post encoding (unverified content-type)

**Research date:** 2026-03-18
**Valid until:** 2026-06-18 (FullCalendar releases infrequently; Upload-Post API stable)
