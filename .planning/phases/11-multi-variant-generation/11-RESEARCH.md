# Phase 11: Multi-Variant Generation - Research

**Researched:** 2026-03-20
**Domain:** AI generation pipeline extension, SQLite variant storage, Next.js server actions, shadcn UI
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MVAR-01 | Generate 3 content variants per post using Haiku, quality gate (Sonnet) picks winner | generateVariants() function, temperature variation API, runCritique() reuse |
| MVAR-02 | Per-brand toggle: enable/disable multi-variant generation (default off) | brands.enableVariants column already in schema; brand-form Settings tab is the hook |
| MVAR-03 | Store all variants with scores; show winning variant and runner-ups on post detail | posts.variantGroup + posts.variantOf columns already in schema; new post detail route needed |
| MVAR-04 | Cost guard: multi-variant respects daily AI spend limit (3x cost per post) | checkAiSpend() + logAiSpend() already exist; fallback path is well-defined |
</phase_requirements>

---

## Summary

Phase 11 adds multi-variant generation on top of an already-complete generation and quality-gate pipeline. The core loop is: if `brand.enableVariants === 1`, call Haiku three times at temperatures 0.7/0.85/1.0, run the existing `runCritique()` scorer on all three results, store the highest-scoring variant as the canonical post record (status=draft/scheduled), and store the two losers as satellite post records linked via `posts.variantOf` and sharing a UUID in `posts.variantGroup`.

The schema is fully prepared. `brands.enableVariants`, `posts.variantGroup`, and `posts.variantOf` were added in Phase 8 and are already in production. The `checkAiSpend()` / `logAiSpend()` infrastructure handles cost tracking. The `runCritique()` function inside `generate.ts` is the existing Sonnet quality scorer — it can be called on each of the three Haiku variants to pick the winner without any additional cost infrastructure.

The two UI surfaces are: (1) a toggle in the brand-form Settings tab that also shows an estimated cost increase, and (2) a new `/brands/[id]/posts/[postId]` page (post detail route) that shows the winning variant plus collapsed accordion rows for the runner-ups.

**Primary recommendation:** Extract `runCritique()` from generate.ts into a shared helper in `src/lib/quality-gate.ts`, implement `generateVariants()` in `src/lib/variant-generator.ts`, modify `autoGenerate()` to call it when `enableVariants === 1`, add the toggle to brand-form, and create the post detail page. No new DB migrations are required.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @anthropic-ai/sdk | existing | Haiku generation + Sonnet scoring | Already wired; lazy singleton in generate.ts |
| drizzle-orm | existing | SQLite queries for variant storage | ORM already used throughout |
| node-cron | existing | Auto-generate scheduling | Cron already runs `autoGenerate()` every 15 min |
| next.js server actions | existing | Brand toggle + post detail page | All actions follow `'use server'` pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Collapsible | existing (radix-ui) | Runner-up variant accordion in post detail | Matches existing expand/collapse pattern in learnings-section.tsx |
| shadcn/ui Switch | existing | Enable-variants toggle in brand-form | Toggle pattern for boolean brand settings |
| uuid (or crypto.randomUUID) | node built-in | variantGroup UUID generation | No new dependency — crypto.randomUUID() is available in Node 14.17+ |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Calling critique once per variant | Batch prompt all 3 at once | Batching saves tokens but makes per-variant score extraction fragile; serial critique is cleaner and uses the same pattern as the existing pipeline |
| New quality-gate table | Posts.qualityScore on each variant row | Schema already has qualityScore on posts; no new table needed |

**Installation:** No new packages required.

---

## Architecture Patterns

### How the Existing Pipeline Works (critical context)

```
autoGenerate()
  └─ processEntry(entry)
       ├─ generateContent(brandId, platforms, sourceText, sourceUrl)
       │    └─ [Haiku] build system prompt → generate content → hook scoring
       │    └─ returns GenerationResult { platforms: {}, activeLearningIds }
       ├─ refineAndGate(brandId, generationResult)
       │    └─ [Sonnet critique] → optional rewrite → quality gate
       │    └─ returns RefinedGenerationResult { platforms: { qualityScore, discarded } }
       └─ saveAsAutoPost(input) → scheduleToNextSlot()
```

For multi-variant, the pattern extends `processEntry()` to branch before `generateContent()`:

