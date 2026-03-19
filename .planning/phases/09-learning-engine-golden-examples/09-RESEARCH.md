# Phase 9: Learning Engine + Golden Examples - Research

**Researched:** 2026-03-19
**Domain:** AI-driven performance analysis, few-shot prompt injection, SQLite analytics queries, Next.js server actions
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LEARN-01 | Weekly analysis cron identifies patterns in top/bottom performers per brand per platform | learning-engine.ts analysis flow; collect-analytics.ts integration hook; cron.ts Sunday 2am slot |
| LEARN-02 | AI generates structured learnings (hook, format, tone, topic, timing, media, cta, length dimensions) | Claude Sonnet structured JSON analysis call; dimension taxonomy defined below |
| LEARN-03 | Learnings injected into generation prompts sorted by confidence score | buildSystemPrompt() optional param pattern; prompt-injector query + filter logic |
| LEARN-04 | Learnings dashboard: view active/inactive learnings per brand with performance data | New /brands/[id]/learnings page; server actions in learnings.ts |
| LEARN-05 | Post-mortem on failures: underperformers generate "avoid" learnings with distinct labeling | Separate bottom-performer cohort in analyzeForBrand(); type = 'avoid_pattern' |
| LEARN-06 | Statistical minimum gate: analysis requires 30+ posts per cohort before generating learnings | Guard check at top of analyzeForBrand(); "not enough data" UI indicator |
| LEARN-07 | Human approval gate: new learnings start as "pending" until approved on dashboard | status='pending' default on brandLearnings; approve/reject server actions |
| GOLD-01 | Auto-curate 90th percentile posts as golden examples per brand per platform | SQL percentile query from postAnalytics + posts; time-weighted selection |
| GOLD-02 | Dynamic few-shot: inject top 5 recent golden examples into generation prompts | goldenExamples param added to buildSystemPrompt(); recent 30-day priority |
| GOLD-03 | Golden examples page: view, pin, unpin examples per brand | New /brands/[id]/golden-examples page; pin/unpin server actions |
</phase_requirements>

---

## Summary

Phase 9 implements the core self-improvement loop of the v2.0 intelligence layer. It consists of three distinct workstreams that all converge on the generation prompt: (1) the learning engine that analyzes post performance and writes structured learnings to `brandLearnings`, (2) the prompt injection layer that loads approved learnings and golden examples on every `generateContent()` call, and (3) the UI that exposes learnings and golden examples to the user for approval and management.

All schema tables and columns needed by this phase are already in place from Phase 8. The `brandLearnings` table has `status`, `isActive`, `type`, `description`, `confidence`, `supportingPostIds`, `platform`, and `validatedAt` columns. The `brands` table has `learningInjection` and `lastLearningRunAt`. The `postAnalytics` table has `activeLearningIds`. Phase 9 writes to these tables and modifies the generation pipeline to read from them.

The `buildSystemPrompt()` function in `src/app/actions/generate.ts` is the primary injection point. It currently accepts only a `brand` parameter. Phase 9 adds two optional parameters: `learnings?: BrandLearning[]` and `goldenExamples?: GoldenExample[]`. When both are absent, behavior is identical to Phase 8 — no regression to the v1.0 pipeline. The entire analysis, injection, and UI work can be built without touching the core data model.

**Primary recommendation:** Build in dependency order — learning-engine.ts first (writes data), then prompt-injector.ts (reads data for generation), then generate.ts modification (uses injector), then the cron hook in collect-analytics.ts, then server actions, then UI pages. This order ensures every layer has real data to test against before the next layer is built.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | 0.80.0 (current) | Learning analysis via Claude Sonnet structured output | Already in project; Sonnet is the `primary` model in testing mode |
| drizzle-orm | 0.45.1 | All DB queries for learning analysis, golden example selection, approval writes | Already in project |
| better-sqlite3 | 12.8.0 | Sync SQLite driver; indexed lookups for per-generation learning loads are < 1ms | Already in project |
| node-cron | in project | Weekly learning cron registration in cron.ts | Already in project |

### No New Libraries Required

Phase 9 adds no npm dependencies. Percentile math uses plain JS array sorting (same pattern as `classifyTier()` in `collect-analytics.ts`). The 90th-percentile threshold for golden examples is `scores[Math.floor(len * 0.90)]` — no `simple-statistics` needed for this straightforward calculation. The UI dashboard uses existing shadcn/ui components (badges, tables, buttons).

**Installation:**
```bash
# No new packages
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain JS percentile math | simple-statistics@7.8.9 | simple-statistics adds a clean API but is unnecessary overhead for a single percentile calculation |
| Sonnet for analysis | Haiku for analysis | Haiku is cheaper but produces shallow pattern recognition; Sonnet identifies structural nuances in hook patterns and topic angles — worth the cost for a weekly job |
| Weekly standalone cron | Threshold-gated trigger inside collectAnalytics | Both are needed: threshold gate fires faster when data accumulates quickly; weekly cron is a backstop for slow-accumulating brands |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── learning-engine.ts       # NEW: analyzeForBrand(), analyzeAllBrands()
│   └── prompt-injector.ts       # NEW: loadLearnings(), loadGoldenExamples()
├── app/
│   ├── actions/
│   │   ├── generate.ts          # MODIFIED: buildSystemPrompt(brand, learnings?, goldenExamples?)
│   │   └── learnings.ts         # NEW: approveLearning(), rejectLearning(), toggleLearning(), runAnalysis()
│   └── (dashboard)/
│       └── brands/
│           └── [id]/
│               ├── learnings/
│               │   └── page.tsx # NEW: learnings management dashboard
│               └── golden-examples/
│                   └── page.tsx # NEW: golden examples view + pin/unpin
└── db/
    └── schema.ts                # NO CHANGES — Phase 8 complete
```

