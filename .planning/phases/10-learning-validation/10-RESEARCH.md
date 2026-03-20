# Phase 10: Learning Validation - Research

**Researched:** 2026-03-20
**Domain:** A/B attribution, engagement analytics SQL, auto-deactivation cron, confidence scoring UI
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VALID-01 | Tag each generated post with which learnings were active during generation | `postAnalytics.activeLearningIds` column already exists in schema; generation pipeline already loads active learnings — need to write their IDs at post-save time |
| VALID-02 | A/B comparison: posts with learning vs posts without, per learning | SQL GROUP BY on JSON array membership; Drizzle `json_each()` or `LIKE` approach on `activeLearningIds`; average `engagementScore` for each group |
| VALID-03 | Auto-deactivate learnings that show no engagement lift after N posts | New cron (Wednesday 3am, clear of existing slots) queries per-learning A/B stats; deactivates if "with" group has < 20 posts AND no measurable lift |
| VALID-04 | Learning effectiveness summary on dashboard with confidence indicators | Extend existing `/brands/[id]/learnings` page UI; add per-learning stats panel and confidence badge (high/medium/low derived from post count + delta magnitude) |
</phase_requirements>

---

## Summary

Phase 10 closes the learning feedback loop that Phase 9 opened. Phase 9 generates learnings and injects them into prompts. Phase 10 answers: "Did those learnings actually help?"

The implementation has three distinct workstreams that build on each other. First, attribution tagging — when `generateContent()` runs and returns active learnings, those learning IDs must be persisted to `postAnalytics.activeLearningIds` so A/B attribution is possible later. Second, A/B comparison queries — given `activeLearningIds` is a JSON array column, computing per-learning average engagement requires either SQLite's `json_each()` virtual table or a Drizzle ORM approach using `LIKE '%[id]%'` pattern matching. Third, auto-deactivation — a new cron evaluates per-learning A/B stats and marks ineffective learnings inactive with reason `'auto_deactivated'`.

The core challenge in Phase 10 is the attribution gap. `generateContent()` returns `GenerationResult` to the caller (the generate page or `autoGenerate()`), but `activeLearningIds` must end up in `postAnalytics`. Currently `postAnalytics` rows are created much later — by `collectAnalytics()` when engagement data arrives (48h+ after publish). This means activeLearningIds cannot be written at collection time because the learnings active during generation are long gone. The solution is to write activeLearningIds at post-creation time: when a post is saved (in `saveGeneratedPosts()` or `saveAsAutoPost()`), the caller must pass the active learning IDs, and they must be pre-populated into the `postAnalytics` row (or stored on `posts` itself as a relay field) before engagement data arrives.

**Primary recommendation:** Store `activeLearningIds` on the `posts` table as a new column `postActiveLearningIds`, and copy it into `postAnalytics.activeLearningIds` at analytics collection time. This decouples the attribution from the timing of engagement collection and avoids changing the `postAnalytics` upsert logic significantly.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | All DB queries including A/B aggregation | Already in project |
| better-sqlite3 | 12.8.0 | Sync SQLite driver; JSON column queries | Already in project |
| node-cron | in project | Auto-deactivation cron registration | Already in project |

### No New Libraries Required

Phase 10 adds no npm dependencies. The A/B comparison is pure SQL/Drizzle. The UI uses existing shadcn/ui components (badges, cards, progress, tables). JSON array membership queries use SQLite's built-in `json_each()` virtual table.

**Installation:**
```bash
# No new packages
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `json_each()` for A/B query | `LIKE '%[id]%'` string match | LIKE is simpler to write in Drizzle but fragile — id=1 matches id=10,11. `json_each()` is correct but requires raw SQL. Recommendation: use `json_each()` for correctness. |
| New `posts.postActiveLearningIds` relay column | Pass IDs through return value chain | Return value chain requires changing function signatures across generate.ts, auto-generate.ts, and the generate page. A relay column on `posts` is simpler and doesn't break callers. |
| Wednesday 3am auto-deactivation cron | Piggyback on weekly learning cron | Auto-deactivation needs to run more often than weekly (learnings can accumulate data faster). Weekly is too slow for N=20 threshold. A separate mid-week cron at Wednesday 3am fits the existing schedule gaps. |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   └── learning-validator.ts     # NEW: computeLearningStats(), autoDeactivateLearnings()
├── app/
│   ├── actions/
│   │   ├── generate.ts           # MODIFIED: generateContent() returns activeLearningIds
│   │   └── learnings.ts          # MODIFIED: add getLearningEffectiveness() server action
│   └── (dashboard)/
│       └── brands/
│           └── [id]/
│               └── learnings/
│                   ├── page.tsx  # MODIFIED: pass effectiveness data to LearningsSection
│                   └── learnings-section.tsx  # MODIFIED: add A/B stats + confidence panel
└── db/
    └── schema.ts                  # MODIFIED: add postActiveLearningIds column to posts table
```

