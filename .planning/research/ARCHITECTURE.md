# Architecture Research

**Domain:** Intelligence Layer for Autonomous Social Content Engine (v2.0)
**Researched:** 2026-03-19
**Confidence:** HIGH (based on direct codebase inspection)

## Context: This Is a Subsequent Milestone

The v1.0 architecture is shipped and operational. All research here focuses on how v2.0 Intelligence
Layer features integrate with, extend, or modify existing components. The base architecture diagram
from v1.0 is preserved below; new components are marked with (NEW) or (MODIFIED).

---

## Existing Architecture (v1.0)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Single Railway Process (Node.js)                   │
├─────────────────────────┬────────────────────────────────────────────┤
│   Next.js 15 App Router │              node-cron Jobs                 │
│                         │                                             │
│  Server Components      │  */1  → publishDuePosts()                  │
│  Client Components      │  */5  → pollFeeds()                        │
│  Server Actions         │  */15 → autoGenerate()                     │
│  API Routes             │  */6h → collectAnalytics()                 │
│                         │  3am  → runDbBackup()                      │
├─────────────────────────┴────────────────────────────────────────────┤
│                      src/lib/ (business logic)                        │
│  auto-generate.ts  collect-analytics.ts  publish.ts  feed-poll.ts   │
│  ai.ts  circuit-breaker.ts  spam-guard.ts  extract.ts  r2.ts        │
├──────────────────────────────────────────────────────────────────────┤
│                 src/db/ (SQLite via better-sqlite3 + drizzle-orm)     │
│  brands  posts  postPlatforms  postAnalytics  feedEntries            │
│  feedSources  schedulingSlots  activityLog  aiSpendLog               │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Existing Integration Points for v2.0

| Integration Point | Location | How Intelligence Layer Hooks In |
|-------------------|----------|---------------------------------|
| `buildSystemPrompt(brand)` | `generate.ts` | Add `learnings?` param, inject learning text before closing instruction |
| `generateContent()` server action | `generate.ts` | Load learnings, pass to prompt builder; extend for variants |
| `refineAndGate()` server action | `generate.ts` | Gains variant selection: picks best-scored from N variants |
| `autoGenerate()` | `auto-generate.ts` | Calls `generateVariants()` instead of `generateContent()` when flag enabled |
| `collectAnalytics()` cron | `collect-analytics.ts` | Triggers learning analysis after cohort reclassification |
| `postAnalytics` table | `schema.ts` | Primary data source for all learning features |
| `brands` table | `schema.ts` | Gains feature flags: `enableVariants`, `learningInjection` |
| `activityLog` table | `schema.ts` | Learning events log here for traceability |

---

