# Phase 7: Analytics Collection + Dashboard + Polish - Research

**Researched:** 2026-03-18
**Domain:** Analytics data collection, engagement scoring, SQLite aggregation queries, Next.js dashboard pages
**Confidence:** HIGH

## Summary

Phase 7 closes out Milestone 1 by wiring real data into the dashboard and adding an analytics collection cron. The project already has a fully built foundation: cron infrastructure (`cron.ts`), the `activityLog` table, the Upload-Post API client (`upload-post.ts`), and an established pattern for server-component pages that query SQLite directly via drizzle-orm.

The Upload-Post API provides **post-level analytics** via `GET /api/uploadposts/post-analytics/{request_id}`, returning per-platform `post_metrics` (views, likes, comments, shares). This is the primary data source. The `postPlatforms.requestId` column is already populated during publishing, making the lookup straightforward. Analytics should only be collected on posts that are 48h+ old (data needs time to stabilize — this is a stated project requirement).

The dashboard pages (cross-brand home, brand home, activity log) are currently stub/placeholder implementations. They need to be replaced with real queries. All three pages are server components that query SQLite directly — no new API routes are needed. The weekly digest data for `DASH-05` is derived from existing tables (posts published this week, total engagement, top performer).

**Primary recommendation:** Add a `postAnalytics` table to store collected metrics, wire a collect-analytics cron at 6h intervals, implement engagement score and percentile classification per brand per platform, then replace placeholder dashboard pages with server components running drizzle aggregate queries.

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | Type-safe SQLite queries + schema migration | Already used in all phases |
| drizzle-kit | 0.31.9 | Migration generation | Already used in all phases |
| node-cron | already registered | Cron scheduling | Already in `cron.ts` singleton |

### Supporting (already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | installed | Icons for dashboard stats | Trend arrows, status badges |
| @/components/ui/* (shadcn) | installed | Card, Badge, Table, Separator | All dashboard UI components |

### No New Dependencies Required
All libraries needed for Phase 7 are already installed. Analytics collection is a pure server-side cron + SQLite operation. Dashboard pages are pure server components with drizzle queries. No charting library is needed (charts are v2, ANLY-ENG-03 is explicitly deferred).

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── lib/
│   └── collect-analytics.ts     # New: cron worker, calls Upload-Post, writes postAnalytics
├── db/
│   ├── schema.ts                 # Add postAnalytics table
│   └── migrations/
│       └── 0007_analytics.sql    # New migration for postAnalytics table
├── app/
│   └── (dashboard)/
│       ├── page.tsx              # Replace stub with real brand cards + weekly digest
│       ├── activity/
│       │   └── page.tsx          # New: activity log page
│       └── brands/
│           └── [id]/
│               └── analytics/
│                   └── page.tsx  # New: per-brand analytics page
```

### Pattern 1: postAnalytics Schema Design
**What:** New table stores one row per postPlatform per collection run.
**When to use:** Each 6h cron tick fetches metrics and upserts by (postId, platform).

```typescript
// In schema.ts
export const postAnalytics = sqliteTable('post_analytics', {
  id:              integer().primaryKey({ autoIncrement: true }),
  postId:          integer('post_id').notNull().references(() => posts.id),
  platform:        text().notNull(),
  views:           integer(),
  likes:           integer(),
  comments:        integer(),
  shares:          integer(),
  engagementScore: integer('engagement_score'),       // computed, stored for queries
  performerTier:   text('performer_tier', {           // 'top' | 'average' | 'under'
    enum: ['top', 'average', 'under'],
  }),
  collectedAt:     text('collected_at').notNull(),
  createdAt:       text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})
```

One row per (postId, platform) — upsert on repeated collection. The `engagementScore` and `performerTier` columns are computed and stored so dashboard queries are simple SELECTs without re-computation.

### Pattern 2: Normalized Engagement Score Calculation (ANLY-02)
**What:** Normalize engagement across platforms with impressions=0 guard.
**Why:** Raw likes mean different things on different platforms with different reach.

```typescript
// In collect-analytics.ts
function calcEngagementScore(metrics: {
  views: number
  likes: number
  comments: number
  shares: number
}): number {
  const impressions = metrics.views ?? 0
  if (impressions === 0) return 0  // Guard: avoid division by zero

  // Weighted engagement: comments > shares > likes
  const weighted = (metrics.likes * 1) + (metrics.comments * 3) + (metrics.shares * 2)
  // Score 0-100 (capped)
  return Math.min(100, Math.round((weighted / impressions) * 1000))
}
```

### Pattern 3: Percentile Classification per Brand per Platform (ANLY-03)
**What:** After computing scores, classify posts relative to peers (same brand + platform).
**How:** SQLite window functions or a two-pass approach: compute all scores, find 25th/75th percentiles, update tiers.

```typescript
// Two-pass approach (simpler than SQLite window functions):
// 1. Fetch all engagement scores for brand+platform
// 2. Sort, find p25 and p75 thresholds
// 3. UPDATE postAnalytics SET performerTier = ... WHERE ...
function classifyTier(score: number, p25: number, p75: number): 'top' | 'average' | 'under' {
  if (score > p75) return 'top'
  if (score < p25) return 'under'
  return 'average'
}
```

Minimum viable: at least 4 posts in the cohort before classifying (otherwise all are 'average').

### Pattern 4: Cron Worker Structure (ANLY-01)
**What:** Every 6h, find published posts with `publishedAt` older than 48h that have no analytics row or stale analytics, fetch from Upload-Post, upsert.

```typescript
// In collect-analytics.ts
export async function collectAnalytics(): Promise<void> {
  const g = globalThis as Record<string, unknown>
  if (g.__analyticsRunning) return
  g.__analyticsRunning = true
  try {
    // 1. Find eligible posts: published, publishedAt <= now-48h
    // 2. For each, call GET /api/uploadposts/post-analytics/{requestId}
    // 3. Upsert postAnalytics row
    // 4. Reclassify tiers for affected brand+platform cohorts
  } finally {
    g.__analyticsRunning = false
  }
}
```

Register in `cron.ts` with `'0 */6 * * *'` (every 6 hours).