```
processEntry(entry)
  ├─ if brand.enableVariants === 1 AND checkAiSpend():
  │    └─ generateVariants(brandId, platforms, sourceText, sourceUrl)
  │         ├─ Haiku @ temp=0.7 → content A
  │         ├─ Haiku @ temp=0.85 → content B
  │         ├─ Haiku @ temp=1.0 → content C
  │         ├─ runCritique(brandId, platform, contentA)  → scoreA
  │         ├─ runCritique(brandId, platform, contentB)  → scoreB
  │         ├─ runCritique(brandId, platform, contentC)  → scoreC
  │         └─ returns { winner, losers, variantGroup, totalCostUsd, activeLearningIds }
  │    └─ saveWinnerAndLosers(winner, losers, variantGroup, ...)
  └─ else: existing single-variant path (no change)
```

### Recommended File Structure Changes

```
src/
├─ lib/
│   ├─ auto-generate.ts       # Modify: branch on brand.enableVariants
│   └─ variant-generator.ts   # New: generateVariants() function
├─ app/
│   ├─ actions/
│   │   └─ brands.ts          # Modify: handle enableVariants in updateBrand()
│   └─ (dashboard)/
│       └─ brands/[id]/
│           ├─ posts/[postId]/ # New route: post detail page
│           │   └─ page.tsx
│           └─ edit/
│               └─ page.tsx   # No change needed (uses BrandForm)
└─ components/
    └─ brand-form.tsx          # Modify: add enableVariants toggle to Settings tab
```

### Pattern 1: Temperature-Varied Generation

The Anthropic SDK `messages.create()` accepts a `temperature` parameter (0.0-1.0). Currently no calls pass it (defaults to 1.0). To get three distinct variants:

```typescript
// Source: Anthropic SDK docs + existing generate.ts pattern
const temperatures = [0.7, 0.85, 1.0]
const variants = await Promise.all(
  temperatures.map(temp =>
    getBreaker('anthropic').call(() =>
      getAnthropic().messages.create({
        model: modelConfig.primary,  // Haiku — primary model in testing mode
        max_tokens: 4096,
        temperature: temp,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })
    )
  )
)
```

Note: `Promise.all()` fires all three calls concurrently. This is safe — three Haiku calls at ~$0.0008 each = ~$0.0024 total generation cost (vs ~$0.0008 single). The circuit breaker wraps each call independently.

### Pattern 2: Variant Storage

Use `posts.variantGroup` (UUID string) and `posts.variantOf` (FK to winning post ID) to link variants:

```typescript
// Winner: saved normally by saveAsAutoPost(), variantOf = null, variantGroup = uuid
// Loser: saved with status = 'draft', variantOf = winner.id, variantGroup = same uuid

const variantGroup = crypto.randomUUID()

// Save winner first (returns postId)
const { postId: winnerId } = saveAsAutoPost({
  ...winnerInput,
  variantGroup,
  // variantOf: null (winner)
})

// Save each loser linked to winner
for (const loser of losers) {
  saveAsAutoPost({
    ...loserInput,
    variantGroup,
    variantOf: winnerId,
    status: 'draft',  // losers are always drafts, never scheduled
  })
}
```

**Critical:** `saveAsAutoPost()` currently does not accept `variantGroup` or `variantOf`. These fields need to be added to the `AutoPostInput` interface and the insert call.

### Pattern 3: Cost Guard with Fallback

The existing `checkAiSpend()` returns `true` if under limit. Multi-variant must call it before initiating 3x calls and fall back gracefully:

```typescript
// In processEntry(), before variant path:
const underLimit = await checkAiSpend()
if (brand.enableVariants && underLimit) {
  // multi-variant path
} else {
  if (brand.enableVariants && !underLimit) {
    logActivity(brandId, 'warn', 'Multi-variant skipped: daily spend limit reached, falling back to single-variant', {...})
  }
  // existing single-variant path
}
```

The fallback must not fail silently — the activity log entry is the "not silent" part.

### Pattern 4: Brand Toggle in brand-form

The `BrandForm` component is a client component using a native HTML form submitted to server actions (`createBrand` / `updateBrand`). Adding the toggle means:

1. Add a controlled `useState` for `enableVariants` in `brand-form.tsx`
2. Add a hidden `<input type="hidden" name="enableVariants" value={enableVariants ? '1' : '0'} />`
3. Parse `enableVariants` from `formData` in `updateBrand()` action
4. Show cost estimate: "~3x Haiku cost per post (~$0.002 vs $0.001)" next to the toggle

The brand-form Settings tab currently only has `warmupDate`. The toggle lives there alongside it.