## v2.0 Architecture: Intelligence Layer Added

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Single Railway Process (Node.js)                   │
├─────────────────────────┬────────────────────────────────────────────┤
│   Next.js 15 App Router │              node-cron Jobs                 │
│                         │                                             │
│  Server Components      │  */1   → publishDuePosts()                 │
│  Client Components      │  */5   → pollFeeds()                       │
│  Server Actions         │  */15  → autoGenerate() [MODIFIED]         │
│  API Routes             │  */6h  → collectAnalytics() [MODIFIED]     │
│                         │  3am   → runDbBackup()                     │
│                         │  Sun   → learningEngine() + recycleContent() [NEW]
│                         │  1st   → evolvePrompts() [NEW]             │
├─────────────────────────┴────────────────────────────────────────────┤
│                      src/lib/ (business logic)                        │
│                                                                      │
│  --- v1.0 ---                           --- v2.0 NEW ---             │
│  auto-generate.ts [MODIFIED]            learning-engine.ts           │
│  collect-analytics.ts [MODIFIED]        prompt-injector.ts           │
│  generate.ts [MODIFIED]                 content-recycler.ts          │
│  ai.ts                                  repurpose-chain.ts           │
│  publish.ts  feed-poll.ts               engagement-helper.ts         │
│  circuit-breaker.ts  spam-guard.ts      prompt-evolution.ts          │
├──────────────────────────────────────────────────────────────────────┤
│                 src/db/ (SQLite via better-sqlite3 + drizzle-orm)     │
│                                                                      │
│  --- v1.0 tables ---                    --- v2.0 new tables ---      │
│  brands [MODIFIED]                      brandLearnings               │
│  posts [MODIFIED]                       promptTemplates              │
│  postAnalytics [MODIFIED]               commentSuggestions           │
│  postPlatforms  feedEntries             (if Upload-Post API supports) │
│  feedSources  schedulingSlots                                        │
│  activityLog  aiSpendLog                                             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibility | New vs Modified |
|-----------|----------------|-----------------|
| `learning-engine.ts` | Analyzes top/under performers via Claude, writes `brandLearnings` rows | NEW |
| `prompt-injector.ts` | Loads active learnings for a brand+platform, formats them for prompt injection | NEW |
| `content-recycler.ts` | Finds evergreen top-performers 30+ days old, generates fresh-angle versions | NEW |
| `repurpose-chain.ts` | Takes one source, generates a scheduled chain across platforms/days | NEW |
| `engagement-helper.ts` | Fetches unresponded comments, suggests replies via Claude | NEW (blocked on API) |
| `prompt-evolution.ts` | Monthly analysis of template performance, suggests evolved templates | NEW |
| `analytics-charts.tsx` | Client component rendering Recharts engagement/time/platform charts | NEW |
| `buildSystemPrompt()` | Assembles Claude system prompt; gains `learnings?` optional param | MODIFIED |
| `generateContent()` | Single-variant generation; loads learnings before calling prompt builder | MODIFIED |
| `generateVariants()` | New function: calls `generateContent()` × 3, quality-gates all, picks winner | NEW function in `generate.ts` |
| `refineAndGate()` | Critique → rewrite pipeline; gains variant selection mode | MODIFIED |
| `autoGenerate()` | Pipeline runner; calls `generateVariants()` when brand flag enabled | MODIFIED |
| `collectAnalytics()` | Analytics collector; triggers learning analysis after threshold | MODIFIED |
| `cron.ts` | Job registry; gains 3 new cron schedules | MODIFIED |

---

## Schema Changes

### New Tables

**`brandLearnings`** — Stores extracted performance patterns per brand/platform:
```
id                  integer PK autoIncrement
brandId             integer NOT NULL → brands.id
platform            text nullable          -- null = applies to all platforms
type                text NOT NULL          -- 'hook_pattern' | 'topic_pattern' | 'structural_pattern' | 'avoid_pattern'
description         text NOT NULL          -- the actual learning text injected into prompts
confidence          text NOT NULL          -- 'high' | 'medium' | 'low'
supportingPostIds   text json nullable     -- array of postIds that support this learning
isActive            integer NOT NULL default 1   -- 1 = injected, 0 = deactivated
abTestGroup         text nullable          -- 'control' | 'treatment' for A/B validation
validatedAt         text nullable          -- ISO date when A/B test concluded
createdAt           text NOT NULL
updatedAt           text NOT NULL
```

**`promptTemplates`** — Stores evolved/versioned prompt templates per brand:
```
id                  integer PK autoIncrement
brandId             integer NOT NULL → brands.id
platform            text nullable
templateText        text NOT NULL          -- full template with {{placeholders}}
version             integer NOT NULL       -- 1, 2, 3...
isActive            integer NOT NULL default 0   -- only one active per brand+platform
suggestedByModel    text NOT NULL          -- which Claude model suggested this
performanceScore    text nullable          -- avg engagement of posts using this template
createdAt           text NOT NULL
```

**`commentSuggestions`** — AI-generated reply suggestions (conditional on Upload-Post API):
```
id                  integer PK autoIncrement
brandId             integer NOT NULL → brands.id
platform            text NOT NULL
postId              integer NOT NULL → posts.id
commentText         text NOT NULL
suggestedReply      text NOT NULL
status              text NOT NULL default 'pending'  -- 'pending' | 'used' | 'dismissed'
createdAt           text NOT NULL
```

### Modified Tables

**`posts`** — Add columns for variant tracking and recycling chains:
```
recycledFromPostId  integer nullable → posts.id   -- set when post is recycled evergreen
variantOf           integer nullable → posts.id   -- set for losing variants (NOT NULL on losers)
variantGroup        text nullable                 -- UUID shared by all variants from one run
repurposeChainId    text nullable                 -- UUID grouping posts in a repurpose chain
```

**`brands`** — Add columns for feature flags and learning state:
```
enableVariants      integer NOT NULL default 0   -- multi-variant generation on/off
learningInjection   integer NOT NULL default 1   -- inject learnings into prompts on/off
lastLearningRunAt   text nullable                -- ISO date of last learning analysis
```