### Pattern 1: Attribution Relay Column

**The problem:** `postAnalytics.activeLearningIds` needs to know which learnings were active at generation time. Generation and analytics collection are separated by 48h+. The active learnings loaded during generation are not available when `collectAnalytics()` runs.

**The solution:** Add `postActiveLearningIds` to the `posts` table (nullable JSON column, same type as `activeLearningIds`). Write it at post-creation time. Copy it to `postAnalytics.activeLearningIds` during analytics collection.

**Schema addition (posts table):**
```typescript
// In schema.ts, posts table, v2.0 section:
postActiveLearningIds: text('post_active_learning_ids', { mode: 'json' }).$type<number[] | null>(),
```

**Write at post-creation time (saveGeneratedPosts):**
```typescript
// In saveGeneratedPosts() in generate.ts, update the insert:
const postResult = db.insert(posts).values({
  brandId,
  sourceUrl: sourceUrl || null,
  sourceText: sourceText || null,
  content: primaryContent,
  status: 'draft',
  qualityScore: qualityData?.[platformKeys[0]]?.score ?? null,
  postActiveLearningIds: activeLearningIds ?? null,  // NEW
}).returning({ id: posts.id }).get()
```

**Copy to postAnalytics at collect time (collect-analytics.ts):**
```typescript
// When inserting or updating a postAnalytics row, also pull postActiveLearningIds from the post:
const postRow = db.select({ postActiveLearningIds: posts.postActiveLearningIds })
  .from(posts).where(eq(posts.id, ep.postId)).get()

// Then include in upsert:
activeLearningIds: postRow?.postActiveLearningIds ?? null,
```

**Write at auto-generate post-creation time (auto-generate.ts):**
```typescript
// saveAsAutoPost() needs activeLearningIds added to AutoPostInput interface and insert:
interface AutoPostInput {
  // ... existing fields ...
  activeLearningIds?: number[] | null  // NEW
}
```

**How `generateContent()` surfaces learning IDs to callers:**
```typescript
// GenerationResult gets a new optional field:
export interface GenerationResult {
  platforms: Record<string, { ... }>
  totalCostUsd: number
  activeLearningIds?: number[]  // NEW — IDs of learnings active during this generation
  error?: string
}

// In generateContent(), after loading learnings:
const learnings = brand.learningInjection ? loadLearnings(brandId, platforms[0]) : []
// ... generation pipeline ...
// In return result:
return { ...result, activeLearningIds: learnings.map(l => l.id) }
```

### Pattern 2: A/B Comparison SQL Query

**What:** For each learning, compute average engagement for posts "with" the learning (activeLearningIds contains learning ID) vs posts "without" (activeLearningIds does not contain the ID or is null).

**SQLite `json_each()` approach:**
```typescript
// In learning-validator.ts:
export interface LearningStats {
  learningId: number
  withCount: number        // posts generated with this learning active
  withAvgEngagement: number
  withoutCount: number     // posts generated without this learning
  withoutAvgEngagement: number
  engagementDelta: number  // withAvgEngagement - withoutAvgEngagement
  confidence: 'high' | 'medium' | 'low'
}

export function computeLearningStats(brandId: number, learningId: number): LearningStats {
  const db = getDb()

  // Posts WITH this learning active (activeLearningIds JSON array contains learningId)
  const withRows = db.all<{ engagementScore: number }>(sql`
    SELECT pa.engagement_score
    FROM post_analytics pa
    INNER JOIN posts p ON pa.post_id = p.id
    INNER JOIN json_each(pa.active_learning_ids) jl ON jl.value = ${learningId}
    WHERE p.brand_id = ${brandId}
      AND pa.engagement_score IS NOT NULL
  `)

  // Posts WITHOUT this learning (no activeLearningIds row, or null, or doesn't contain ID)
  const withoutRows = db.all<{ engagementScore: number }>(sql`
    SELECT pa.engagement_score
    FROM post_analytics pa
    INNER JOIN posts p ON pa.post_id = p.id
    WHERE p.brand_id = ${brandId}
      AND pa.engagement_score IS NOT NULL
      AND (
        pa.active_learning_ids IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM json_each(pa.active_learning_ids) jl WHERE jl.value = ${learningId}
        )
      )
  `)

  const withCount = withRows.length
  const withoutCount = withoutRows.length
  const withAvg = withCount > 0
    ? withRows.reduce((sum, r) => sum + r.engagementScore, 0) / withCount
    : 0
  const withoutAvg = withoutCount > 0
    ? withoutRows.reduce((sum, r) => sum + r.engagementScore, 0) / withoutCount
    : 0

  const delta = withAvg - withoutAvg

  // Confidence: high = 20+ posts in "with" group AND delta >= 5; medium = 10-19 OR delta 2-4; low = < 10 or delta < 2
  const confidence = deriveConfidence(withCount, Math.abs(delta))

  return {
    learningId,
    withCount,
    withAvgEngagement: Math.round(withAvg),
    withoutCount,
    withoutAvgEngagement: Math.round(withoutAvg),
    engagementDelta: Math.round(delta),
    confidence,
  }
}

function deriveConfidence(postCount: number, deltaMagnitude: number): 'high' | 'medium' | 'low' {
  if (postCount >= 20 && deltaMagnitude >= 5) return 'high'
  if (postCount >= 10 && deltaMagnitude >= 2) return 'medium'
  return 'low'
}
```

