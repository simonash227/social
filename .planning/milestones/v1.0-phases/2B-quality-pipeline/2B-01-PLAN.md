---
phase: 2B-quality-pipeline
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/db/schema.ts
  - src/db/migrations/0002_quality_details.sql
  - src/app/actions/generate.ts
autonomous: true
requirements:
  - QUAL-01
  - QUAL-02
  - QUAL-03
  - QUAL-04
  - QUAL-05

must_haves:
  truths:
    - "refineAndGate() critiques generated content on 5 dimensions and returns scores"
    - "Content scoring >= 8 skips the rewrite step entirely"
    - "Content scoring 5-6 triggers exactly one re-refine retry"
    - "Content scoring < 5 is marked as discarded with a reason"
    - "Quality scores are stored on saved posts in both qualityScore and qualityDetails columns"
    - "Every API call logs cost via logAiSpend()"
  artifacts:
    - path: "src/db/schema.ts"
      provides: "qualityDetails JSON text column on posts table"
      contains: "qualityDetails"
    - path: "src/db/migrations/0002_quality_details.sql"
      provides: "ALTER TABLE migration for quality_details column"
      contains: "quality_details"
    - path: "src/app/actions/generate.ts"
      provides: "refineAndGate function, CritiqueResult type, RefinedGenerationResult type, updated saveGeneratedPosts"
      exports: ["refineAndGate", "RefinedGenerationResult"]
  key_links:
    - from: "src/app/actions/generate.ts (refineAndGate)"
      to: "getBreaker('anthropic').call()"
      via: "circuit breaker wrapping every Anthropic API call"
      pattern: "getBreaker.*anthropic.*call"
    - from: "src/app/actions/generate.ts (refineAndGate)"
      to: "logAiSpend()"
      via: "cost logging after every API call"
      pattern: "logAiSpend"
    - from: "src/app/actions/generate.ts (saveGeneratedPosts)"
      to: "posts.qualityScore + posts.qualityDetails"
      via: "insert values with quality data"
      pattern: "qualityScore.*qualityDetails"
---

<objective>
Add the quality pipeline backend: schema migration for qualityDetails, the refineAndGate() orchestrator function with critique/rewrite/gate logic, and saveGeneratedPosts() extension.

Purpose: This is the core quality assurance layer between AI generation and draft saving. Every generated post will be critiqued on 5 dimensions, optionally rewritten, and routed through a quality gate before saving.

Output: refineAndGate() server action ready for UI wiring, qualityDetails column available in DB, saveGeneratedPosts() accepting quality data.
</objective>

<execution_context>
@C:/Users/simon/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/simon/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/2B-quality-pipeline/2B-CONTEXT.md
@.planning/phases/2B-quality-pipeline/2B-RESEARCH.md

@src/app/actions/generate.ts
@src/db/schema.ts
@src/lib/ai.ts
@src/lib/circuit-breaker.ts

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

From src/app/actions/generate.ts:
```typescript
export interface GenerationResult {
  platforms: Record<string, {
    content: string
    hookVariants: Array<{ text: string; score: number }>
    winningHook: string
  }>
  totalCostUsd: number
  error?: string
}

// Internal helpers available in same file:
function parseJsonResponse<T>(text: string): T
function calculateCostUsd(model: string, inputTokens: number, outputTokens: number): string
function buildSystemPrompt(brand: BrandRow): string
const anthropic: Anthropic  // module-level client
```

From src/lib/ai.ts:
```typescript
export interface ModelConfig {
  primary: string    // Opus in production, Sonnet in testing
  critique: string   // Sonnet in production, Haiku in testing
  filter: string
}
export function getModelConfig(): ModelConfig
export function checkAiSpend(): Promise<boolean>
export function logAiSpend(params: { brandId?: number; model: string; inputTokens: number; outputTokens: number; costUsd: string }): void
```

From src/lib/circuit-breaker.ts:
```typescript
export function getBreaker(service: string): CircuitBreaker
// Usage: await getBreaker('anthropic').call(() => anthropic.messages.create({...}))
```