### Pattern 1: Learning Engine Analysis Flow

**What:** `analyzeForBrand(brandId, platform)` queries the top 20 and bottom 10 posts by engagement score, sends them to Claude Sonnet with a structured analysis prompt, receives a JSON array of learnings, and writes them to `brandLearnings` with `status='pending'`.

**When to use:** Called from two entry points — the threshold gate in `collectAnalytics()` and the weekly Sunday 2am cron. Both call the same `analyzeForBrand()` function.

**The 30-post guard:**
```typescript
// At the top of analyzeForBrand():
const cohortSize = db.select({ count: sql<number>`count(*)` })
  .from(postAnalytics)
  .innerJoin(posts, eq(postAnalytics.postId, posts.id))
  .where(
    and(
      eq(posts.brandId, brandId),
      eq(postAnalytics.platform, platform),
      isNotNull(postAnalytics.engagementScore),
    )
  )
  .get()

if ((cohortSize?.count ?? 0) < 30) {
  console.log(`[learning-engine] brandId=${brandId} platform=${platform}: only ${cohortSize?.count} posts, need 30`)
  return { skipped: true, reason: 'insufficient_data' }
}
```

**The time gate (7-day minimum between runs):**
```typescript
const brand = db.select({ lastLearningRunAt: brands.lastLearningRunAt })
  .from(brands).where(eq(brands.id, brandId)).get()

const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
if (brand?.lastLearningRunAt && brand.lastLearningRunAt > sevenDaysAgo) {
  return { skipped: true, reason: 'ran_recently' }
}
```

**The Claude analysis call:**
```typescript
const systemPrompt = `You are a social media performance analyst. Analyze these posts and extract structured learnings.
Return a JSON array with this shape:
[{
  "type": "hook_pattern" | "topic_pattern" | "structural_pattern" | "avoid_pattern",
  "description": "Specific, actionable insight (max 100 chars)",
  "confidence": "high" | "medium" | "low",
  "supportingPostIds": [1, 2, 3]
}]
Limit to 5 learnings maximum. For avoid_pattern, describe what to avoid. Do not return markdown.`

const userPrompt = `TOP PERFORMERS (high engagement):\n${topPosts.map(formatPostForAnalysis).join('\n---\n')}

UNDERPERFORMERS (low engagement):\n${bottomPosts.map(formatPostForAnalysis).join('\n---\n')}

Extract patterns from top performers (what worked), and anti-patterns from underperformers (what to avoid).`
```

**Post formatting for analysis (send metadata, not raw content):**
```typescript
function formatPostForAnalysis(post: AnalysisPost): string {
  return [
    `POST ID: ${post.id}`,
    `ENGAGEMENT SCORE: ${post.engagementScore}`,
    `HOOK (first 80 chars): ${post.content.slice(0, 80)}`,
    `LENGTH: ${post.content.length} chars`,
    `PLATFORM: ${post.platform}`,
  ].join('\n')
}
```

Note: Do NOT send full post content. Send metadata + hook only to stay within token budget and avoid injecting raw source text into the analysis prompt (security consideration from PITFALLS.md).

### Pattern 2: Backward-Compatible Prompt Augmentation

**What:** `buildSystemPrompt()` gains two optional parameters. When absent, function is identical to current implementation. When present, learnings are appended before the closing JSON instruction; golden examples are appended after the example posts block.

**The injection point:**
```typescript
function buildSystemPrompt(
  brand: BrandRow,
  learnings?: BrandLearning[],
  goldenExamples?: GoldenExample[]
): string {
  const parts: string[] = [
    // ... all existing parts unchanged ...
  ]

  // NEW: inject golden examples after brand example posts
  if (goldenExamples && goldenExamples.length > 0) {
    parts.push('\nTOP PERFORMING POSTS — USE AS STYLE REFERENCE (do not copy, generalize the pattern):')
    for (const ex of goldenExamples) {
      parts.push(`[${ex.platform.toUpperCase()} — engagement score ${ex.engagementScore}]`)
      parts.push(ex.content.slice(0, 300)) // cap at 300 chars per example to manage token budget
      parts.push('---')
    }
  }

  // NEW: inject approved learnings
  if (learnings && learnings.length > 0) {
    parts.push('\nLEARNINGS FROM YOUR TOP PERFORMERS (apply these):')
    for (const l of learnings) {
      const prefix = l.type === 'avoid_pattern' ? 'AVOID' : 'DO'
      parts.push(`- [${prefix}] ${l.description}`)
    }
  }

  // Closing instruction always last (unchanged):
  parts.push('')
  parts.push('Respond with ONLY valid JSON -- no markdown fences, no commentary.')
  return parts.join('\n')
}
```