**`postAnalytics`** — Add columns for learning attribution:
```
promptTemplateId    integer nullable → promptTemplates.id  -- which template produced this post
activeLearningIds   text json nullable                     -- learning IDs injected at generation time
```

---

## Data Flow: Learning Lifecycle

The learning lifecycle is the core loop that makes content self-improving.

```
collectAnalytics() [every 6 hours]
        │
        ▼
postAnalytics rows reclassified (top/average/under per cohort)
        │
        ▼  if (newTopCount + newUnderCount >= 5) per brand
        │
learningEngine.analyzeForBrand(brandId)
        │
        ├── query: top 20 posts (content + qualityDetails)
        ├── query: bottom 10 posts (content + qualityDetails)
        ├── Claude Sonnet call: extract patterns → JSON
        │     { type, description, confidence, supportingPostIds }
        └── write rows to brandLearnings, update brands.lastLearningRunAt
                │
                ▼
prompt-injector.ts called on every generateContent()
        │
        ├── query brandLearnings WHERE brandId = ? AND isActive = 1
        │         AND (platform IS NULL OR platform = ?)
        │         AND confidence IN ('high', 'medium')
        │         ORDER BY validatedAt DESC NULLS LAST
        │         LIMIT 5
        └── format into prompt block → passed to buildSystemPrompt()
                │
                ▼
Content generated with learnings baked in
        │
        ▼
postAnalytics.activeLearningIds recorded → enables A/B validation
```

## Data Flow: Multi-Variant Generation

```
autoGenerate() [every 15 min]
        │
        ▼
processEntry(entry)
        │
        ├── if brand.enableVariants = false: generateContent() [existing]
        └── if brand.enableVariants = true:
                │
                ▼
        generateVariants(brandId, platforms, sourceText, sourceUrl)
                │
                ├── variantGroupId = crypto.randomUUID()
                ├── generateContent() at temperature 0.7  → variant A
                ├── generateContent() at temperature 0.85 → variant B
                ├── generateContent() at temperature 1.0  → variant C
                │   (each with checkAiSpend() guard)
                │
                ├── refineAndGate() for each variant (reuses existing)
                │
                ├── pick winner: highest avg qualityScore across platforms
                │
                ├── save winner: posts row with variantGroup = variantGroupId
                ├── save losers: posts rows with variantOf = winner.postId
                │              variantGroup = variantGroupId
                │              status = 'draft' (hidden from normal views)
                └── winner proceeds through normal automation level routing
```

## Data Flow: Evergreen Recycling

```
recycleContent() [weekly cron, Sunday 2am]
        │
        ▼  per brand where automationLevel != 'manual'
        │
        ▼
query: posts WHERE brandId = ?
         AND status = 'published'
         AND publishedAt < NOW() - 30 days
         AND (recycledFromPostId IS NULL)
         JOIN postAnalytics WHERE performerTier = 'top'
         LEFT JOIN posts recycled ON posts.id = recycled.recycledFromPostId
         WHERE recycled.id IS NULL   -- never been recycled
         OR recycled.publishedAt < NOW() - 90 days  -- recycled 90+ days ago
        │
        ├── pick top 1-3 per brand by engagementScore
        │
        ├── Claude Haiku call per post:
        │     "Write a fresh-angle version of this top performer.
        │      Different hook, same core message. Platform: {platform}."
        │
        └── insert new posts with:
              recycledFromPostId = originalPost.id
              status = 'draft' (semi-auto) or 'scheduled' (full-auto)
```

## Data Flow: Prompt Evolution

```
evolvePrompts() [monthly cron, 1st of month, 4am]
        │
        ▼  per brand with 20+ published posts in last 30 days
        │
        ├── query: current active promptTemplate for brand
        ├── query: postAnalytics WHERE activeLearningIds includes template
        │         (top performers from last 30 days)
        │
        ├── Claude Sonnet call:
        │     "Analyze these top-performing posts.
        │      Current template: {templateText}.
        │      Suggest an improved template that reinforces what works."
        │
        ├── insert new promptTemplates row (version + 1, isActive = 0)
        │
        └── A/B test: 50% of new posts get new template (tracked via promptTemplateId)
              After 14 days:
                compare avg engagementScore for old vs new template
                activate winner, deactivate loser
```