### Pattern 5: Dashboard Pages as Server Components
**What:** All dashboard pages follow the same pattern already established: async server components that call `getDb()` directly.
**Example from existing codebase:** `src/app/(dashboard)/brands/page.tsx`

```typescript
// Same pattern as brands/page.tsx
export default async function HomePage() {
  const db = getDb()
  const allBrands = await db.select().from(brands).all()
  // ... aggregate queries for stats
  return <div>...</div>
}
```

No client components needed unless interactivity (filters) is required. Activity log filters can be handled via URL searchParams (server-side).

### Pattern 6: Weekly Digest Data (DASH-05)
**What:** Last 7 days of published posts + engagement totals. Query spans `posts` and `postAnalytics` joined.

```typescript
const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
const weeklyPosts = db
  .select({ count: count() })
  .from(posts)
  .where(and(eq(posts.status, 'published'), gte(posts.publishedAt!, weekAgo)))
  .get()
```

### Anti-Patterns to Avoid
- **Don't re-classify tiers on every dashboard page load:** Classification is CPU-intensive. Do it once in the cron after collection, store `performerTier` in the table.
- **Don't fetch analytics inline in dashboard routes:** The Upload-Post API call belongs in the cron, not in page render.
- **Don't use impressions=0 posts in percentile calculations:** They have artificially low scores that distort the distribution.
- **Don't paginate activity log with client-side state:** Use URL searchParams for filters — it keeps the page a server component.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Percentile calculation | Custom sorting algorithm | Simple JS sort + index math | It's 3 lines. `scores.sort(); p25 = scores[Math.floor(scores.length * 0.25)]` |
| Cron scheduling | Custom setInterval | node-cron (already registered) | Already used for 4 other crons |
| API error handling | Custom retry logic | Wrap in circuit breaker pattern (already exists in `circuit-breaker.ts`) | Already established pattern |

**Key insight:** This phase is primarily wiring together already-built infrastructure. The cron, DB, Upload-Post client, and UI component library are all already working.

## Common Pitfalls

### Pitfall 1: Upload-Post Post-Analytics Requires requestId
**What goes wrong:** Analytics cron iterates `posts` table but `requestId` is stored on `postPlatforms`, not `posts`. Wrong join target.
**Why it happens:** The publish flow stores `requestId` on `postPlatforms` (per-platform per-publish attempt), not on the parent `posts` row.
**How to avoid:** Join `posts` with `postPlatforms` to get `postPlatforms.requestId` before calling the API. Query: `postPlatforms` WHERE `status='published'` AND `requestId IS NOT NULL`.
**Warning signs:** 404 errors from the analytics endpoint when `requestId` is null.

