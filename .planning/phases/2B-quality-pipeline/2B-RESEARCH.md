# Phase 2B: Quality Pipeline - Research

**Researched:** 2026-03-17
**Domain:** Multi-pass AI critique + rewrite pipeline, TypeScript server actions, drizzle-orm schema migrations
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Self-refine loop (QUAL-01)**
- After `generateContent()` produces per-platform content, run a self-refine pass
- Critique call: use `getModelConfig().critique` (Sonnet in production, Haiku in testing)
- Score 5 dimensions: Hook, Value, Voice, Uniqueness, Platform fit — each 1-10 with critique note
- Overall score = average of 5 dimensions, rounded to nearest integer
- Rewrite call: use `getModelConfig().primary` (Opus in production, Sonnet in testing)
- Rewrite prompt includes: original content, dimension scores, critique notes, instruction to improve weak areas

**Conditional skip (QUAL-02)**
- If initial critique scores ≥ 8 overall, skip the rewrite entirely
- Original content passes through unchanged
- Log the skip decision to `activityLog` for observability

**Quality gate scoring (QUAL-03)**
- After self-refine (or skip), run a final quality gate using same critique model
- If self-refine was skipped (score ≥ 8), reuse initial scores as gate scores (no re-score)
- If self-refine ran, re-score the rewritten content