---

## Recommended File Structure (New + Modified Files Only)

```
src/
├── lib/
│   ├── learning-engine.ts      # NEW: weekly analysis, writes brandLearnings
│   ├── prompt-injector.ts      # NEW: loads learnings, formats for prompt injection
│   ├── content-recycler.ts     # NEW: evergreen recycling cron worker
│   ├── repurpose-chain.ts      # NEW: repurposing chain generator
│   ├── prompt-evolution.ts     # NEW: monthly prompt evolution + A/B test runner
│   ├── engagement-helper.ts    # NEW: comment suggestions (blocked on API verification)
│   ├── auto-generate.ts        # MODIFIED: calls generateVariants() when flag enabled
│   ├── collect-analytics.ts    # MODIFIED: triggers learning analysis after threshold
│   └── cron.ts                 # MODIFIED: 3 new cron registrations
├── app/
│   ├── actions/
│   │   ├── generate.ts         # MODIFIED: generateVariants(), learnings in buildSystemPrompt()
│   │   ├── learnings.ts        # NEW: toggleLearning, runAnalysis server actions
│   │   └── repurpose.ts        # NEW: generateRepurposeChain server action
│   └── (dashboard)/
│       └── brands/
│           └── [id]/
│               ├── analytics/
│               │   ├── analytics-charts.tsx   # NEW: client component, Recharts
│               │   └── page.tsx               # MODIFIED: + learnings panel, + chart data
│               └── learnings/
│                   └── page.tsx               # NEW: view/manage brandLearnings
└── db/
    └── schema.ts               # MODIFIED: 3 new tables, columns on 3 existing tables
```

---

## Architectural Patterns

### Pattern 1: Threshold-Gated Analysis Chaining

**What:** `collectAnalytics()` tracks how many new top/under posts were classified in each run.
When the count crosses a threshold per brand, it chains into `learningEngine.analyzeForBrand()`.

**When to use:** When one cron produces data that a second cron consumes, and you want the second
to run only when meaningful data exists. Avoids a separate weekly cron that might find nothing to
analyze.

**Trade-offs:** Slightly longer analytics cron runs (2-5 min extra when learning triggers). Acceptable
at a 6-hour cadence. Hard cap of once per 7 days per brand prevents over-analysis.

```typescript
// At the end of collectAnalytics(), after cohort reclassification:
const brandNewCounts = new Map<number, number>() // brandId → new top+under count
// ... accumulate during reclassification ...

for (const [brandId, newCount] of brandNewCounts) {
  if (newCount >= 5 && shouldRunLearning(brandId)) {
    await analyzeForBrand(brandId)
    await db.update(brands).set({ lastLearningRunAt: new Date().toISOString() })
      .where(eq(brands.id, brandId)).run()
  }
}
```

### Pattern 2: Optional Parameter for Backward-Compatible Prompt Augmentation

**What:** `buildSystemPrompt(brand, learnings?)` accepts an optional learnings array. When provided,
learnings are formatted and appended before the JSON instruction. When absent, behavior is identical
to v1.0.

**When to use:** Any time existing behavior must be preserved while adding new capability. The optional
parameter keeps all callers working without modification until they opt in.

**Trade-offs:** Slight coupling between `generate.ts` and the learnings schema. Acceptable here
because this is a single-process app with no external consumers of this function.

```typescript
function buildSystemPrompt(brand: BrandRow, learnings?: BrandLearning[]): string {
  const parts = [...existingParts]

  if (learnings && learnings.length > 0) {
    parts.push('\nLEARNINGS FROM YOUR TOP PERFORMERS:')
    for (const l of learnings) {
      parts.push(`- [${l.type}] ${l.description}`)
    }
  }

  // Closing instruction always last:
  parts.push('')
  parts.push('Respond with ONLY valid JSON -- no markdown fences, no commentary.')
  return parts.join('\n')
}
```

### Pattern 3: Feature Flags on the Brand Record

**What:** New features that change generation behavior (variants, learning injection) are controlled
by integer columns on the `brands` table (`enableVariants`, `learningInjection`). Both default to 0
(off) in the migration so existing brands are unaffected after deploy.

**When to use:** Any time a new code path changes what goes to external APIs (more Claude calls,
different prompts). Enable per-brand after verifying in production, never all-at-once.