### Pattern 3: Prompt Injector Query

**What:** `loadLearnings(brandId, platform)` runs a single indexed SQLite query to get active, approved learnings for the current generation call. This is called inside `generateContent()` before building the prompt.

**The query:**
```typescript
export function loadLearnings(brandId: number, platform: string): BrandLearning[] {
  const db = getDb()
  return db.select()
    .from(brandLearnings)
    .where(
      and(
        eq(brandLearnings.brandId, brandId),
        eq(brandLearnings.isActive, 1),
        eq(brandLearnings.status, 'approved'),
        or(
          isNull(brandLearnings.platform),
          eq(brandLearnings.platform, platform)
        )
      )
    )
    .orderBy(
      // confidence ordering: high=0, medium=1, low=2
      sql`CASE ${brandLearnings.confidence} WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`,
      desc(brandLearnings.validatedAt)
    )
    .limit(5)
    .all()
}
```

Key details:
- Only `status='approved'` learnings inject (not 'pending' or 'rejected')
- `isActive=1` can be toggled per-learning on the dashboard
- `platform IS NULL` means the learning applies to all platforms
- Max 5 per generation call to control token budget
- Confidence-ordered: high confidence learnings come first
- Fast: indexed lookup on `brandId + isActive + status`, typically < 1ms

### Pattern 4: Golden Examples Selection

**What:** `loadGoldenExamples(brandId, platform)` selects the 90th-percentile posts by engagement score, with time-weighting that gives recent posts (last 30 days) priority slots regardless of absolute score.

**Selection logic:**
```typescript
export function loadGoldenExamples(brandId: number, platform: string): GoldenExample[] {
  const db = getDb()

  // Step 1: Get all published posts with engagement scores for this brand+platform
  const allPosts = db.select({
    postId: posts.id,
    content: posts.content,
    engagementScore: postAnalytics.engagementScore,
    collectedAt: postAnalytics.collectedAt,
    isGoldenPinned: posts.isGoldenPinned, // see schema note below
  })
    .from(posts)
    .innerJoin(postAnalytics, eq(postAnalytics.postId, posts.id))
    .where(
      and(
        eq(posts.brandId, brandId),
        eq(postAnalytics.platform, platform),
        isNotNull(postAnalytics.engagementScore),
        eq(posts.status, 'published'),
        isNull(posts.variantOf), // exclude losing variants
      )
    )
    .orderBy(desc(postAnalytics.engagementScore))
    .all()

  if (allPosts.length === 0) return []

  // Step 2: Calculate 90th percentile threshold
  const scores = allPosts.map(p => p.engagementScore ?? 0).sort((a, b) => a - b)
  const p90 = scores[Math.floor(scores.length * 0.90)] ?? 0

  // Step 3: Split into pinned (always include), recent top performers (last 30 days), historic top
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const pinned = allPosts.filter(p => p.isGoldenPinned)
  const recentTop = allPosts.filter(p =>
    !p.isGoldenPinned &&
    (p.collectedAt ?? '') >= thirtyDaysAgo &&
    (p.engagementScore ?? 0) >= p90
  )
  const historicTop = allPosts.filter(p =>
    !p.isGoldenPinned &&
    (p.collectedAt ?? '') < thirtyDaysAgo &&
    (p.engagementScore ?? 0) >= p90
  )

  // Step 4: Fill slots: pinned first, then recent, then historic — cap at 5
  return [...pinned, ...recentTop, ...historicTop].slice(0, 5)
}
```

**Schema note on `isGoldenPinned`:** The `posts` table needs a `isGoldenPinned` column for GOLD-03. This was NOT added in Phase 8 — it must be added in Phase 9 as a small additive migration. Column: `integer('is_golden_pinned').notNull().default(0)`. Run `npx drizzle-kit generate` after adding it to schema.ts to produce the migration.

### Pattern 5: Integration into generateContent()

**What:** `generateContent()` calls the injector before building the prompt. The brand's `learningInjection` flag controls whether learnings are loaded. Golden examples always load when available (they are always beneficial).

```typescript
export async function generateContent(
  brandId: number,
  platforms: string[],
  sourceText: string,
  sourceUrl: string
): Promise<GenerationResult> {
  // ... existing steps 1-3 unchanged ...

  // NEW step 3.5: Load learnings and golden examples
  const learnings = brand.learningInjection
    ? loadLearnings(brandId, platforms[0]) // use first platform for filtering
    : []
  const goldenExamples = loadGoldenExamples(brandId, platforms[0])

  // Step 4: Build prompts — modified to pass learnings and examples
  const systemPrompt = buildSystemPrompt(brand, learnings, goldenExamples)
  // ... rest unchanged ...
}
```

### Pattern 6: collectAnalytics() Threshold Gate

**What:** After cohort reclassification, check whether enough new top/under posts exist to trigger learning analysis. If yes, call `analyzeForBrand()`. This avoids a separate polling cron and ensures analysis runs as soon as data is ready.