**Note on Drizzle raw SQL:** `db.all(sql`...`)` is how you run arbitrary SQL through Drizzle when `json_each()` isn't expressible with the query builder. The `sql` tagged template from `drizzle-orm` handles parameterization safely.

### Pattern 3: Auto-Deactivation Logic

**What:** `autoDeactivateLearnings()` queries all approved+active learnings, computes stats for each, and marks those meeting the deactivation criteria as inactive.

**Deactivation criteria (configurable, default threshold N=20):**
- "with" group has >= N posts (enough data to be statistically meaningful)
- `engagementDelta <= 0` (no measurable lift; equal or negative)

```typescript
// In learning-validator.ts:
export async function autoDeactivateLearnings(options?: { threshold?: number }): Promise<number> {
  const db = getDb()
  const threshold = options?.threshold ?? 20  // default 20 posts in "with" group
  const now = new Date().toISOString()

  // Get all active, approved learnings across all brands
  const activeLearnings = db.select({
    id: brandLearnings.id,
    brandId: brandLearnings.brandId,
  })
    .from(brandLearnings)
    .where(
      and(
        eq(brandLearnings.isActive, 1),
        eq(brandLearnings.status, 'approved')
      )
    )
    .all()

  let deactivatedCount = 0

  for (const learning of activeLearnings) {
    const stats = computeLearningStats(learning.brandId, learning.id)

    // Only auto-deactivate when we have enough "with" data AND no lift
    if (stats.withCount >= threshold && stats.engagementDelta <= 0) {
      db.update(brandLearnings)
        .set({
          isActive: 0,
          status: 'auto_deactivated',
          updatedAt: now,
        })
        .where(eq(brandLearnings.id, learning.id))
        .run()
      deactivatedCount++
      console.log(`[learning-validator] auto-deactivated learning ${learning.id} (delta=${stats.engagementDelta}, with=${stats.withCount})`)
    }
  }

  return deactivatedCount
}
```

**New `status` value:** `'auto_deactivated'` — the schema's `status` column is `text().notNull().default('pending')` with no enum constraint, so adding a new value requires no migration. The learnings dashboard must handle displaying this status.

### Pattern 4: Auto-Deactivation Cron Registration

**What:** New cron entry in `cron.ts`, Wednesday 3am. Runs mid-week to catch learnings that accumulate 20+ posts quickly.

```typescript
// In initCron(), after the Sunday learning engine cron (section 6):

// ── 7. Weekly learning validation (Wednesday 3:00 AM) ─────────────────────────
cron.schedule('0 3 * * 3', async () => {
  try {
    const { autoDeactivateLearnings } = await import('./learning-validator')
    await autoDeactivateLearnings()
  } catch (err) {
    console.error('[cron] learning-validator failed:', err)
  }
})
```

**Updated cron schedule map:**
```
* * * * *     → publishDuePosts      (every minute)
*/5 * * * *   → pollFeeds            (every 5 min)
*/15 * * * *  → autoGenerate         (every 15 min)
0 */6 * * *   → collectAnalytics     (every 6 hours: 0:00, 6:00, 12:00, 18:00)
0 0 * * *     → AI spend summary     (midnight — Mon through Sun)
0 3 * * *     → runDbBackup          (3am daily)
0 2 * * 0     → learningEngine       (Sunday 2am)
0 3 * * 3     → learningValidator    (Wednesday 3am) ← NEW
```

**Conflict check:** Wednesday 3am overlaps with the daily DB backup (`0 3 * * *`). These run concurrently. The backup is read-only (copies the .db file). The validator writes to `brandLearnings`. No write-write conflict — WAL mode + `busy_timeout = 5000` handles this safely.

### Pattern 5: Effectiveness Data in the Learnings Dashboard

**What:** Extend `/brands/[id]/learnings/page.tsx` to also fetch A/B stats for each learning. Pass stats to `LearningsSection`. Add a stats panel per learning row.