**Trade-offs:** Requires manual per-brand activation via UI or SQL. Adds a small schema migration.
Worth it to avoid a bad rollout silently increasing AI spend or degrading content quality.

### Pattern 4: Variant Winner/Loser Tracking

**What:** All variants from one generation run share a `variantGroup` UUID. The winner has
`variantOf = null`; losers have `variantOf = winner.postId`. Normal post list queries filter
`WHERE variantOf IS NULL` to hide losers from the UI.

**When to use:** Any multi-attempt generation where outcome data should feed future learning.

**Trade-offs:** 3 posts inserted per run instead of 1. Storage cost is negligible (SQLite). Loser
posts exist for analytics purposes only and are hidden from normal views.

---

## Integration Points: New vs. Modified Explicit

### Modified (Extend In Place)

| File | Change | Risk | Notes |
|------|--------|------|-------|
| `src/db/schema.ts` | Add 3 new tables + columns on 3 existing tables | MEDIUM | Requires migration; add columns as nullable or with defaults to keep existing rows valid |
| `src/app/actions/generate.ts` | Add `generateVariants()`, modify `buildSystemPrompt()`, load learnings in `generateContent()` | LOW | All changes are additive; `buildSystemPrompt()` change is backward-compatible via optional param |
| `src/lib/auto-generate.ts` | Call `generateVariants()` instead of `generateContent()` when `brand.enableVariants = 1` | LOW | Gated by feature flag; existing path unchanged |
| `src/lib/collect-analytics.ts` | After cohort reclassification, check threshold and trigger `analyzeForBrand()` | MEDIUM | Adds async latency to analytics cron; needs mutex awareness |
| `src/lib/cron.ts` | Add 3 new cron schedules (weekly, weekly, monthly) | LOW | Additive; existing schedules unchanged |
| `src/app/(dashboard)/brands/[id]/analytics/page.tsx` | Add chart data queries, pass to `AnalyticsCharts` client component; add learnings panel | LOW | Server page remains a server component; client chart component is additive |

### New (Build Fresh)

| File | Depends On |
|------|-----------|
| `src/lib/learning-engine.ts` | `postAnalytics`, `posts`, `brandLearnings` table (new) |
| `src/lib/prompt-injector.ts` | `brandLearnings` table (new) |
| `src/lib/content-recycler.ts` | `postAnalytics`, `posts`, `generateContent()`, `scheduleToNextSlot()` |
| `src/lib/repurpose-chain.ts` | `generateContent()`, `scheduleToNextSlot()` |
| `src/lib/prompt-evolution.ts` | `promptTemplates` table (new), `postAnalytics` |
| `src/lib/engagement-helper.ts` | Upload-Post API comment endpoint (UNVERIFIED — verify first) |
| `src/app/actions/learnings.ts` | `brandLearnings` table (new) |
| `src/app/actions/repurpose.ts` | `repurpose-chain.ts` |
| `src/app/(dashboard)/brands/[id]/learnings/page.tsx` | `brandLearnings` table (new), `learnings.ts` actions |
| `analytics-charts.tsx` client component | Recharts library, data from server page |

---

## Build Order (Dependency-Respecting)

### Phase 1 — Schema Foundation

Build first. No other phase can start until migrations land and existing code keeps working.

- Add `brandLearnings` table (all columns)
- Add `promptTemplates` table (all columns)
- Add `commentSuggestions` table (all columns — can build even if engagement helper is deferred)
- Add columns to `posts`: `recycledFromPostId`, `variantGroup`, `variantOf`, `repurposeChainId`
- Add columns to `brands`: `enableVariants` (default 0), `learningInjection` (default 1), `lastLearningRunAt`
- Add columns to `postAnalytics`: `promptTemplateId`, `activeLearningIds`

Verify: existing cron jobs and pages still work after migration.

### Phase 2 — Learning Engine (Core Intelligence)

Build second. This is the loop that all other features either feed or consume. Nothing downstream
needs the others to be working, but everything benefits from learnings being active.

1. `learning-engine.ts` — analysis + `brandLearnings` writes
2. `prompt-injector.ts` — loads learnings, formats for injection
3. Modify `buildSystemPrompt()` in `generate.ts` — accepts learnings param
4. Modify `generateContent()` in `generate.ts` — loads + passes learnings (calls `prompt-injector`)
5. Modify `collectAnalytics()` — threshold check + trigger analysis
6. Add weekly learning cron in `cron.ts`
7. `src/app/actions/learnings.ts` — `toggleLearning()`, `manualRunAnalysis()` server actions
8. `src/app/(dashboard)/brands/[id]/learnings/page.tsx` — view active learnings, toggle on/off