### Pattern 5: Post Detail Page

There is currently no `/brands/[id]/posts/[postId]` route. The "post detail" referenced in the success criteria must be a new page. The existing brand page shows recent posts as truncated snippets with no click-through. The new page should:

- Show the winning post's content + quality score
- Show a collapsible "Runner-up Variants" section (use `<details>/<summary>` or shadcn Collapsible) listing the loser posts sorted by score descending
- Only render the variants section when `post.variantGroup` is not null

Query pattern:
```typescript
// Fetch winner
const post = db.select().from(posts).where(eq(posts.id, postId)).get()

// Fetch runner-ups (all posts with same variantGroup, excluding winner)
const runnerUps = post?.variantGroup
  ? db.select().from(posts)
      .where(and(
        eq(posts.variantGroup, post.variantGroup),
        isNotNull(posts.variantOf),  // losers have variantOf set
      ))
      .all()
  : []
```

### Anti-Patterns to Avoid

- **Running critique for all 3 variants then rewriting the winner:** The success criteria says Sonnet scores all three and picks the winner — no rewrite pass on the winner variant. This is intentional to keep variant cost bounded.
- **Storing variants as `postPlatforms` rows on the same post:** The schema uses separate `posts` rows linked by `variantOf`. Storing 3 platform variants on one post would require a schema change and break the existing data model.
- **Promise.all() without circuit breaker wrapping each call:** Each Haiku call must go through `getBreaker('anthropic')` independently so one failure doesn't silently abort the others.
- **Temperature in the critique call:** Only generation varies by temperature. The critique (Sonnet) should always use default temperature for consistent scoring.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Quality scoring | Custom rubric parser | `runCritique()` in generate.ts (extract to shared lib) | Already handles fallback, cost logging, JSON parsing |
| Cost tracking | Custom spend table | `checkAiSpend()` + `logAiSpend()` in ai.ts | Already in production, same interface |
| UUID generation | Custom ID scheme | `crypto.randomUUID()` (Node built-in) | No new dependency |
| Accordion UI | Custom collapse logic | shadcn Collapsible or HTML `<details>` | Pattern already in learnings-section.tsx |
| Variant dedup | Similarity check | None needed | Temperature variation is sufficient for diversity; over-engineering is the risk |

**Key insight:** The quality gate and cost tracking are already production-hardened. The only new logic is orchestrating 3 generation calls and linking the winner/losers in the DB.

---

## Common Pitfalls

### Pitfall 1: Scoring Multi-Platform Variants Inconsistently

**What goes wrong:** If the brand targets 3 platforms, do we generate 3x3=9 variants? No — per the success criteria, "3 variants per post" means 3 variants of the full multi-platform output. The winner is chosen based on the primary platform score (consistent with how `generateContent` uses `platforms[0]`).

**How to avoid:** Score each variant using the primary platform (`platforms[0]`) only. The winning variant's non-primary platform content is accepted as-is.

**Warning signs:** If `generateVariants` receives a `platforms` array, it must pick one platform to score on — use `platforms[0]` matching the existing `loadLearnings`/`loadGoldenExamples` pattern.

### Pitfall 2: saveAsAutoPost() Missing Variant Fields

**What goes wrong:** `AutoPostInput` doesn't currently have `variantGroup` or `variantOf` fields. The planner must add them to both the interface and the `db.insert(posts)` call inside `saveAsAutoPost()`.

**How to avoid:** Modify `AutoPostInput` to include optional `variantGroup?: string | null` and `variantOf?: number | null`. The DB columns already exist.

**Warning signs:** TypeScript will not error if the fields are omitted from the insert — Drizzle uses the schema defaults (null). The losers would be orphaned without `variantOf`.

### Pitfall 3: Spend Check Timing

**What goes wrong:** `checkAiSpend()` is called before generation starts, but 3 parallel Haiku calls could push spend over the limit mid-run. There's no per-call budget reservation.

**How to avoid:** Accept this as a known limitation — the spend check is a soft gate, not a hard reservation. Document that the limit may be slightly exceeded (by 1 multi-variant batch max) when running at the boundary.

**Warning signs:** Do not add per-call spend checks that would interrupt a multi-variant batch mid-flight — partial variants are worse than a full slightly-over-budget run.

### Pitfall 4: Cost Estimate in UI