**Server-side data fetch in page.tsx:**
```typescript
// After loading `learnings`, compute stats for all active+approved learnings:
import { computeLearningStats } from '@/lib/learning-validator'

const effectivenessMap = new Map<number, LearningStats>()
for (const l of learnings) {
  if (l.status === 'approved' || l.status === 'auto_deactivated') {
    effectivenessMap.set(l.id, computeLearningStats(brandId, l.id))
  }
}

// Convert Map to plain object for passing to client component:
const effectiveness = Object.fromEntries(effectivenessMap)
```

**UI display pattern (inside learnings-section.tsx):**

Each learning row gains an "Effectiveness" sub-section showing:
- With: `{withCount} posts, avg engagement {withAvgEngagement}`
- Without: `{withoutCount} posts, avg engagement {withoutAvgEngagement}`
- Delta: `+{engagementDelta}` (green) or `-{N}` (red) or `0` (neutral)
- Confidence badge: `high` / `medium` / `low`

Confidence badge colors (using existing shadcn Badge component):
- `high` → green variant (`variant="default"` with Tailwind class)
- `medium` → amber/yellow
- `low` → grey (`variant="secondary"`)

Auto-deactivated learnings show a special `"Auto-deactivated"` badge in red with the reason. The existing "Rejected" hidden-by-default toggle should also hide auto-deactivated learnings.

### Pattern 6: Post Detail View — activeLearningIds Display

**What:** The VALID-01 success criterion requires that the active learning IDs are visible on the post detail page. The post detail lives at `/brands/[id]/page.tsx` (which shows recent posts) or a dedicated post view. Checking the codebase — there is no dedicated post detail page, but the brand analytics page shows per-post data.

**Recommendation:** Show `activeLearningIds` on the analytics page per-post row. Each post row that has `activeLearningIds` populated shows a small "Learnings used: [3]" indicator. Clicking/hovering reveals the learning IDs (and ideally their descriptions via a join).

Alternatively (simpler): add the activeLearningIds to the analytics page query and display as a count badge: "2 learnings active." This satisfies the success criterion without building a new dedicated route.

### Anti-Patterns to Avoid

- **Writing activeLearningIds to postAnalytics at collection time from fresh loadLearnings call:** The learnings active during generation != the learnings active when analytics are collected (days/weeks later). Must use the relay column from `posts.postActiveLearningIds`.
- **Using `LIKE '%1%'` for JSON array membership:** The string "1" matches IDs 1, 10, 11, 21, etc. Always use `json_each()` for correctness.
- **Auto-deactivating with too few posts:** If `withCount < threshold`, there is insufficient data. The validator must check `withCount >= threshold` before deactivating — never auto-deactivate based on 3 posts.
- **Deactivating learnings with `delta = 0` when withCount is 5:** False negatives at low sample sizes. Both conditions must hold: `withCount >= threshold AND delta <= 0`.
- **Making `computeLearningStats()` async when it doesn't need to be:** `getDb()` returns a sync connection (better-sqlite3). The `json_each()` queries are synchronous. Keep the function sync for simplicity, only the cron wrapper is async.
- **Forgetting the `abTestGroup` column already exists:** `brandLearnings.abTestGroup` was added in Phase 8 anticipating exactly this A/B use case. Phase 10 does NOT use this column for formal group assignment — the A/B split is implicit (posts with vs without the learning ID). The column can remain unused for now.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON array membership query | Custom JSON parsing in TypeScript | SQLite `json_each()` virtual table via `sql` template | Correct and efficient; SQLite handles it natively |
| Confidence scoring | Custom weighting algorithm | Simple threshold-based derive: `postCount >= 20 AND delta >= 5 → high` | Transparency matters; users understand simple rules |
| A/B randomization | Formal random group assignment | Implicit split: "was this learning active during generation?" | Formal randomization isn't possible retroactively; implicit is correct for this use case |
| Learning effectiveness cache | Module-level Map or Redis | Re-query on each page load (cheap for < 50 learnings per brand) | SQLite queries for 50 learnings take < 5ms; no cache needed |
| Status enum | TypeScript enum or Drizzle enum constraint | Text column (already unconstrained) + add `'auto_deactivated'` as a value | Schema already exists with no enum; adding a value requires no migration |

**Key insight:** The hardest part of Phase 10 is the attribution timing gap — everything else is straightforward SQL and UI work. Solve the relay column cleanly and the rest follows.

---

## Common Pitfalls

### Pitfall 1: The Attribution Timing Gap

**What goes wrong:** `generateContent()` loads active learnings, returns them in `GenerationResult`, but no code path ever saves those IDs. When `collectAnalytics()` runs 48h later, it tries to write `activeLearningIds` but has no way to know which learnings were active during generation. The column stays NULL for all posts. A/B comparison shows zero "with" posts for every learning.