From src/db/schema.ts:
```typescript
export const posts = sqliteTable('posts', {
  // ... existing columns
  qualityScore: integer('quality_score'),  // ALREADY EXISTS, nullable
  // qualityDetails: NOT YET ADDED -- this plan adds it
})

export const activityLog = sqliteTable('activity_log', {
  brandId: integer('brand_id'),
  type: text().notNull(),        // use 'quality' for pipeline events
  level: text({ enum: ['info', 'warn', 'error'] }),
  message: text().notNull(),
  metadata: text({ mode: 'json' }),
})
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add qualityDetails column to posts schema and generate migration</name>
  <files>src/db/schema.ts, src/db/migrations/0002_quality_details.sql</files>
  <action>
1. In `src/db/schema.ts`, add `qualityDetails` column to the `posts` table definition, right after `qualityScore`:
   ```
   qualityDetails: text('quality_details', { mode: 'json' }).$type<QualityDetails | null>(),
   ```

2. Define the `QualityDetails` type above the `posts` table (exported for use in generate.ts):
   ```typescript
   export interface QualityDetails {
     hook:        { score: number; note: string }
     value:       { score: number; note: string }
     voice:       { score: number; note: string }
     uniqueness:  { score: number; note: string }
     platformFit: { score: number; note: string }
   }
   ```

3. Run `npx drizzle-kit generate` to create the migration file. If the generated file name differs from `0002_quality_details.sql`, that is fine -- drizzle-kit names them automatically. The critical thing is that a new SQL file appears in `src/db/migrations/` containing `ALTER TABLE posts ADD quality_details text`.

4. Verify the migration file content is correct (single ALTER TABLE statement).

IMPORTANT: Do NOT change any other column definitions. Only add the new column and type.
  </action>
  <verify>
    <automated>npx tsc --noEmit && ls src/db/migrations/0002_*.sql</automated>
  </verify>
  <done>QualityDetails type exported from schema.ts, qualityDetails column defined on posts table, migration SQL file exists with ALTER TABLE statement.</done>
</task>

<task type="auto">
  <name>Task 2: Implement refineAndGate() and extend saveGeneratedPosts()</name>
  <files>src/app/actions/generate.ts</files>
  <action>
Add the following to `src/app/actions/generate.ts`. Do NOT modify the existing `generateContent()` function.

**New types (add after existing GenerationResult interface):**

```typescript
interface CritiqueResult {
  dimensions: QualityDetails
  overallScore: number
  weakestDimension: string
}