**What goes wrong:** The "estimated cost-per-post increase" shown to the user before confirming the toggle must be calculated correctly. Haiku pricing is $0.80/M input + $4.00/M output. A typical generation call uses ~2000 input + ~400 output tokens = ~$0.0018. 3x = ~$0.0054 vs single $0.0018, plus 3 critique calls at Sonnet rates (~$0.003 each).

**How to avoid:** Show a ballpark: "~$0.015 per post vs ~$0.002 without variants (3x generation + 3 scoring calls)". Use a static string, not a dynamic calculation — the user just needs order-of-magnitude awareness.

### Pitfall 5: Loser Posts Appearing in Golden Examples

**What goes wrong:** `loadGoldenExamples` already filters `isNull(posts.variantOf)` — losers with `variantOf` set are correctly excluded. However, `saveAsAutoPost()` must set `variantOf` on losers for this filter to work.

**Warning signs:** If the filter is working but no posts appear in golden examples despite high engagement, check that `variantOf` is being set on loser rows.

---

## Code Examples

### variant-generator.ts Skeleton

```typescript
// src/lib/variant-generator.ts
import Anthropic from '@anthropic-ai/sdk'
import { getModelConfig, logAiSpend } from '@/lib/ai'
import { getBreaker } from '@/lib/circuit-breaker'
// runCritique extracted from generate.ts into a shared module

const TEMPERATURES = [0.7, 0.85, 1.0] as const

export interface VariantResult {
  content: string
  qualityScore: number
  temperature: number
}

export interface GenerateVariantsResult {
  winner: VariantResult
  losers: VariantResult[]
  variantGroup: string
  activeLearningIds: number[]
  totalCostUsd: number
  error?: string
}

export async function generateVariants(
  brandId: number,
  platforms: string[],
  sourceText: string,
  sourceUrl: string
): Promise<GenerateVariantsResult> {
  // 1. Build prompt (reuse buildSystemPrompt + buildGenerationPrompt from generate.ts)
  // 2. Call Haiku at each temperature (Promise.all)
  // 3. runCritique on each result using platforms[0]
  // 4. Sort by score descending — index 0 is winner
  // 5. Return { winner, losers: [1, 2], variantGroup: crypto.randomUUID() }
}
```

### AutoPostInput Extension

```typescript
// Modify in auto-generate.ts
interface AutoPostInput {
  brandId: number
  feedEntryId: number
  sourceUrl: string
  sourceText: string
  platformContents: Record<string, string>
  qualityData: Record<string, { score: number }>
  status: 'draft' | 'scheduled'
  activeLearningIds?: number[] | null
  // Add these:
  variantGroup?: string | null
  variantOf?: number | null
}
```

### Brand Toggle in Settings Tab

```tsx
// In brand-form.tsx Settings tab
const [enableVariants, setEnableVariants] = useState(brand?.enableVariants === 1)

// In form JSX:
<input type="hidden" name="enableVariants" value={enableVariants ? '1' : '0'} />
<div className="flex items-center gap-3">
  <Switch
    id="enableVariants"
    checked={enableVariants}
    onCheckedChange={setEnableVariants}
  />
  <div>
    <Label htmlFor="enableVariants">Multi-Variant Generation</Label>
    {enableVariants && (
      <p className="text-xs text-amber-600 mt-0.5">
        Generates 3 variants per post and picks the best. Approx 7-8x higher AI cost per post (~$0.015 vs ~$0.002).
      </p>
    )}
  </div>
</div>
```

### Post Detail Variant Section