### Pitfall 2: No requestId = No Analytics
**What goes wrong:** Posts published before `requestId` was populated (or where Upload-Post didn't return one) have `requestId = null`. Calling `/post-analytics/null` will 404.
**Why it happens:** `publishTextPost` returns `request_id` only if Upload-Post includes it in the response.
**How to avoid:** Guard with `if (!platform.requestId) continue` in the cron. Log a warn to activityLog. Mark the postAnalytics row with a sentinel (or simply skip and never collect).

### Pitfall 3: Division by Zero in Engagement Score (ANLY-02 explicit requirement)
**What goes wrong:** `engagement_rate = (likes + comments) / views` throws or returns Infinity when `views = 0`.
**Why it happens:** New posts, or platforms that don't return view counts (some Reddit/LinkedIn responses).
**How to avoid:** Always guard: `if (views === 0) return 0`. This is explicitly called out in ANLY-02.

### Pitfall 4: Percentile Cohort Too Small
**What goes wrong:** With 1-3 posts per brand per platform, percentiles are meaningless. p75 == p25 == only value.
**Why it happens:** Fresh installation with few posts.
**How to avoid:** If cohort has fewer than 4 posts, set `performerTier = 'average'` for all. Document this behavior.

### Pitfall 5: Activity Log Page Route Conflict
**What goes wrong:** The sidebar already links to `/activity` but the page doesn't exist yet — it 404s in production.
**Why it happens:** The `navItems` array in `app-sidebar.tsx` includes `{ href: '/activity', ... }` but the route was never created.
**How to avoid:** Create `src/app/(dashboard)/activity/page.tsx` as part of this phase. Also `src/app/(dashboard)/brands/[id]/analytics/page.tsx`.

### Pitfall 6: Drizzle Migration Lineage
**What goes wrong:** New migration added without correct `prevId` linkage causes drizzle-kit to fail.
**Why it happens:** Happened in Phase 04, 06 — manually adding snapshots resolves it.
**How to avoid:** Run `npx drizzle-kit generate` normally. If lineage error appears, inspect the `meta/` directory and manually create the `000N_snapshot.json` with correct `prevId`. This is a known project pattern (see STATE.md Decisions).

### Pitfall 7: cron.ts Changes Require Restart
**What goes wrong:** Adding a new cron schedule to `cron.ts` doesn't take effect until the server restarts and the health endpoint is hit again (reinitializes `initCron()`).
**Why it happens:** The singleton guard `__cronRegistered` prevents re-registration after the first health hit.
**How to avoid:** Remember that in Railway, the cron will register on next cold start. For local dev: `Ctrl+C` and restart. The `__cronRegistered` flag prevents duplicates.

## Code Examples

### Analytics API Call
```typescript
// Source: https://docs.upload-post.com/llm.txt + openapi.json inspection
// GET /api/uploadposts/post-analytics/{request_id}
async function fetchPostAnalytics(requestId: string): Promise<PostAnalyticsResponse | null> {
  const res = await fetch(
    `https://api.upload-post.com/api/uploadposts/post-analytics/${requestId}`,
    { headers: { Authorization: `Apikey ${process.env.UPLOAD_POST_API_KEY}` } }
  )
  if (!res.ok) return null  // Non-fatal: log warn, continue
  return res.json()
}

// Response shape per platform:
// {
//   success: boolean,
//   platform_post_id: string,
//   post_url: string,
//   post_metrics: { views: number, likes: number, comments: number, shares: number },
//   post_metrics_source: 'platform_api',
//   post_metrics_error?: string,
// }
```

### Cron Registration (cron.ts addition)
```typescript
// ── 5. Collect analytics every 6 hours ───────────────────────────────────
cron.schedule('0 */6 * * *', async () => {
  try {
    const { collectAnalytics } = await import('./collect-analytics')
    await collectAnalytics()
  } catch (err) {
    console.error('[cron] collect-analytics failed:', err)
  }
})
```

### Dashboard Home Query Pattern
```typescript
// Cross-brand home: brand cards with post counts and engagement
const brandStats = await db
  .select({
    brandId: posts.brandId,
    publishedCount: count(),
  })
  .from(posts)
  .where(eq(posts.status, 'published'))
  .groupBy(posts.brandId)
  .all()
```

### Activity Log with URL SearchParam Filters
```typescript
// Server component — filters via URL searchParams
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; level?: string; type?: string }>
}) {
  const sp = await searchParams
  const db = getDb()

  const conditions = []
  if (sp.brand) conditions.push(eq(activityLog.brandId, parseInt(sp.brand)))
  if (sp.level) conditions.push(eq(activityLog.level, sp.level as 'info' | 'warn' | 'error'))
  if (sp.type)  conditions.push(eq(activityLog.type, sp.type))

  const logs = await db
    .select()
    .from(activityLog)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(activityLog.createdAt))
    .limit(200)
    .all()
  // ...
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Post analytics via polling status endpoint | Dedicated post-analytics endpoint | Upload-Post current API | Use `/post-analytics/{request_id}`, not `/status` |
| Impressions field | Instagram renamed to `views` | Upload-Post current API | Both `impressions` and `views` returned for compat; use `views ?? impressions` |

**Deprecated/outdated:**
- Using `/uploadposts/status` endpoint for analytics: This returns publish status, not engagement metrics. Use `/uploadposts/post-analytics/{request_id}` for post performance data.

## Open Questions