**Quality gate routing (QUAL-04)**
- Score ≥ 7: Pass — content proceeds as draft, quality score stored
- Score 5-6: Re-refine — run self-refine one more time (max 1 retry), then re-score; if still 5-6 after retry, pass with warning flag
- Score < 5: Discard — do not save, return error with reason (lowest-scoring dimension's critique note)
- Logic lives in a `qualityPipeline()` function that wraps the existing flow

**Quality score storage (QUAL-05)**
- Store final overall score (1-10 integer) in `posts.qualityScore` (column already exists)
- Store per-dimension scores in `posts.qualityDetails` — a new JSON text column on the posts table

**Integration with Phase 2A**
- `generateContent()` remains unchanged
- New `refineAndGate()` function: takes generated content, runs self-refine + quality gate, returns refined content with scores
- Generation page calls `refineAndGate()` after `generateContent()` before displaying results
- Loading state shows "Refining..." after "Generating..."
- Discarded content (< 5): show error with reason, offer to try again

**Cost tracking**
- Each critique and rewrite call logs spend via existing `logAiSpend()`
- 2-4 extra API calls per generation depending on path taken

### Claude's Discretion
- Exact prompt wording for critique and rewrite calls
- How to structure the critique JSON response format
- Whether to show quality scores in the UI during preview or just store them
- Error handling for malformed critique responses
- Whether the quality pipeline runs per-platform or on all platforms at once

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QUAL-01 | Self-refine loop: generate → Sonnet critique (5 dimensions) → Opus rewrite | Two-pass Claude pattern already in `generateContent()` — extend with critique + rewrite steps using same circuit breaker + logAiSpend pattern |
| QUAL-02 | Self-refine is conditional: skip if first draft quality gate scores ≥ 8 | Simple integer comparison on averaged dimension scores; log skip to activityLog using existing pattern from cron.ts |
| QUAL-03 | Quality gate: Sonnet scores each post 1-10 on hook, value, voice, uniqueness, platform fit | Reuse critique model (`getModelConfig().critique`) with a structured JSON prompt; reuse `parseJsonResponse()` for defensiveness |
| QUAL-04 | Quality gate routing: ≥ 7 pass, 5-7 trigger re-refine, < 5 discard | Pure TypeScript conditional logic inside `refineAndGate()`; max 1 retry enforced by a retry counter |
| QUAL-05 | Quality score stored on each post | `posts.qualityScore` integer column already exists; add `posts.qualityDetails` text(json) column via new drizzle migration |
</phase_requirements>

---

## Summary

Phase 2B adds a quality assurance layer between AI generation and draft saving. The work is entirely backend — a new `refineAndGate()` server action that wraps generated content, runs a multi-pass critique/rewrite loop using existing AI infrastructure, and routes the result based on score. No new pages are needed; the only UI change is a loading state update and a discard error path in `generate-section.tsx`.

The existing `generate.ts` establishes the exact pattern this phase extends: circuit-breaker-wrapped Anthropic calls, `parseJsonResponse()` for defensive JSON extraction, `calculateCostUsd()` + `logAiSpend()` for cost tracking, and structured prompt building. The quality pipeline is a third and fourth call in the same style — a critique call and optionally a rewrite call — with branching logic based on scores.

The only schema change required is a new `qualityDetails` text(json) column on the `posts` table. The `qualityScore` integer column already exists. The `saveGeneratedPosts()` action needs to accept and store both fields when called after refinement.

**Primary recommendation:** Add `refineAndGate()` to `src/app/actions/generate.ts` alongside the existing actions, following the established two-pass pattern exactly. The function takes a `GenerationResult` (the output of `generateContent()`), processes each platform's content through critique → optional rewrite → quality gate, and returns a `RefinedGenerationResult` with final content, scores, and routing metadata.

---

## Standard Stack

### Core — All Already Installed

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | installed | Claude API calls for critique + rewrite | Already used in generate.ts |
| `drizzle-orm` | 0.45.1 | Schema migrations + DB queries | Project standard |
| `better-sqlite3` | 12.8.0 | SQLite driver | Project standard |

No new packages needed for this phase.

**Installation:**
```bash
# Nothing to install — all dependencies already present
```

---

## Architecture Patterns

### File Structure

This phase touches only existing files plus one new migration:

```
src/
├── app/
│   └── actions/
│       └── generate.ts            # ADD: refineAndGate(), RefinedGenerationResult type
│   └── (dashboard)/brands/[id]/generate/
│       └── generate-section.tsx   # UPDATE: call refineAndGate(), add "Refining..." state
├── db/
│   ├── schema.ts                  # ADD: qualityDetails column to posts
│   └── migrations/
│       └── 0002_quality_details.sql  # NEW: ALTER TABLE posts ADD quality_details
```

### Pattern 1: Two-Pass AI Call Chain (established by generateContent())

**What:** Multiple sequential Anthropic API calls, each wrapped in circuit breaker, each logging cost. The second call receives output from the first.

**When to use:** All critique and rewrite calls in this phase.

**Example (from existing generate.ts):**
```typescript
// Source: src/app/actions/generate.ts lines 220-278
const genResponse = await getBreaker('anthropic').call(() =>
  anthropic.messages.create({
    model: modelConfig.primary,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })
)
const genText = genResponse.content[0].type === 'text' ? genResponse.content[0].text : ''
const result = parseJsonResponse<T>(genText)
const cost = calculateCostUsd(modelConfig.primary, genResponse.usage.input_tokens, genResponse.usage.output_tokens)
logAiSpend({ brandId, model: modelConfig.primary, inputTokens: ..., outputTokens: ..., costUsd: cost })
```

Every critique and rewrite call in `refineAndGate()` follows this exact shape.

### Pattern 2: Activity Log for Observability

**What:** `activityLog` table entries written for significant decisions (skip, pass, re-refine, discard).

**When to use:** At each routing decision in the quality gate.

**Example (from src/lib/cron.ts and src/app/actions/accounts.ts):**
```typescript
// Source: src/lib/cron.ts line 22
await db.insert(activityLog).values({
  brandId,
  type: 'quality',
  level: 'info',
  message: 'Self-refine skipped: initial score 9/10',
  metadata: { score: 9, platform: 'linkedin' },
})
```

Use `type: 'quality'` for all quality pipeline log entries. Use `level: 'warn'` for discard events.

### Pattern 3: Per-Platform Processing Loop

**What:** The quality pipeline runs per-platform, not on all platforms at once. This matches how generateContent() handles platforms as a `Record<string, {...}>` and processes them in a `for (const platform of platforms)` loop.

**Why per-platform:**
- Each platform has different norms — "Platform fit" dimension requires platform-specific scoring
- Discarding/flagging can be per-platform without nuking other platforms
- Matches the established Record<string, PlatformData> shape of GenerationResult

**Pattern:**
```typescript
for (const [platform, platformData] of Object.entries(generatedContent.platforms)) {
  const critiqueResult = await runCritique(platform, platformData.content, brandId)
  // ... per-platform routing
  refined.platforms[platform] = { ...result, qualityScore: critiqueResult.overallScore }
}
```

### Pattern 4: Critique JSON Response Shape

**What:** The critique model returns a structured JSON with per-dimension scores and notes, plus an overall score.

**Recommended shape (Claude's discretion — see constraints):**
```typescript
interface CritiqueResult {
  dimensions: {
    hook:         { score: number; note: string }
    value:        { score: number; note: string }
    voice:        { score: number; note: string }
    uniqueness:   { score: number; note: string }
    platformFit:  { score: number; note: string }
  }
  overallScore: number  // Math.round(average of 5 dimension scores)
  weakestDimension: keyof CritiqueResult['dimensions']  // for discard reason
}
```

The `weakestDimension` field makes the discard-reason lookup O(1) rather than requiring a re-scan.

### Pattern 5: refineAndGate() Function Signature

**What:** The main orchestrator function.

```typescript
export interface RefinedGenerationResult {
  platforms: Record<string, {
    content: string
    hookVariants: Array<{ text: string; score: number }>
    winningHook: string
    qualityScore: number
    qualityDetails: {
      hook:        { score: number; note: string }
      value:       { score: number; note: string }
      voice:       { score: number; note: string }
      uniqueness:  { score: number; note: string }
      platformFit: { score: number; note: string }
    }
    qualityWarning?: string  // set if passed after retry at 5-6
    discarded?: true         // set if score < 5
    discardReason?: string   // lowest-scoring dimension's note
  }>
  totalCostUsd: number
  error?: string
}

export async function refineAndGate(
  brandId: number,
  generated: GenerationResult
): Promise<RefinedGenerationResult>
```

The function is additive — it takes the existing `GenerationResult` and returns an extended version that includes quality data. The `saveGeneratedPosts()` action needs a parallel update to accept and persist `qualityScore` + `qualityDetails`.

### Pattern 6: saveGeneratedPosts() Extension

The existing `saveGeneratedPosts()` ignores quality data entirely (`qualityScore: null`). It needs a new optional parameter to accept per-platform quality data:

```typescript
export async function saveGeneratedPosts(
  brandId: number,
  platformContents: Record<string, string>,
  sourceText: string,
  sourceUrl: string,
  qualityData?: Record<string, { score: number; details: object }>  // NEW
): Promise<{ error?: string }>
```

Quality data is optional so the function remains backward-compatible if called without refinement (e.g., in future automation pipeline before refinement is wired up there).

### Anti-Patterns to Avoid

- **Running critique on all platforms in a single call:** The "Platform fit" dimension is meaningless without platform-specific context. Run per-platform.
- **Retrying more than once at score 5-6:** CONTEXT.md is explicit — max 1 retry. A second retry loop would add unbounded latency and cost.
- **Throwing on malformed critique JSON:** `parseJsonResponse()` already throws — catch at the `refineAndGate()` level and treat malformed critique as a fallback pass (score 7) to avoid blocking the user.
- **Re-scoring when self-refine was skipped:** CONTEXT.md says reuse the initial scores when score ≥ 8. No second critique call.
- **Changing generateContent():** It must remain unchanged. `refineAndGate()` is called after it, not inside it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON extraction from Claude | Custom regex parser | `parseJsonResponse()` (already in generate.ts) | Handles markdown fences, already tested |
| Cost tracking | New cost DB table | `logAiSpend()` + `calculateCostUsd()` | Already wired up, same pattern |
| API error handling | Try/catch per call | `getBreaker('anthropic').call()` | Circuit breaker already handles failure thresholds |
| Model selection | Hardcoded model strings | `getModelConfig().critique` / `.primary` | Respects AI_MODE env var automatically |
| DB migrations | Manual ALTER TABLE in code | `drizzle-kit generate` + migration file | Project already has migration runner wired into `getDb()` |
| Score averaging | Floating-point accumulator | `Math.round((a+b+c+d+e) / 5)` | Trivial — no library needed |

**Key insight:** The entire infrastructure for this phase exists. The work is prompt engineering + orchestration logic + one migration, not new infrastructure.

---

## Common Pitfalls

### Pitfall 1: activityLog insert is async but cron.ts uses `await`

**What goes wrong:** Forgetting that `db.insert(activityLog).values({...})` returns a Promise in drizzle-orm with the async driver — dropping the `await` means the insert fires but errors are silently swallowed.

**Why it happens:** The pattern in `generate.ts` uses synchronous `.run()` for inserts (better-sqlite3 is synchronous), but `activityLog` inserts in `cron.ts` use `await`. The difference is that `generate.ts` uses the sync better-sqlite3 driver directly, while cron.ts wraps with async.

**How to avoid:** Look at the existing insert patterns in `generate.ts` — they use `.run()` (synchronous). Follow the same pattern in `refineAndGate()` since it's a server action using the same getDb() singleton. Use `.run()` not `await db.insert(...)`.

**Warning signs:** TypeScript won't catch this — test by checking activityLog entries actually appear after a generation.

### Pitfall 2: Discarded posts still showing in UI

**What goes wrong:** If `refineAndGate()` returns `discarded: true` for a platform but the generate-section renders results anyway, the user sees content that wasn't supposed to be saved.

**Why it happens:** The generate-section currently blindly renders `result.platforms` — it needs to filter out discarded platforms and show the discard reason.

**How to avoid:** In generate-section, check `platformData.discarded` before rendering the content tab. Show a styled error card instead of a textarea for discarded platforms.

### Pitfall 3: Critique prompt returns overallScore outside 1-10

**What goes wrong:** LLM returns `overallScore: 8.4` (float) or `overallScore: null` instead of integer.

**Why it happens:** Prompt instructs averaging 5 scores but doesn't enforce integer output.

**How to avoid:** Compute `overallScore` in TypeScript code (`Math.round(avg)`) rather than asking the model to compute it. Ask only for the 5 dimension scores + notes in the JSON. This is more reliable than trusting the model's arithmetic.

### Pitfall 4: drizzle migration not re-run after schema.ts change

**What goes wrong:** Adding `qualityDetails` to `schema.ts` without generating a new migration file means the column doesn't exist in SQLite, causing a runtime error on first insert.

**Why it happens:** drizzle-orm requires explicit migration generation (`drizzle-kit generate`). The migration runner at `getDb()` only runs existing migration files.

**How to avoid:** After editing `schema.ts`, run `npx drizzle-kit generate` to create the new migration SQL file. Commit both `schema.ts` and the new migration file together.

**Warning signs:** `SqliteError: table posts has no column named quality_details` at runtime.

### Pitfall 5: Re-refine retry creating infinite loop

**What goes wrong:** If the retry guard is missing or wrong, a score of 5-6 could trigger unlimited retries.

**Why it happens:** Easy to write `while (score < 7)` instead of `if (retryCount === 0 && score < 7)`.

**How to avoid:** Use a boolean flag or integer counter (`let retried = false`). After one retry, pass with warning regardless of score. CONTEXT.md is explicit: max 1 retry.

### Pitfall 6: Cost tracking skipped for refine/rewrite calls

**What goes wrong:** The pipeline runs 2-4 extra API calls but only the original `generateContent()` cost is tracked, leading to understated daily spend and wrong spend-limit calculations.

**Why it happens:** It's easy to forget `logAiSpend()` calls for the new critique/rewrite calls.

**How to avoid:** `logAiSpend()` must be called immediately after every `anthropic.messages.create()` call, exactly as in `generateContent()`. Total cost accumulates in a running `totalCost` variable.

---

## Code Examples

### Critique Prompt Structure

```typescript
// Claude's discretion area — recommended approach
function buildCritiquePrompt(platform: string, content: string, brandVoice: string): string {
  return [
    `Score the following ${platform.toUpperCase()} post on 5 dimensions.`,
    `Brand voice context: ${brandVoice}`,
    '',
    `POST TO CRITIQUE:`,
    content,
    '',
    'Return JSON with this exact shape:',
    '{',
    '  "dimensions": {',
    '    "hook":        { "score": 7, "note": "Opening is decent but could be punchier" },',
    '    "value":       { "score": 8, "note": "..." },',
    '    "voice":       { "score": 9, "note": "..." },',
    '    "uniqueness":  { "score": 6, "note": "..." },',
    '    "platformFit": { "score": 8, "note": "..." }',
    '  }',
    '}',
    '',
    'Scores are integers 1-10. Be honest and critical. Do not compute an overall score.',
  ].join('\n')
}
```

Note: Overall score is computed in TypeScript, not by the model, to avoid floating-point and null issues.

### Rewrite Prompt Structure

```typescript
function buildRewritePrompt(
  platform: string,
  originalContent: string,
  critiqueResult: CritiqueResult,
  brandSystemPrompt: string
): string {
  const dimensionSummary = Object.entries(critiqueResult.dimensions)
    .map(([dim, { score, note }]) => `- ${dim} (${score}/10): ${note}`)
    .join('\n')

  return [
    `Rewrite this ${platform.toUpperCase()} post to improve its weak dimensions.`,
    '',
    'CRITIQUE FEEDBACK:',
    dimensionSummary,
    '',
    'INSTRUCTIONS:',
    '- Focus on improving dimensions scored below 7',
    '- Preserve dimensions scored 8 or higher',
    '- Maintain all platform character limits and hashtag rules',
    '- Keep the same core message and factual content',
    '',
    'ORIGINAL POST:',
    originalContent,
    '',
    'Return only the rewritten post text, no JSON, no commentary.',
  ].join('\n')
}
```

The rewrite prompt requests plain text (not JSON) since we only need the rewritten content string.

### Score Computation Helper

```typescript
// Source: Claude's discretion — recommended utility
function computeOverallScore(dimensions: CritiqueResult['dimensions']): number {
  const scores = Object.values(dimensions).map(d => d.score)
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length
  return Math.round(avg)
}

function findWeakestDimension(dimensions: CritiqueResult['dimensions']): string {
  let weakest = ''
  let lowestScore = 11
  for (const [key, { score }] of Object.entries(dimensions)) {
    if (score < lowestScore) {
      lowestScore = score
      weakest = key
    }
  }
  return weakest
}
```

### Migration SQL

```sql
-- src/db/migrations/0002_quality_details.sql
ALTER TABLE `posts` ADD `quality_details` text;
```

Generated by `npx drizzle-kit generate` after adding to schema.ts:
```typescript
qualityDetails: text('quality_details', { mode: 'json' }).$type<QualityDetails>(),
```

### saveGeneratedPosts() Integration Point

```typescript
// In saveGeneratedPosts(), update the insert to handle quality data:
db.insert(posts).values({
  brandId,
  sourceUrl: sourceUrl || null,
  sourceText: sourceText || null,
  content: primaryContent,
  status: 'draft',
  qualityScore: qualityData?.[platformKeys[0]]?.score ?? null,
  qualityDetails: qualityData?.[platformKeys[0]]?.details ?? null,
}).returning({ id: posts.id }).get()
```

### generate-section.tsx Loading State

```typescript
// Two separate loading phases — generate then refine
{isPending && refinePhase === 'generating' && (
  <div className="text-sm text-muted-foreground">Generating...</div>
)}
{isPending && refinePhase === 'refining' && (
  <div className="text-sm text-muted-foreground">Refining...</div>
)}
```

OR simpler — since both are in the same `startTransition`, update a `loadingMessage` state string:
```typescript
const [loadingMessage, setLoadingMessage] = useState('Generating...')
// set to 'Refining...' when refineAndGate() is called
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single-pass generation, save immediately | Generate → critique → optional rewrite → gate | Posts meet quality bar before saving |
| qualityScore always null | qualityScore + qualityDetails populated at save time | Quality data available for Phase 7 analytics |

---

## Open Questions

1. **Should discarded platforms be surfaced individually or should any discard block the whole generation?**
   - What we know: CONTEXT.md says "content is not saved, return an error" — implies platform-level discard
   - What's unclear: If twitter gets discarded but linkedin passes, does the user see the linkedin result?
   - Recommendation: Per-platform discard. Show discarded platforms as error cards, passing platforms as normal. This is more useful than blocking everything.

2. **Does `refineAndGate()` receive the brand's voice context for critique prompts?**
   - What we know: The critique includes "Voice — Does it match the brand's tone?" which requires brand context
   - What's unclear: Should `refineAndGate()` accept the brand object or re-query the DB?
   - Recommendation: Accept `brandId: number` and re-query the brand inside `refineAndGate()`, matching how `generateContent()` works. This keeps the function self-contained.

3. **Should the cost of refinement be shown in the UI separately from generation cost?**
   - What we know: generate-section displays `result.totalCostUsd` as a single figure; CONTEXT.md is silent on UI display of quality scores
   - What's unclear: Is a single combined cost figure sufficient?
   - Recommendation: Return combined cost from `refineAndGate()` as an additive total (generation cost + refinement cost). Display one figure. Keep it simple.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — manual verification via dev server |
| Config file | None |
| Quick run command | `npm run dev` + manual browser test |
| Full suite command | Manual end-to-end: generate content → observe refinement → check DB |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUAL-01 | Critique call fires, rewrite call fires, content changes | manual-only | Open generate page, paste source, generate, inspect activityLog rows | N/A |
| QUAL-02 | High-scoring draft skips rewrite (verify via activityLog entry) | manual-only | Check activityLog for `quality_skip` entry after generation | N/A |
| QUAL-03 | Gate scores post on 5 dimensions, stores qualityDetails | manual-only | Inspect `posts` table: `quality_score` and `quality_details` populated | N/A |
| QUAL-04 | Score < 5 returns error to UI with discard reason; score 5-6 retries | manual-only | Test with deliberately weak source content; verify error card appears | N/A |
| QUAL-05 | `qualityScore` and `qualityDetails` persisted on saved post | manual-only | After save, query SQLite: `SELECT quality_score, quality_details FROM posts ORDER BY id DESC LIMIT 1` | N/A |

### Sampling Rate
- **Per task:** `npm run dev` + one manual generation run to verify the task's specific output
- **Per wave:** Full manual end-to-end test covering all 5 QUAL requirements
- **Phase gate:** All QUAL requirements verified manually before `/gsd:verify-work`

### Wave 0 Gaps
- No test files needed — no automated test framework in project
- Migration file `src/db/migrations/0002_quality_details.sql` must exist before first generation run
- Framework install: N/A

---

## Sources

### Primary (HIGH confidence)
- `src/app/actions/generate.ts` — established two-pass pattern, all helper functions, exact types
- `src/lib/ai.ts` — `getModelConfig()`, `checkAiSpend()`, `logAiSpend()` signatures
- `src/lib/circuit-breaker.ts` — `getBreaker()` API
- `src/db/schema.ts` — confirms `posts.qualityScore` exists, `activityLog` shape, JSON column pattern
- `src/app/(dashboard)/brands/[id]/generate/generate-section.tsx` — integration point, loading state pattern
- `src/lib/cron.ts` — activityLog insert pattern (await vs .run() distinction)
- `src/db/index.ts` — confirms migration runner reads from `src/db/migrations/`
- `.planning/phases/2B-quality-pipeline/2B-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- drizzle-orm docs: `text({ mode: 'json' }).$type<T>()` pattern for JSON columns (matches existing schema.ts usage)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture: HIGH — patterns directly observed in existing code; no inference required
- Pitfalls: HIGH — identified from reading actual code (sync .run() vs async, existing migration runner, score computation edge cases)

**Research date:** 2026-03-17
**Valid until:** Stable — this phase builds on existing code that won't change