```tsx
// src/app/(dashboard)/brands/[id]/posts/[postId]/page.tsx (new)
// Runner-ups section (only shown when variantGroup is set):
{runnerUps.length > 0 && (
  <details className="rounded-md border">
    <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
      Runner-up Variants ({runnerUps.length})
    </summary>
    <div className="divide-y">
      {runnerUps
        .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0))
        .map(v => (
          <div key={v.id} className="px-4 py-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Score {v.qualityScore ?? 'n/a'}/10</span>
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{v.content}</p>
          </div>
        ))}
    </div>
  </details>
)}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single generation call | Multi-temp Haiku + Sonnet scoring | Phase 11 | 3x generation cost for best-of-3 quality |
| No temperature variance | temperatures [0.7, 0.85, 1.0] | Phase 11 | Structural diversity across variants |

**Decision already locked in STATE.md:**
- Multi-variant uses Haiku for all 3 generation calls, Sonnet only for final winner quality gate

---

## Open Questions

1. **Does the post detail page need a route link from the brand home page's recent posts list?**
   - What we know: Recent posts are rendered as truncated lines with no click-through
   - What's unclear: Whether to add `<Link href={/brands/${brandId}/posts/${postId}}>` wrappers around recent post rows
   - Recommendation: Yes — add the link. The post detail page is only useful if it's reachable. Wire the recent posts list items as links.

2. **Manual generation (generate page) — should it also support variants?**
   - What we know: The success criteria only mentions "auto-generation produces 3 variants" — implies cron path
   - What's unclear: Whether the `/brands/[id]/generate` manual flow should also show 3 variants
   - Recommendation: Keep manual generation single-variant for Phase 11. The success criteria is scoped to auto-generation. Manual multi-variant would require significant generate-section.tsx changes and is best deferred.

3. **What is the "post detail" page navigation entry point?**
   - What we know: No dedicated post detail route currently exists
   - Recommendation: Create `/brands/[id]/posts/[postId]/page.tsx`. Link to it from the brand home page's recent posts list AND from the calendar draft rows.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected (no jest.config.*, vitest.config.*, or test/ directory) |
| Config file | None — Wave 0 must establish |
| Quick run command | `npx tsx --no-warnings src/lib/variant-generator.ts` (smoke via direct execution) |
| Full suite command | `npx tsc --noEmit` (TypeScript compile check) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MVAR-01 | generateVariants() returns 3 distinct results with scores | manual-only | — | No test file |
| MVAR-01 | Winner has highest score of the 3 | manual-only | — | No test file |
| MVAR-02 | enableVariants toggle persists via updateBrand() | manual-only (UI) | — | No test file |
| MVAR-03 | Loser posts have variantOf pointing to winner | manual-only (DB inspect) | — | No test file |
| MVAR-04 | When spend limit hit, falls back to single-variant | manual-only | — | No test file |

**Justification for manual-only:** The project has no existing test infrastructure. All previous phases have been validated via Railway deployment and manual verification. Adding a test framework in Phase 11 would be out of scope for a 2-plan phase.

### Sampling Rate

- **Per task commit:** `npx tsc --noEmit` (TypeScript type-check; catches interface mismatches in variant fields)
- **Per wave merge:** TypeScript check + manual test in Railway preview
- **Phase gate:** Full pipeline smoke test (enable variants toggle → trigger auto-generate manually via health endpoint → verify 3 posts created with correct variantGroup/variantOf in DB)

### Wave 0 Gaps

- None — no test infrastructure to establish. TypeScript compile check (`npx tsc --noEmit`) is the automated gate.

---

## Sources

### Primary (HIGH confidence)

- Codebase inspection — `src/app/actions/generate.ts` (full read) — generation pipeline, runCritique(), refineAndGate()
- Codebase inspection — `src/lib/ai.ts` — checkAiSpend(), logAiSpend(), getModelConfig(), pricing table
- Codebase inspection — `src/lib/auto-generate.ts` — processEntry() flow, saveAsAutoPost() interface
- Codebase inspection — `src/db/schema.ts` — posts.variantGroup, posts.variantOf, brands.enableVariants (all confirmed present)
- Codebase inspection — `src/lib/prompt-injector.ts` — isNull(posts.variantOf) filter in loadGoldenExamples
- Codebase inspection — `src/lib/cron.ts` — cron job registration pattern for autoGenerate
- Codebase inspection — `src/components/brand-form.tsx` — Settings tab structure, form action pattern
- STATE.md decision: "Multi-variant uses Haiku for all 3 generation calls, Sonnet only for final winner quality gate"

### Secondary (MEDIUM confidence)

- Anthropic SDK `messages.create()` accepts `temperature: number` (0.0-1.0) — verified against existing call signatures in codebase; no explicit docs fetch needed as the parameter is part of the TypeScript type definitions already imported

### Tertiary (LOW confidence)

- Cost estimate (~$0.015 per variant batch) — derived from pricing table in generate.ts (Haiku $0.80/M in, $4.00/M out; Sonnet $3.00/M in, $15.00/M out) with estimated 2000 input + 400 output tokens per call. Actual cost varies with source text length.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture: HIGH — schema is complete, existing pipeline patterns are clear, extension points are obvious
- Pitfalls: HIGH — all pitfalls derived from direct codebase reading, not assumptions
- Cost estimates: MEDIUM — based on pricing table in codebase + typical token counts; actual may vary 20-30%

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable — Anthropic SDK and Next.js patterns don't change frequently; Haiku model ID is pinned in getModelConfig())