Verify: learning analysis runs, learnings appear in prompt, UI shows them.

### Phase 3 — Multi-Variant Generation

Build third. Depends on Phase 1 (schema) and benefits from Phase 2 (learnings injected into all
3 variants). Independent of Phases 4 and 5.

1. `generateVariants()` in `generate.ts`
2. Modify `autoGenerate()` in `auto-generate.ts` — call variants when `brand.enableVariants = 1`
3. Add `enableVariants` toggle to brand edit UI (`/brands/[id]/edit`)

Verify: generate 3 variants, confirm winner selected correctly, losers saved with `variantOf` set.

### Phase 4 — Content Recycling + Repurposing

Build fourth. Depends on Phase 1 (schema). Independent of Phases 2, 3, 5. Can be built in parallel
with Phase 3 if needed.

1. `content-recycler.ts` — evergreen recycling cron worker
2. `repurpose-chain.ts` — chain generator
3. `src/app/actions/repurpose.ts` — `generateRepurposeChain()` server action
4. Add "Repurpose as Chain" UI to `/brands/[id]/generate`
5. Add weekly recycle cron in `cron.ts`

Verify: recycled posts appear with `recycledFromPostId` set; chain posts have staggered `scheduledAt`.

### Phase 5 — Prompt Evolution

Build fifth. Depends on Phase 2 (learning data and `postAnalytics.activeLearningIds` tracking).
Depends on Phase 1 (`promptTemplates` table).

1. `prompt-evolution.ts` — monthly analysis + template suggestion
2. Integrate template selection into `generateContent()` (50/50 A/B routing)
3. A/B result evaluation after 14 days (can be a manual action initially)
4. Add prompt template version history to learnings page

Verify: new template version created monthly, `promptTemplateId` tracked on `postAnalytics`.

### Phase 6 — Advanced Analytics

Build sixth. Depends on Phase 2 (learnings to display). Reads `postAnalytics` which already exists.
Can be built independently of Phases 3-5 if chart features are wanted sooner.

1. Install Recharts: `npm install recharts`
2. `analytics-charts.tsx` client component (engagement over time, platform comparison, time heatmap)
3. Extend analytics server page with chart data queries + learnings panel
4. Posting time heatmap: correlate `posts.scheduledAt` hour with `postAnalytics.engagementScore`

Verify: charts render with real data, heatmap shows best posting hours.

### Phase 7 — Engagement Helper

Build last. Blocked on external verification.

**BLOCKER:** Verify Upload-Post API returns individual comment text (not just counts). The current
`collect-analytics.ts` only uses the post metrics endpoint. If comments endpoint doesn't expose text,
this entire feature is not buildable with the current stack.

If API supports it:
1. `engagement-helper.ts` — fetch comments, AI suggest replies
2. `commentSuggestions` table writes
3. "Action Items" card on brand home page
4. Add cron entry to `cron.ts` (piggyback on analytics 6-hour cadence)

---

## Anti-Patterns

### Anti-Pattern 1: Loading Learnings Into In-Memory Cache

**What people do:** Query `brandLearnings` at startup, store in a module-level Map, skip DB calls.
**Why it's wrong:** The analytics cron writes new learnings to SQLite every 6 hours. A cached copy
doesn't reflect these updates until process restart. Railway redeploys daily, but between redeploys
the cache is always stale.
**Do this instead:** Query `brandLearnings` synchronously in `prompt-injector.ts` on every
`generateContent()` call. SQLite indexed lookup by `brandId` with `isActive = 1` takes < 1ms. No
caching needed.

### Anti-Pattern 2: Injecting All Learnings Without Filtering

**What people do:** Dump all active `brandLearnings` into the prompt regardless of platform, recency,
or confidence.
**Why it's wrong:** A LinkedIn learning about long-form structure breaks Twitter character limit
awareness. Low-confidence learnings add noise. Prompt token bloat at ~200 tokens per learning
costs money and can degrade Claude output quality by diluting the core brand instructions.
**Do this instead:** Filter by `platform IS NULL OR platform = ?`, `confidence IN ('high', 'medium')`,
`ORDER BY validatedAt DESC NULLS LAST`, `LIMIT 5`. Five learnings inject cleanly and cost ~100-200
extra tokens per generation call.