**Why it happens:** Phase 9's `generateContent()` loads learnings for injection but doesn't save them alongside the post. The `saveGeneratedPosts()` call (which saves the post) doesn't receive learning IDs from `generateContent()`.

**How to avoid:**
1. Add `postActiveLearningIds` column to `posts` table (nullable JSON, migration required).
2. `generateContent()` must return `activeLearningIds: number[]` in `GenerationResult`.
3. The generate page (calling `generateContent`) must pass these IDs to `saveGeneratedPosts()`.
4. `saveAsAutoPost()` in auto-generate.ts must accept and save them.
5. `collectAnalytics()` must copy `posts.postActiveLearningIds` → `postAnalytics.activeLearningIds` during upsert.

**Warning signs:** `postAnalytics.activeLearningIds` is NULL for all rows even after generating posts with approved learnings.

---

### Pitfall 2: `json_each()` Not Supported via Drizzle Query Builder

**What goes wrong:** Drizzle's query builder does not expose SQLite's `json_each()` virtual table as a join target. Attempting to use `.innerJoin(json_each(postAnalytics.activeLearningIds))` fails at the TypeScript or runtime level.

**Why it happens:** Drizzle's type system knows about registered tables, not virtual tables.

**How to avoid:** Use the `sql` tagged template for the A/B queries. Drizzle's `db.all(sql`...`)` executes arbitrary SQL with safe parameterization:
```typescript
import { sql } from 'drizzle-orm'
const rows = db.all<{ engagementScore: number }>(sql`
  SELECT pa.engagement_score
  FROM post_analytics pa
  INNER JOIN posts p ON pa.post_id = p.id
  INNER JOIN json_each(pa.active_learning_ids) jl ON jl.value = ${learningId}
  WHERE p.brand_id = ${brandId} AND pa.engagement_score IS NOT NULL
`)
```