**The hook in collect-analytics.ts:**
```typescript
// After the reclassification loop (lines ~302 in current code):

// Track newly classified top+under posts per brand
const newTopUnderByBrand = new Map<number, number>()
// ... accumulate count during reclassification ...

// Trigger learning analysis for brands with enough new data
for (const [brandId, newCount] of newTopUnderByBrand) {
  if (newCount >= 5) {
    const { analyzeAllPlatformsForBrand } = await import('./learning-engine')
    await analyzeAllPlatformsForBrand(brandId)
  }
}
```

Note: `analyzeForBrand()` internally checks the 7-day time gate and the 30-post minimum, so calling it is safe even if the brand ran analysis recently — it will simply return early.

### Pattern 7: Weekly Learning Cron Registration

**What:** New cron entry in cron.ts, Sunday 2am. Offset from the 3am backup and 0am spend summary to avoid SQLite write contention.

```typescript
// In initCron() — add after existing registrations:

// ── 6. Weekly learning analysis (Sunday 2:00 AM) ─────────────────────────────
cron.schedule('0 2 * * 0', async () => {
  try {
    const { analyzeAllBrands } = await import('./learning-engine')
    await analyzeAllBrands()
  } catch (err) {
    console.error('[cron] learning-engine failed:', err)
  }
})
```

Existing cron schedule map (for conflict reference):
```
* * * * *     → publishDuePosts      (every minute)
*/5 * * * *   → pollFeeds            (every 5 min)
*/15 * * * *  → autoGenerate         (every 15 min)
0 */6 * * *   → collectAnalytics     (every 6 hours: 0:00, 6:00, 12:00, 18:00)
0 0 * * *     → AI spend summary     (midnight)
0 3 * * *     → runDbBackup          (3am daily)
0 2 * * 0     → learningEngine [NEW] (Sunday 2am) ← no conflicts
```

### Pattern 8: Learnings Dashboard Server Actions

**What:** `src/app/actions/learnings.ts` provides the server actions the learnings UI needs.

```typescript
'use server'

export async function approveLearning(learningId: number): Promise<{ error?: string }> {
  const db = getDb()
  db.update(brandLearnings)
    .set({ status: 'approved', isActive: 1, updatedAt: new Date().toISOString() })
    .where(eq(brandLearnings.id, learningId))
    .run()
  revalidatePath('/brands/[id]/learnings', 'page')
  return {}
}

export async function rejectLearning(learningId: number): Promise<{ error?: string }> {
  const db = getDb()
  db.update(brandLearnings)
    .set({ status: 'rejected', isActive: 0, updatedAt: new Date().toISOString() })
    .where(eq(brandLearnings.id, learningId))
    .run()
  revalidatePath('/brands/[id]/learnings', 'page')
  return {}
}

export async function toggleLearning(learningId: number, isActive: boolean): Promise<{ error?: string }> {
  const db = getDb()
  db.update(brandLearnings)
    .set({ isActive: isActive ? 1 : 0, updatedAt: new Date().toISOString() })
    .where(eq(brandLearnings.id, learningId))
    .run()
  revalidatePath('/brands/[id]/learnings', 'page')
  return {}
}

export async function runManualAnalysis(brandId: number): Promise<{ error?: string }> {
  // Bypass 7-day gate for manual runs (pass force=true flag)
  const { analyzeAllPlatformsForBrand } = await import('@/lib/learning-engine')
  await analyzeAllPlatformsForBrand(brandId, { force: true })
  revalidatePath('/brands/' + brandId + '/learnings')
  return {}
}

export async function pinGoldenExample(postId: number, brandId: number): Promise<{ error?: string }> {
  const db = getDb()
  db.update(posts)
    .set({ isGoldenPinned: 1 })
    .where(eq(posts.id, postId))
    .run()
  revalidatePath('/brands/' + brandId + '/golden-examples')
  return {}
}

export async function unpinGoldenExample(postId: number, brandId: number): Promise<{ error?: string }> {
  const db = getDb()
  db.update(posts)
    .set({ isGoldenPinned: 0 })
    .where(eq(posts.id, postId))
    .run()
  revalidatePath('/brands/' + brandId + '/golden-examples')
  return {}
}
```

### Anti-Patterns to Avoid