1. **Does Upload-Post return post-level analytics for all platforms?**
   - What we know: The `/post-analytics/{request_id}` endpoint exists per API spec. Returns `post_metrics` per platform with views/likes/comments/shares.
   - What's unclear: Some platforms (Reddit, LinkedIn) may return `post_metrics_error` instead of data. The `post_metrics_error` field in the response schema suggests this is expected.
   - Recommendation: Handle `post_metrics_error` gracefully — log as warn, skip analytics for that platform/post. Don't block the cron.

2. **Weekly digest definition for DASH-05**
   - What we know: DASH-05 says "Weekly digest data displayed on dashboard home." Requirements list it without specifying exact fields.
   - What's unclear: Is this posts published this week, or engagement from this week?
   - Recommendation: Show both: published count this week + avg engagement score this week. Simple counts from existing tables.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected (no jest.config, vitest.config, pytest.ini) |
| Config file | None — see Wave 0 |
| Quick run command | `npx tsx src/lib/collect-analytics.ts` (manual smoke) |
| Full suite command | N/A — no test framework installed |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ANLY-01 | Collect-analytics cron fires every 6h, fetches metrics for posts 48h+ old | manual smoke | hit `/api/health`, check activityLog | ❌ Wave 0 |
| ANLY-02 | Engagement score calculated with impressions=0 guard | unit | `npx tsx scripts/validate-analytics.ts` | ❌ Wave 0 |
| ANLY-03 | Posts classified as top/average/under per brand per platform | unit | same script | ❌ Wave 0 |
| ANLY-04 | Per-brand analytics page renders with real data | smoke | manual browser check | manual-only |
| DASH-01 | Cross-brand home renders brand cards with stats | smoke | manual browser check | manual-only |
| DASH-02 | Brand home page renders quick stats + recent posts | smoke | manual browser check | manual-only |
| DASH-03 | Activity log scrollable, filterable, errors highlighted | smoke | manual browser check | manual-only |
| DASH-05 | Weekly digest data on dashboard home | smoke | manual browser check | manual-only |

### Sampling Rate
- **Per task commit:** Manual: view pages in browser, check activityLog for cron entries
- **Per wave merge:** All dashboard pages load without error; cron registered at `/api/health`
- **Phase gate:** All pages render real data; cron registered; engagement scores stored in DB

### Wave 0 Gaps
- [ ] `scripts/validate-analytics.ts` — unit tests for `calcEngagementScore()` and `classifyTier()` — covers ANLY-02, ANLY-03
- [ ] No test framework installed — validation script uses `npx tsx` directly (existing pattern in project)

*(Validation scripts use `npx tsx` — consistent with the project's existing validation approach established in STATE.md: "tsx validation scripts need async main() wrapper")*

## Sources

### Primary (HIGH confidence)
- Upload-Post OpenAPI spec (https://docs.upload-post.com/openapi.json) — endpoint paths, parameters
- Upload-Post llm.txt (https://docs.upload-post.com/llm.txt) — analytics response schema, field names
- Project codebase (src/db/schema.ts, src/lib/cron.ts, src/lib/publish.ts) — existing patterns

### Secondary (MEDIUM confidence)
- Upload-Post docs landing (https://docs.upload-post.com/) — confirms analytics feature availability
- Existing phase implementations (auto-generate.ts, feed-poll.ts) — cron worker pattern with mutex

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all libraries already confirmed working
- Architecture: HIGH — Upload-Post analytics endpoint confirmed, pattern matches existing codebase
- Pitfalls: HIGH — requestId null case confirmed by examining schema + publish.ts; division by zero explicitly called out in ANLY-02 requirement

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable; Upload-Post API schema unlikely to change)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ANLY-01 | Collect-analytics cron (every 6 hours) fetches metrics from Upload-Post | `GET /uploadposts/post-analytics/{request_id}` confirmed; cron pattern established in `cron.ts` |
| ANLY-02 | Calculate normalized engagement score per post (guard impressions=0) | Score formula documented; impressions=0 guard is explicit requirement — pattern provided |
| ANLY-03 | Classify posts as top performer (>75th), average, or underperformer (<25th) | Two-pass percentile classification pattern documented; cohort minimum size pitfall flagged |
| ANLY-04 | Per-brand analytics page showing posts published and basic engagement metrics | Route: `/brands/[id]/analytics/page.tsx`; server component with drizzle join on postAnalytics |
| DASH-01 | Cross-brand home page: brand cards with stats, engagement trend, next scheduled post | Replaces current stub `page.tsx`; aggregate query patterns documented |
| DASH-02 | Brand home page: quick stats, recent posts with status + engagement | Route already exists (`/brands/[id]/page.tsx`); add analytics section to existing page |
| DASH-03 | Activity log page: scrollable, filterable by brand/type/level, errors highlighted | New route `/activity/page.tsx`; sidebar already links to it (currently 404s); URL searchParam filter pattern documented |
| DASH-05 | Weekly digest data displayed on dashboard home | Derived from existing `posts` table; week-ago timestamp filter pattern documented |
</phase_requirements>