**Warning signs:** TypeScript errors on `json_each` table reference; runtime "no such table: json_each" errors (means SQLite version doesn't support JSON functions — SQLite 3.38+ required, but Node.js better-sqlite3 bundles modern SQLite).

---

### Pitfall 3: Deactivation Cron vs. Backup Cron Overlap

**What goes wrong:** Both the daily backup (`0 3 * * *`) and the new learning validator (`0 3 * * 3` — Wednesday 3am) fire simultaneously on Wednesday mornings. If the backup holds a SQLite write lock while copying the .db file, and the validator tries to write `brandLearnings` updates, `SQLITE_BUSY` errors occur and no learnings get deactivated.

**Why it happens:** WAL mode allows concurrent reads but still serializes writes. File-copy backup may briefly lock the file.

**How to avoid:** Shift the validator to Wednesday 3:30am (`30 3 * * 3`), which avoids the backup overlap. Alternatively, the existing `PRAGMA busy_timeout = 5000` on the DB connection should absorb a brief backup lock (backup typically completes in < 1 second for small DBs). The 5s timeout is the backstop. If the codebase's DB connection confirms `busy_timeout = 5000`, the risk is low.

**Recommended schedule:** `0 3 * * 3` with `busy_timeout = 5000` as safety net, since the backup reads the file and WAL handles concurrent access.

**Warning signs:** `database is locked` errors in logs Wednesday mornings; `brandLearnings` rows not being updated despite validator running.

---

### Pitfall 4: Auto-Deactivated Status Not Handled in UI

**What goes wrong:** The learnings dashboard checks `status === 'approved'` or `status === 'rejected'` for badge rendering. `'auto_deactivated'` is a new value. It falls into no existing case and renders a blank/default badge with no explanation. The user can't tell why a learning was deactivated.

**Why it happens:** The new status value was added in backend without updating the UI status display logic.

**How to avoid:** In `learnings-section.tsx`, add an explicit case for `'auto_deactivated'`:
- Badge label: "Auto-deactivated"
- Badge color: red (same as rejected) or amber
- Show alongside the A/B stats to explain WHY (low delta or no lift)
- Include in the "hidden by default" group with rejected learnings (toggle shows auto-deactivated too)

**Warning signs:** Learnings with `status='auto_deactivated'` showing no status badge; users confused about why learnings disappeared from active injection.

---

### Pitfall 5: saveGeneratedPosts Doesn't Return Learning IDs to Caller

**What goes wrong:** The generate page calls `generateContent()` (which returns learning IDs) and then `refineAndGate()` and then `saveGeneratedPosts()`. The learning IDs from `generateContent()` must survive through this call chain to reach `saveGeneratedPosts()`. If the generate page component doesn't thread the IDs through, they are lost.

**Why it happens:** `generateContent()` and `saveGeneratedPosts()` are separate server actions. The client has to maintain state between calls.

**How to avoid:**
1. `generateContent()` returns `activeLearningIds: number[]` in its result.
2. The generate page stores these in component state (or passes them through the form submission).
3. `saveGeneratedPosts()` gains a new optional parameter: `activeLearningIds?: number[]`.
4. `saveAsAutoPost()` (in auto-generate.ts which calls `generateContent()` directly) must also thread the IDs through.

**In `autoGenerate()`**, the flow is:
```typescript
const genResult = await generateContent(brandId, platforms, sourceText, sourceUrl)
// genResult.activeLearningIds is now available
const refined = await refineAndGate(brandId, genResult)
// Thread IDs to saveAsAutoPost:
saveAsAutoPost({ ..., activeLearningIds: genResult.activeLearningIds ?? null })
```

**Warning signs:** `posts.postActiveLearningIds` is NULL for auto-generated posts but populated for manually generated posts (or vice versa).

---

### Pitfall 6: Effectiveness Data Expensive for Large Learning Sets

**What goes wrong:** The learnings page runs `computeLearningStats()` for every approved/auto_deactivated learning. For a brand with 50 learnings and 500 posts, each stats computation runs 2 SQL queries with `json_each()` scans. 50 learnings × 2 queries = 100 SQL queries on page load.

**Why it happens:** The stats function is per-learning, not batch.

**How to avoid:** In practice, a single brand will have 5-20 learnings (Phase 9 limits each analysis run to 5). 20 learnings × 2 queries = 40 queries at < 1ms each = 40ms total — acceptable for a server component. If this becomes slow, a single aggregate query using `GROUP BY` over `json_each()` can replace the per-learning calls. For Phase 10, the per-learning approach is fine.

**Warning signs:** Learnings page taking > 500ms to load with many learnings; server component timeout logs.

---

## Code Examples

Verified patterns from direct codebase inspection:

### Migration Required — Posts Relay Column

```typescript
// schema.ts — add to posts table, v2.0 section (after isGoldenPinned):
postActiveLearningIds: text('post_active_learning_ids', { mode: 'json' }).$type<number[] | null>(),
```

Run `npx drizzle-kit generate` to produce the migration. The column is nullable with no default — all existing rows will have NULL, which is correct (pre-Phase-10 posts had no learning attribution).

### GenerationResult Extension

```typescript
// In generate.ts — extend the existing interface:
export interface GenerationResult {
  platforms: Record<string, {
    content: string
    hookVariants: Array<{ text: string; score: number }>
    winningHook: string
  }>
  totalCostUsd: number
  activeLearningIds?: number[]  // NEW: IDs of learnings that were active during generation
  error?: string
}

// At the end of generateContent(), before returning result:
return {
  ...result,
  activeLearningIds: learnings.map(l => l.id),  // learnings already computed at step 3.5
}
```

### saveGeneratedPosts Signature Extension

```typescript
// Updated signature in generate.ts:
export async function saveGeneratedPosts(
  brandId: number,
  platformContents: Record<string, string>,
  sourceText: string,
  sourceUrl: string,
  qualityData?: Record<string, { score: number; details: QualityDetails }>,
  activeLearningIds?: number[] | null   // NEW parameter
): Promise<{ error?: string }> {
  // ...
  const postResult = db.insert(posts).values({
    brandId,
    sourceUrl: sourceUrl || null,
    sourceText: sourceText || null,
    content: primaryContent,
    status: 'draft',
    qualityScore: qualityData?.[platformKeys[0]]?.score ?? null,
    qualityDetails: qualityData?.[platformKeys[0]]?.details ?? null,
    postActiveLearningIds: activeLearningIds ?? null,  // NEW
  }).returning({ id: posts.id }).get()
  // ...
}
```

### A/B Stats Computation (Full Function)

```typescript
// src/lib/learning-validator.ts

import { getDb } from '@/db'
import { brandLearnings, posts } from '@/db/schema'
import { eq, and, sql } from 'drizzle-orm'

export interface LearningStats {
  learningId: number
  withCount: number
  withAvgEngagement: number
  withoutCount: number
  withoutAvgEngagement: number
  engagementDelta: number
  confidence: 'high' | 'medium' | 'low'
}

function deriveConfidence(postCount: number, deltaMagnitude: number): 'high' | 'medium' | 'low' {
  if (postCount >= 20 && deltaMagnitude >= 5) return 'high'
  if (postCount >= 10 && deltaMagnitude >= 2) return 'medium'
  return 'low'
}

export function computeLearningStats(brandId: number, learningId: number): LearningStats {
  const db = getDb()

  type ScoreRow = { engagementScore: number }

  // Posts WITH this learning active
  const withRows = db.all<ScoreRow>(sql`
    SELECT pa.engagement_score AS "engagementScore"
    FROM post_analytics pa
    INNER JOIN posts p ON pa.post_id = p.id
    INNER JOIN json_each(pa.active_learning_ids) jl ON jl.value = ${learningId}
    WHERE p.brand_id = ${brandId}
      AND pa.engagement_score IS NOT NULL
  `)

  // Posts WITHOUT this learning active (or null activeLearningIds)
  const withoutRows = db.all<ScoreRow>(sql`
    SELECT pa.engagement_score AS "engagementScore"
    FROM post_analytics pa
    INNER JOIN posts p ON pa.post_id = p.id
    WHERE p.brand_id = ${brandId}
      AND pa.engagement_score IS NOT NULL
      AND (
        pa.active_learning_ids IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM json_each(pa.active_learning_ids) jl2 WHERE jl2.value = ${learningId}
        )
      )
  `)

  const withCount = withRows.length
  const withoutCount = withoutRows.length
  const withAvg = withCount > 0
    ? withRows.reduce((sum, r) => sum + r.engagementScore, 0) / withCount
    : 0
  const withoutAvg = withoutCount > 0
    ? withoutRows.reduce((sum, r) => sum + r.engagementScore, 0) / withoutCount
    : 0

  const delta = Math.round(withAvg - withoutAvg)

  return {
    learningId,
    withCount,
    withAvgEngagement: Math.round(withAvg),
    withoutCount,
    withoutAvgEngagement: Math.round(withoutAvg),
    engagementDelta: delta,
    confidence: deriveConfidence(withCount, Math.abs(delta)),
  }
}
```