- **Loading learnings into a module-level cache:** The analytics cron writes new learnings every 6 hours. A cached copy is immediately stale. Query `brandLearnings` synchronously on every `generateContent()` call — the indexed SQLite lookup takes < 1ms.
- **Injecting all learnings without filtering:** Platform-specific learnings for LinkedIn break Twitter content. Confidence-filter and platform-match before injection. Hard limit of 5.
- **Sending full post content to learning analysis:** Keeps token costs manageable and prevents source text injection into the analysis system prompt. Send hook (first 80 chars) + engagement score + length only.
- **Running learning analysis on every analytics cycle:** Use both the threshold gate (5+ new top/under) AND the 7-day time gate. Prevents 4 Sonnet analysis calls per day per brand.
- **Auto-approving learnings:** Human approval is non-negotiable (Goodhart's Law). All learnings start as `status='pending'`. No code path auto-approves them.
- **Making golden examples visible to users as "posts to copy":** Frame them as style references in the prompt, not templates. Cap at 300 chars per example to prevent verbatim copying.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Percentile calculation | Custom ranking algo | Plain JS `scores[Math.floor(len * 0.90)]` | The pattern already exists in `classifyTier()` — same approach |
| Structured AI output parsing | Custom parser | `parseJsonResponse<T>()` | Already in generate.ts, handles fence stripping + JSON.parse |
| AI spend check | Custom budget guard | `checkAiSpend()` from ai.ts | Already guards all AI calls in the codebase |
| Cron mutex | Custom lock | `globalThis.__learningRunning` pattern | Exactly how `__analyticsRunning` and `__autoGenerateRunning` work |
| Learning status toggling | Build a full state machine | Simple `status` text column + server actions | The schema already has `status` on `brandLearnings` |

**Key insight:** Every infrastructure pattern needed by Phase 9 (AI calls, spend logging, cron mutex, JSON parsing, cost calculation) already exists in the codebase. Phase 9 is composition, not new infrastructure.

---

## Common Pitfalls

### Pitfall 1: isGoldenPinned Column Missing

**What goes wrong:** GOLD-03 (pin/unpin) requires a column on the `posts` table that was not added in Phase 8. Calling `db.update(posts).set({ isGoldenPinned: 1 })` will fail with a Drizzle type error or SQLite column-not-found error.

**Why it happens:** The Phase 8 schema plan documented `isGoldenPinned` as out-of-scope because no Phase 8 feature used it. It was implicitly deferred.

**How to avoid:** Add `isGoldenPinned: integer('is_golden_pinned').notNull().default(0)` to the `posts` table in `schema.ts` as the very first step of Phase 9 implementation. Run `npx drizzle-kit generate` to produce migration `0009_add_golden_pinned.sql`. This is a nullable-equivalent additive column (default 0) — no existing rows break.

**Warning signs:** TypeScript type error on `posts.isGoldenPinned` reference; failing Drizzle queries on the golden examples page.

---

### Pitfall 2: Learning Analysis Runs With No Engagement Data

**What goes wrong:** `analyzeForBrand()` is triggered by the collectAnalytics threshold gate but `postAnalytics.engagementScore` is NULL for most posts (API didn't return metrics yet). The 30-post count check passes because there are 30+ `postAnalytics` rows, but their scores are NULL. Claude gets engagement scores of "null" for every post and produces nonsense learnings.

**Why it happens:** The cohort size check counts rows, not rows with non-null engagement scores. This is a subtle distinction.

**How to avoid:** The 30-post guard must filter `isNotNull(postAnalytics.engagementScore)`:
```typescript
const cohortSize = db.select({ count: sql<number>`count(*)` })
  .from(postAnalytics)
  .innerJoin(posts, eq(postAnalytics.postId, posts.id))
  .where(
    and(
      eq(posts.brandId, brandId),
      eq(postAnalytics.platform, platform),
      isNotNull(postAnalytics.engagementScore),  // <-- critical
    )
  ).get()
```

**Warning signs:** Learnings generated with `supportingPostIds` containing IDs that have no engagement scores. Analysis runs within the first 48 hours of the system being live.

---

### Pitfall 3: Prompt Token Budget Blow-Out From Golden Examples

**What goes wrong:** Golden examples inject up to 5 full posts into the system prompt. If posts average 1000 characters (typical LinkedIn post), that's 5000 characters of example content on top of the existing brand prompt. At ~4 chars/token, that's 1250 extra tokens per generation call. With Sonnet at $3/M input tokens, across 100 daily auto-generated posts, that's $0.375/day in extra input cost — not catastrophic, but significant.

**Why it happens:** No character cap on injected example content.

**How to avoid:** Cap each golden example at 300 characters in the prompt injection:
```typescript
parts.push(ex.content.slice(0, 300))
```
300 chars is enough to convey hook style, tone, and structure. Full post content is not needed for style guidance.

**Warning signs:** AI spend log showing significantly higher input_tokens per generation call after enabling golden examples; daily spend hitting limit earlier than expected.

---

### Pitfall 4: "Pending" Learnings Silently Injecting Into Prompts

**What goes wrong:** `loadLearnings()` filters by `isActive = 1` but forgets to also filter by `status = 'approved'`. Since `isActive` defaults to `1` and `status` defaults to `'pending'`, all new learnings inject immediately — bypassing the human approval gate entirely.

**Why it happens:** Two-column filter is easy to miss. The `isActive` column looks like the right guard but isn't sufficient alone.

**How to avoid:** The `loadLearnings()` query MUST include both conditions:
```typescript
and(
  eq(brandLearnings.isActive, 1),
  eq(brandLearnings.status, 'approved'),  // <-- this is the approval gate
  ...
)
```

**Warning signs:** Learnings appearing in generated content before they show up on the dashboard as "approved". Any learning visible on the dashboard as "pending" affecting post content.

---

### Pitfall 5: SQLite Write Contention — Analytics + Learning Running Simultaneously

**What goes wrong:** `collectAnalytics()` triggers `analyzeForBrand()` at the end of its run. If the analytics cron is still mid-write when the learning engine starts writing `brandLearnings` rows, `SQLITE_BUSY` errors appear. The learning run fails silently (caught in a try/catch in the threshold gate code) and no learnings are written.

**Why it happens:** Both functions write to the DB. WAL mode allows concurrent reads but not concurrent writes. The per-job mutex guards (`__analyticsRunning`, `__learningRunning`) only prevent a job from overlapping with itself, not with other jobs.

**How to avoid:**
1. `PRAGMA busy_timeout = 5000` must be set on the DB connection — verify it is set in `src/db/index.ts`
2. The learning analysis writes are a separate transaction that starts AFTER analytics finishes. Because `analyzeForBrand()` is called at the end of the analytics function (after all analytics writes are committed), the risk is low.
3. The weekly standalone cron runs at Sunday 2am, offset from all other crons.
4. Batch-insert brandLearnings rows in a single transaction, not row-by-row.

**Warning signs:** `database is locked` errors in logs on Sunday mornings; learning analysis completing but no new `brandLearnings` rows appearing in the DB.

---

### Pitfall 6: Golden Examples From Only One Time Period

**What goes wrong:** All 5 golden examples are from the same viral week when the account launched. They all share the same topic and hook structure. Every generated post starts sounding like it was written in that week. Audience fatigue sets in.

**Why it happens:** Naive "top N by engagement score" selects historic viral posts that have had months to accumulate engagement, always beating recent posts.

**How to avoid:** The time-weighted selection in `loadGoldenExamples()`:
- Pinned posts always included (user curated)
- Recent top performers (last 30 days) fill the next slots
- Historic top performers fill remaining slots
- Cap at 5 total

This ensures at least some examples are recent, even if their absolute scores are lower.

**Warning signs:** All golden examples on the dashboard showing the same publication date range; generated posts increasingly similar to each other; declining engagement score trend despite learning injection.

---

### Pitfall 7: revalidatePath() Paths Not Matching Actual Routes

**What goes wrong:** Server actions call `revalidatePath('/brands/[id]/learnings')` with the literal `[id]` placeholder. Next.js App Router requires either the full concrete path (`'/brands/42/learnings'`) or the path + 'page' layout type (`revalidatePath('/brands/[id]/learnings', 'page')` for dynamic routes).

**Why it happens:** Next.js App Router revalidation with dynamic segments requires the second `type` argument when using bracket syntax.

**How to avoid:** Use the `'page'` type argument for dynamic route revalidation:
```typescript
revalidatePath('/brands/[id]/learnings', 'page')
revalidatePath('/brands/[id]/golden-examples', 'page')
```
Or pass the concrete path: `revalidatePath('/brands/' + brandId + '/learnings')`.

**Warning signs:** Approval/rejection actions succeed (no error returned) but the UI doesn't update; user has to hard-refresh to see changes.

---

## Code Examples

### Learning Analysis Full Flow

```typescript
// src/lib/learning-engine.ts

import { getDb } from '@/db'
import { brandLearnings, brands, posts, postAnalytics } from '@/db/schema'
import { eq, and, isNotNull, desc, sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'
import { getModelConfig, checkAiSpend, logAiSpend } from '@/lib/ai'

interface AnalysisPost {
  id: number
  content: string
  engagementScore: number
  platform: string
}

interface LearningOutput {
  type: 'hook_pattern' | 'topic_pattern' | 'structural_pattern' | 'avoid_pattern'
  description: string
  confidence: 'high' | 'medium' | 'low'
  supportingPostIds: number[]
}

function formatPostForAnalysis(post: AnalysisPost): string {
  return [
    `POST ID: ${post.id}`,
    `ENGAGEMENT SCORE: ${post.engagementScore}`,
    `HOOK (first 80 chars): ${post.content.slice(0, 80)}`,
    `LENGTH: ${post.content.length} chars`,
    `PLATFORM: ${post.platform}`,
  ].join('\n')
}

export async function analyzeForBrand(
  brandId: number,
  platform: string,
  options: { force?: boolean } = {}
): Promise<{ skipped?: boolean; reason?: string; learningsWritten?: number }> {
  const db = getDb()

  // 1. Time gate (skip if ran in last 7 days, unless forced)
  if (!options.force) {
    const brand = db.select({ lastLearningRunAt: brands.lastLearningRunAt })
      .from(brands).where(eq(brands.id, brandId)).get()
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    if (brand?.lastLearningRunAt && brand.lastLearningRunAt > sevenDaysAgo) {
      return { skipped: true, reason: 'ran_recently' }
    }
  }

  // 2. Data gate (30+ posts with engagement scores)
  const cohortCount = db.select({ count: sql<number>`count(*)` })
    .from(postAnalytics)
    .innerJoin(posts, eq(postAnalytics.postId, posts.id))
    .where(and(
      eq(posts.brandId, brandId),
      eq(postAnalytics.platform, platform),
      isNotNull(postAnalytics.engagementScore),
    )).get()

  if ((cohortCount?.count ?? 0) < 30) {
    return { skipped: true, reason: 'insufficient_data' }
  }

  // 3. Spend gate
  const { checkAiSpend: checkSpend } = await import('@/lib/ai')
  if (!await checkSpend()) {
    return { skipped: true, reason: 'spend_limit' }
  }

  // 4. Query top 20 and bottom 10
  const allPosts = db.select({
    id: posts.id,
    content: posts.content,
    engagementScore: postAnalytics.engagementScore,
    platform: postAnalytics.platform,
  })
    .from(posts)
    .innerJoin(postAnalytics, eq(postAnalytics.postId, posts.id))
    .where(and(
      eq(posts.brandId, brandId),
      eq(postAnalytics.platform, platform),
      isNotNull(postAnalytics.engagementScore),
    ))
    .orderBy(desc(postAnalytics.engagementScore))
    .all() as AnalysisPost[]

  const topPosts = allPosts.slice(0, 20)
  const bottomPosts = allPosts.slice(-10)

  // 5. Claude analysis call
  let _anthropic: Anthropic | null = null
  const getAnthropicClient = () => {
    if (!_anthropic) _anthropic = new Anthropic()
    return _anthropic
  }

  const modelConfig = getModelConfig()
  const response = await getAnthropicClient().messages.create({
    model: modelConfig.primary,
    max_tokens: 2048,
    system: `You are a social media performance analyst. Extract learnings from post data.
Return a JSON array (max 5 items):
[{ "type": "hook_pattern"|"topic_pattern"|"structural_pattern"|"avoid_pattern", "description": "max 100 chars", "confidence": "high"|"medium"|"low", "supportingPostIds": [1,2] }]
avoid_pattern = what to avoid (from underperformers). Others = what works (from top performers).
No markdown. Only JSON array.`,
    messages: [{
      role: 'user',
      content: `TOP PERFORMERS:\n${topPosts.map(formatPostForAnalysis).join('\n---\n')}\n\nUNDERPERFORMERS:\n${bottomPosts.map(formatPostForAnalysis).join('\n---\n')}`
    }],
  })

  // 6. Parse and write
  const rawText = response.content[0].type === 'text' ? response.content[0].text : '[]'
  const learningOutputs: LearningOutput[] = JSON.parse(rawText.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim())
  const now = new Date().toISOString()

  for (const l of learningOutputs) {
    db.insert(brandLearnings).values({
      brandId,
      platform,
      type: l.type,
      description: l.description,
      confidence: l.confidence,
      supportingPostIds: l.supportingPostIds,
      isActive: 1,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    }).run()
  }

  // 7. Update lastLearningRunAt
  db.update(brands)
    .set({ lastLearningRunAt: now })
    .where(eq(brands.id, brandId))
    .run()

  // 8. Log spend
  const costUsd = ((response.usage.input_tokens / 1_000_000) * 3.00 + (response.usage.output_tokens / 1_000_000) * 15.00).toFixed(6)
  logAiSpend({ brandId, model: modelConfig.primary, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, costUsd })

  return { learningsWritten: learningOutputs.length }
}
```

### Learnings Dashboard UI Sketch

The `/brands/[id]/learnings` page renders a table with columns:

| Type | Description | Confidence | Status | Supporting Posts | Actions |
|------|-------------|------------|--------|-----------------|---------|
| hook_pattern | "Open with a contrarian claim" | high | pending | 5 posts | Approve / Reject |
| avoid_pattern | "Avoid long intros" | medium | approved | 8 posts | Toggle On/Off |

Key UI decisions:
- `avoid_pattern` type rows get a red/orange badge to distinguish them ("AVOID")
- `pending` status rows are highlighted (e.g., amber background) to prompt review
- `approved + isActive=1` = injecting into prompts (green "Active" badge)
- `approved + isActive=0` = approved but paused by user (grey "Paused" badge)
- `rejected` = will never inject (red "Rejected" badge, hidden by default)
- "Run Analysis" button triggers `runManualAnalysis()` server action
- If brand has < 30 posts with engagement scores, show "Not enough data yet — need N more posts" instead of the "Run Analysis" button

The `/brands/[id]/golden-examples` page renders posts at 90th percentile with:
- Post content preview (first 300 chars)
- Engagement score
- Platform badge
- Pin/Unpin button
- "Pinned" examples shown at the top with a pin icon
- Indication that top 5 are injected into generation prompts

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static brand example posts in brand profile | Dynamic golden examples auto-curated from real performance data | Phase 9 | 15-40% quality lift from curated few-shot vs. static examples |
| Manual prompt tuning by user | AI-extracted learnings from engagement data | Phase 9 | Self-improving prompts without user effort |
| No performance feedback loop | Weekly analysis + injection closes the loop | Phase 9 | Content quality compounds over time |

**Deprecated/outdated:**
- Static `examplePosts` field on the brand record: not removed, but superseded by golden examples for style anchoring. Brand example posts remain for initial voice training; golden examples layer on top.

---

## Open Questions

1. **Token budget impact of combined learnings + golden examples**
   - What we know: 5 learnings at ~100 chars each = ~500 chars; 5 examples at 300 chars each = ~1500 chars; total ~2000 chars = ~500 extra tokens per call
   - What's unclear: Does this push any platform's prompt over a practical limit? Sonnet supports 200K context; 500 extra tokens is negligible.
   - Recommendation: No action needed. Monitor input_tokens in ai_spend_log after enabling; alert if it doubles.

2. **Multiple platforms per brand — per-platform or cross-platform learnings?**
   - What we know: `brandLearnings.platform` is nullable (null = applies to all platforms). The current analysis flow calls `analyzeForBrand(brandId, platform)` per platform.
   - What's unclear: Should there be a separate analysis pass that looks at cross-platform patterns and writes `platform=null` learnings?
   - Recommendation: In Phase 9, implement per-platform analysis only. Cross-platform patterns are a Phase 10+ concern. The `platform=null` capability is in the schema for future use.

3. **"Not enough data" indicator on learnings page**
   - What we know: The requirement says brands below the 30-post threshold should show a "not enough data yet" indicator.
   - What's unclear: Should this count all published posts, or only posts with engagement scores collected?
   - Recommendation: Count posts with `postAnalytics.engagementScore IS NOT NULL`. This is the same gate the analysis uses — consistent user expectation.

---

## Validation Architecture

> nyquist_validation is enabled in .planning/config.json

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual verification (no automated test suite detected in repo) |
| Config file | None — integration testing via cron triggers and DB inspection |
| Quick run command | Check `brandLearnings` table in Drizzle Studio after triggering analysis |
| Full suite command | End-to-end: trigger `runManualAnalysis()` via UI, verify learnings appear as pending, approve one, generate content, inspect generated prompt includes learning |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| LEARN-01 | Weekly cron fires Sunday 2am, writes learnings | integration | `node -e "require('./src/lib/learning-engine').analyzeAllBrands()"` | Requires 30+ posts with engagement scores |
| LEARN-02 | Learnings have correct type/confidence/description structure | integration | Inspect `brandLearnings` rows in Drizzle Studio | Check all 8 dimension types appear over time |
| LEARN-03 | Approved learnings appear in generated prompt | integration | Generate content with a brand that has approved learnings; log system prompt | Verify learning text in prompt |
| LEARN-04 | Learnings dashboard loads with type/confidence/post count | manual | Navigate to /brands/[id]/learnings | Visual inspection |
| LEARN-05 | avoid_pattern learnings created from underperformers | integration | Check `type='avoid_pattern'` rows after analysis run | Requires bottom-10 posts with scores |
| LEARN-06 | Analysis skips brands with < 30 posts | unit | Call `analyzeForBrand()` on a brand with 5 posts; expect `{skipped: true}` | Fast, no AI call made |
| LEARN-07 | New learnings start as status='pending' | integration | After analysis run, confirm all new rows have `status='pending'` | DB inspection |
| GOLD-01 | 90th percentile posts identified correctly | unit | Run `loadGoldenExamples()` against mock data; verify p90 threshold | Math verification |
| GOLD-02 | Top 5 golden examples appear in generation prompt | integration | Generate with brand having golden examples; inspect system prompt | Check example text in prompt |
| GOLD-03 | Pin/unpin actions work; pinned examples appear first | manual | Navigate to /brands/[id]/golden-examples; pin a post; verify it moves to top | Visual inspection |

### Sampling Rate

- **Per task commit:** Inspect DB state (Drizzle Studio) after each implementation step
- **Per wave merge:** Full end-to-end flow: trigger analysis, approve learning, generate content, verify prompt injection
- **Phase gate:** All 10 requirements verified manually before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `isGoldenPinned` migration — run `npx drizzle-kit generate` after adding column to schema.ts
- [ ] No automated test infrastructure exists in the repo — all validation is integration/manual

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `src/app/actions/generate.ts` (buildSystemPrompt, generateContent, refineAndGate patterns)
- Direct codebase inspection: `src/lib/collect-analytics.ts` (cohort reclassification, tier classification, affectedCohorts pattern)
- Direct codebase inspection: `src/lib/cron.ts` (cron schedule map, mutex pattern, dynamic import pattern)
- Direct codebase inspection: `src/lib/ai.ts` (getModelConfig, checkAiSpend, logAiSpend — all reused by learning engine)
- Direct codebase inspection: `src/db/schema.ts` (brandLearnings confirmed present with all required columns; isGoldenPinned absence confirmed)
- `.planning/research/ARCHITECTURE.md` — data flow diagrams, component responsibilities, integration points

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` — Goodhart's Law prevention, data starvation guard, SQLite contention strategies, golden example staleness
- `.planning/research/FEATURES.md` — 15-40% quality lift from curated golden examples (sourced from Towards Data Science)
- `.planning/research/SUMMARY.md` — stack decisions, phase ordering rationale

### Tertiary (LOW confidence)

- Token budget estimate (~500 tokens per combined learnings + examples injection): calculated from character estimates, not measured from actual API calls

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — based on direct code inspection of every integration point; inject patterns verified against actual function signatures
- Pitfalls: HIGH — Pitfalls 1-5 verified against actual schema and code; Pitfall 6-7 verified against Next.js App Router revalidation docs
- isGoldenPinned gap: HIGH — confirmed absent from schema.ts

**Research date:** 2026-03-19
**Valid until:** 2026-06-19 (stable stack; 90-day validity)