### Anti-Pattern 3: Making All Variants Visible in Post Lists

**What people do:** Save variant posts as normal drafts; show all 3 in the brand post list.
**Why it's wrong:** Users see 3 near-identical draft posts for every auto-generated article.
Approval UI is confusing. Which one did the engine pick? Why are there 3?
**Do this instead:** Filter `WHERE variantOf IS NULL` in every post list query. Losing variants
exist in the DB for analytics, but are invisible to the user. Add a "View alternatives" affordance
only on the winning post if needed.

### Anti-Pattern 4: Running Learning Analysis Every Analytics Cycle

**What people do:** Trigger `analyzeForBrand()` after every `collectAnalytics()` run.
**Why it's wrong:** At 6-hour cadence, that's 4 Sonnet calls per day per brand. At production
pricing ($3/M input tokens, typically ~4K tokens per analysis), that's ~$0.05/day/brand. Fine for
one brand, problematic at scale. More importantly, learning from 0-2 new data points produces
noise, not signal.
**Do this instead:** Threshold gate (5+ new top/under posts) AND time gate (max once per 7 days per
brand via `brands.lastLearningRunAt`). The weekly cron is also a fallback for brands where the
threshold is never hit.

### Anti-Pattern 5: Activating Evolved Prompt Templates Immediately

**What people do:** Generate an improved template with Claude, immediately set `isActive = 1`,
discard old template.
**Why it's wrong:** Claude's template suggestion is based on past data but may not actually improve
future content. No evidence it's better until tested. Discarding the old template means no rollback.
**Do this instead:** A/B test new templates via the `promptTemplateId` column on `postAnalytics`.
Route 50% of new posts to new template, track average engagement for each group over 14 days.
Automatically activate the winner. Keep old template rows for historical reference.

---

## Scaling Considerations

This is a single-user personal tool. Infrastructure scaling is not a concern. The binding constraint
is AI spend.

| Concern | v1.0 | v2.0 Impact |
|---------|------|-------------|
| AI cost per day (testing mode) | ~$1-4 | +$0.10-0.50 learning analysis; +3x if variants enabled (major) |
| AI cost per day (production mode) | ~$8-15 | +$0.50-1.50 learning; +3x generation cost with variants |
| SQLite DB size | ~1-5 MB | +brandLearnings (~5 KB/brand), +variant posts (~1 KB each) — negligible |
| Cron job count | 5 jobs | 8 jobs — still simple, no separate scheduler |
| Node process memory | ~200-400 MB | Unchanged — no in-memory caches added by design |
| Analytics page query time | ~10-50ms | Analytics charts add 2-3 extra queries — still fast |

**Cost mitigation for variants:** Only enable `enableVariants = 1` for brands on full-auto where
quality matters most. Keep semi-auto brands on single generation. At 5 entries/day per brand, 3
variants = 15 Sonnet calls instead of 5 — manageable but not free.

---

## Integration Points: External Services

| Service | v1.0 Usage | v2.0 Changes |
|---------|-----------|--------------|
| Claude (Anthropic) | Generation, critique, hook scoring, relevance filter | + Learning analysis (weekly, Sonnet), + fresh-angle recycling (Haiku), + prompt evolution (Sonnet) |
| Upload-Post | Publishing, analytics metrics | + Comment fetch (Phase 7 — UNVERIFIED support) |
| OpenAI | Image generation | None |
| Cloudflare R2 | Images + DB backup | None |

---

## Sources

- Direct codebase inspection: `src/db/schema.ts`, `src/lib/auto-generate.ts`, `src/lib/collect-analytics.ts`, `src/lib/cron.ts`, `src/lib/ai.ts`
- `src/app/actions/generate.ts` — full generation + refine pipeline
- `src/app/(dashboard)/brands/[id]/analytics/page.tsx` — existing analytics page
- `src/app/(dashboard)/brands/[id]/page.tsx` — brand home page structure
- `.planning/PROJECT.md` — v2.0 feature list and constraints

---
*Architecture research for: Social Content Engine v2.0 Intelligence Layer*
*Researched: 2026-03-19*