### collect-analytics.ts — Copy activeLearningIds During Upsert

```typescript
// In collectAnalytics(), when inserting/updating postAnalytics,
// fetch the relay column from the posts row:

const postRow = db.select({ postActiveLearningIds: posts.postActiveLearningIds })
  .from(posts)
  .where(eq(posts.id, ep.postId))
  .get()

const activeLearningIds = postRow?.postActiveLearningIds ?? null

// Then include in the upsert:
if (existing) {
  await db.update(postAnalytics)
    .set({
      views: metrics.views ?? null,
      likes: metrics.likes ?? null,
      comments: metrics.comments ?? null,
      shares: metrics.shares ?? null,
      engagementScore,
      collectedAt: now,
      activeLearningIds,  // NEW — copy from relay column
    })
    .where(eq(postAnalytics.id, existing.id))
    .run()
} else {
  await db.insert(postAnalytics).values({
    postId: ep.postId,
    platform: ep.platform,
    views: metrics.views ?? null,
    likes: metrics.likes ?? null,
    comments: metrics.comments ?? null,
    shares: metrics.shares ?? null,
    engagementScore,
    collectedAt: now,
    createdAt: now,
    activeLearningIds,  // NEW — copy from relay column
  }).run()
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No attribution tracking | `activeLearningIds` in schema (Phase 8), populated by Phase 10 | Phase 10 | Enables true A/B validation of learning effectiveness |
| Manual deactivation only | Auto-deactivation when delta <= 0 after N posts | Phase 10 | Learnings that don't work are removed automatically |
| Confidence = "high/medium/low" set at creation by AI | Confidence recalculated from empirical A/B data | Phase 10 | AI-assigned confidence gives way to real-world signal |
| Learning engine runs weekly regardless of outcome | Learning engine + validator form a feedback loop | Phase 10 | Bad learnings exit the pool; good ones stay |

**Deprecated/outdated:**
- `brandLearnings.confidence` set by the AI during analysis (Phase 9): still written at creation time by the AI, but Phase 10 overrides the user-facing confidence display with empirical A/B-derived confidence from `computeLearningStats()`. The stored confidence value from Phase 9 should be retained as "AI confidence at creation" and the Phase 10 value shown as "Validated confidence".

---

## Open Questions

1. **Where exactly is the post detail view for VALID-01?**
   - What we know: There is no dedicated `/posts/[id]` page. Posts are shown in the brand analytics page and the calendar.
   - What's unclear: Should Phase 10 build a post detail page, or add `activeLearningIds` display to the analytics page?
   - Recommendation: Add learning attribution display to the analytics page (the table of posts + analytics). Each row that has `activeLearningIds` shows a count badge "2 learnings active." This satisfies VALID-01 without a new route.

2. **Minimum post count for the A/B "without" group**
   - What we know: The threshold is N posts for the "with" group (default 20). The "without" group grows naturally (all posts before any learnings were generated).
   - What's unclear: Should there be a minimum for the "without" group too?
   - Recommendation: No separate minimum for the "without" group. The without group will always be large (early posts + posts for brands with learningInjection=0). Guard only the "with" group.

3. **Thread safety of computeLearningStats during deactivation cron**
   - What we know: `autoDeactivateLearnings()` runs in a cron context. `collectAnalytics()` may write to `postAnalytics` at the same time (both run at 3am-ish windows, but different days for the validator).
   - What's unclear: Could the validator and analytics cron overlap?
   - Recommendation: Wednesday 3am validator, analytics runs every 6 hours (0am, 6am, 12pm, 6pm). Wednesday 3am is safe — no 6h analytics tick at 3am (only at 0am and 6am). No overlap risk.

---

## Validation Architecture

> nyquist_validation is enabled in .planning/config.json

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification (no automated test suite in repo) |
| Config file | None — integration testing via DB inspection and page navigation |
| Quick run command | Inspect `posts.postActiveLearningIds` in Drizzle Studio after generating with active learnings |
| Full suite command | Full flow: generate post with approved learnings, verify postActiveLearningIds set, simulate analytics collection, verify postAnalytics.activeLearningIds copied, check learnings page shows A/B stats |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| VALID-01 | Generated post stores active learning IDs | integration | After generating with approved learnings, query `SELECT post_active_learning_ids FROM posts ORDER BY id DESC LIMIT 1` in Drizzle Studio | Requires at least one approved+active learning in the brand |
| VALID-01 | activeLearningIds visible on post analytics view | manual | Navigate to /brands/[id]/analytics, verify learning count badge on rows with activeLearningIds | Visual inspection |
| VALID-02 | A/B comparison shows engagement averages per learning | manual | Navigate to /brands/[id]/learnings, verify each approved learning shows withCount, withAvgEngagement, withoutCount stats | Requires posts with engagementScore populated |
| VALID-03 | Auto-deactivation marks learning inactive after N posts with no lift | integration | Call `autoDeactivateLearnings({ threshold: 1 })` directly with test data — verify learning with delta <= 0 gets status='auto_deactivated' | Use threshold=1 to test without 20 posts |
| VALID-04 | Confidence indicator derived from post count + delta | manual | On learnings dashboard, verify confidence badge (high/medium/low) matches the formula: 20+ posts AND delta >= 5 → high, etc. | Visual inspection and formula verification |

### Sampling Rate

- **Per task commit:** Inspect DB state (Drizzle Studio) after each implementation step
- **Per wave merge:** Generate a post with approved learnings, verify the full attribution chain: `posts.postActiveLearningIds` → `postAnalytics.activeLearningIds` → learnings page shows A/B stats
- **Phase gate:** All 4 requirements verified manually before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `posts.postActiveLearningIds` migration — run `npx drizzle-kit generate` after adding column to schema.ts
- [ ] No automated test infrastructure exists in the repo — all validation is integration/manual

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `src/db/schema.ts` — confirmed `postAnalytics.activeLearningIds` exists; confirmed `posts` table has no `postActiveLearningIds` column yet
- Direct codebase inspection: `src/app/actions/generate.ts` — confirmed `generateContent()` loads learnings at step 3.5 but does NOT return their IDs; confirmed `saveGeneratedPosts()` does not accept or save learning IDs
- Direct codebase inspection: `src/lib/auto-generate.ts` — confirmed `saveAsAutoPost()` does not accept learning IDs; confirmed `autoGenerate()` calls `generateContent()` directly
- Direct codebase inspection: `src/lib/collect-analytics.ts` — confirmed the upsert does NOT copy `activeLearningIds` from the posts relay column (because the column doesn't exist yet)
- Direct codebase inspection: `src/lib/cron.ts` — confirmed existing cron schedule; Wednesday 3am (`0 3 * * 3`) has no conflicts except with the daily backup cron (`0 3 * * *`) — analyzed as safe with `busy_timeout`
- Direct codebase inspection: `src/lib/learning-engine.ts` — confirmed `analyzeForBrand()` writes learnings with `status='pending'`; `brandLearnings.status` is unconstrained text
- Direct codebase inspection: `src/lib/prompt-injector.ts` — confirmed `loadLearnings()` returns `BrandLearning[]` with `id` field; IDs available for attribution

### Secondary (MEDIUM confidence)

- SQLite documentation on `json_each()` virtual table — verified supported in SQLite 3.38+ (bundled with better-sqlite3 12.x uses SQLite 3.46+)
- Drizzle ORM docs (Context7 not queried — pattern verified from direct codebase use of `sql` template in existing queries e.g. `sql<number>\`count(*)\`` in collect-analytics.ts)

### Tertiary (LOW confidence)

- Confidence threshold calibration (postCount >= 20 AND delta >= 5 → high): derived from standard A/B testing conventions; not validated against actual engagement data in this project

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns already exist in codebase
- Architecture: HIGH — based on direct code inspection of every integration point; attribution gap confirmed from source
- Pitfalls: HIGH — attribution timing gap, json_each limitations, and auto-deactivated status all verified against actual code
- A/B query correctness: MEDIUM — `json_each()` approach is correct but not yet tested against actual data; confidence threshold numbers are LOW

**Research date:** 2026-03-20
**Valid until:** 2026-06-20 (stable stack; 90-day validity)