export interface RefinedGenerationResult {
  platforms: Record<string, {
    content: string
    hookVariants: Array<{ text: string; score: number }>
    winningHook: string
    qualityScore: number
    qualityDetails: QualityDetails
    qualityWarning?: string
    discarded?: true
    discardReason?: string
  }>
  totalCostUsd: number
  error?: string
}
```

Import `QualityDetails` from `@/db/schema`.

**New internal helper functions:**

1. `buildCritiquePrompt(platform: string, content: string, brandVoice: string): string`
   - Prompts the critique model to score the content on 5 dimensions (hook, value, voice, uniqueness, platformFit)
   - Each dimension: integer score 1-10 and a brief note
   - Request JSON with a `dimensions` object only (overall score computed in TypeScript)
   - Include the platform name and brand voice context for accurate scoring

2. `buildRewritePrompt(platform: string, originalContent: string, critique: CritiqueResult, brandSystemPrompt: string): string`
   - Tells the rewrite model to improve dimensions scored below 7 while preserving those scored 8+
   - Includes original content, dimension scores + notes, and platform constraints
   - Requests plain text output (not JSON) -- just the rewritten post

3. `computeOverallScore(dimensions: QualityDetails): number`
   - Returns `Math.round((hook + value + voice + uniqueness + platformFit) / 5)`

4. `findWeakestDimension(dimensions: QualityDetails): string`
   - Returns the key of the lowest-scoring dimension

5. `async runCritique(brandId: number, platform: string, content: string, brandVoice: string): Promise<CritiqueResult>`
   - Builds critique prompt
   - Calls `getBreaker('anthropic').call(() => anthropic.messages.create({...}))` using `getModelConfig().critique`
   - Uses `parseJsonResponse()` to extract the dimensions JSON
   - Calls `logAiSpend()` with the cost
   - Computes overall score via `computeOverallScore()`
   - Finds weakest dimension via `findWeakestDimension()`
   - Returns CritiqueResult
   - On parse failure: returns a fallback CritiqueResult with all dimensions scored 7 and note "Critique parse error -- fallback pass" (do NOT throw -- this avoids blocking the user per research anti-pattern guidance)

6. `async runRewrite(brandId: number, platform: string, originalContent: string, critique: CritiqueResult, brand: BrandRow): Promise<{ content: string; costUsd: number }>`
   - Builds system prompt via `buildSystemPrompt(brand)` and rewrite user prompt
   - Calls `getBreaker('anthropic').call(...)` using `getModelConfig().primary`
   - Calls `logAiSpend()` with the cost
   - Returns the rewritten content (plain text, stripped/trimmed) and cost

**Main exported function `refineAndGate()`:**

```typescript
export async function refineAndGate(
  brandId: number,
  generated: GenerationResult
): Promise<RefinedGenerationResult>
```

Logic per platform (loop over `Object.entries(generated.platforms)`):

1. Query brand from DB (same pattern as `generateContent()`)
2. Check AI spend limit via `checkAiSpend()` -- if over, return error
3. For each platform:
   a. Run initial critique via `runCritique()`
   b. **Conditional skip (QUAL-02):** If overallScore >= 8, skip rewrite. Log to activityLog: type='quality', level='info', message='Self-refine skipped: initial score {score}/10 for {platform}'. Use the initial critique scores as the final scores.
   c. **Self-refine (QUAL-01):** If overallScore < 8, run rewrite via `runRewrite()`, then re-critique the rewritten content via `runCritique()`.
   d. **Quality gate routing (QUAL-04):**
      - Score >= 7: Pass. Log type='quality', level='info', message='Quality gate passed: score {score}/10 for {platform}'.
      - Score 5-6 AND not yet retried: Re-refine one more time (rewrite + re-critique). Use a `let retried = false` flag per platform. After retry, if still 5-6, pass with `qualityWarning: 'Passed after retry with marginal score {score}/10'`. Log type='quality', level='warn'.
      - Score < 5: Mark as discarded. Set `discarded: true` and `discardReason` to the weakest dimension's note. Log type='quality', level='warn', message='Content discarded: score {score}/10 for {platform}, reason: {note}'.
4. Accumulate total cost across all API calls
5. Return `RefinedGenerationResult`

**Activity logging:** Use `db.insert(activityLog).values({...}).run()` (synchronous `.run()`, matching the pattern in generate.ts, NOT `await db.insert(...)` which is the async pattern from cron.ts).

**Cost tracking:** Every `anthropic.messages.create()` call MUST be followed by `calculateCostUsd()` + `logAiSpend()`. Accumulate into a running `totalCost` number.

**Extend `saveGeneratedPosts()`:**

Add an optional `qualityData` parameter:
```typescript
export async function saveGeneratedPosts(
  brandId: number,
  platformContents: Record<string, string>,
  sourceText: string,
  sourceUrl: string,
  qualityData?: Record<string, { score: number; details: QualityDetails }>
): Promise<{ error?: string }>
```

In the insert statement, use:
```typescript
qualityScore: qualityData?.[platformKeys[0]]?.score ?? null,
qualityDetails: qualityData?.[platformKeys[0]]?.details ?? null,
```

This is backward-compatible -- existing callers without qualityData still work.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
- refineAndGate() exported and type-checks
- CritiqueResult and RefinedGenerationResult types defined
- All API calls wrapped in circuit breaker + cost tracking
- Conditional skip at score >= 8
- Re-refine retry at score 5-6 with max 1 retry
- Discard at score < 5 with reason
- Activity log entries at every routing decision
- saveGeneratedPosts() accepts optional qualityData parameter
- Existing generateContent() and saveGeneratedPosts() behavior unchanged
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. Migration file exists in `src/db/migrations/` with ALTER TABLE for quality_details
3. `refineAndGate` is exported from `src/app/actions/generate.ts`
4. `RefinedGenerationResult` type is exported
5. `saveGeneratedPosts` accepts optional quality data parameter
</verification>

<success_criteria>
- TypeScript compiles cleanly
- refineAndGate() handles all 4 routing paths: skip (>= 8), pass (>= 7), re-refine (5-6), discard (< 5)
- Every Anthropic API call is wrapped in circuit breaker and logs cost
- qualityDetails column added to schema and migration generated
- saveGeneratedPosts() backward-compatible with new quality data parameter
</success_criteria>

<output>
After completion, create `.planning/phases/2B-quality-pipeline/2B-01-SUMMARY.md`
</output>
