---
phase: 2B-quality-pipeline
plan: 02
type: execute
wave: 2
depends_on:
  - 2B-01
files_modified:
  - src/app/(dashboard)/brands/[id]/generate/generate-section.tsx
autonomous: false
requirements:
  - QUAL-01
  - QUAL-02
  - QUAL-03
  - QUAL-04
  - QUAL-05

must_haves:
  truths:
    - "User sees 'Refining...' loading state after generation completes"
    - "Passing content displays with quality score badge"
    - "Discarded platforms show error card with reason instead of editable textarea"
    - "Warning-flagged content shows a warning indicator"
    - "Save action passes quality data to saveGeneratedPosts()"
    - "Combined AI cost (generation + refinement) is displayed"
  artifacts:
    - path: "src/app/(dashboard)/brands/[id]/generate/generate-section.tsx"
      provides: "Updated generation UI with refine integration, quality badges, discard handling"
      contains: "refineAndGate"
  key_links:
    - from: "generate-section.tsx (handleGenerate)"
      to: "refineAndGate()"
      via: "server action call after generateContent()"
      pattern: "refineAndGate"
    - from: "generate-section.tsx (handleSave)"
      to: "saveGeneratedPosts() with qualityData"
      via: "passes quality scores from refined result"
      pattern: "qualityData"
---

<objective>
Wire the quality pipeline into the generation UI: call refineAndGate() after generateContent(), update loading states, display quality scores, handle discarded platforms, and pass quality data when saving.

Purpose: Users see the quality pipeline in action -- a two-phase loading state (Generating... then Refining...), quality score badges on results, error cards for discarded content, and warning indicators for marginal content.

Output: Fully functional end-to-end quality pipeline from generation through refinement to save.
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
@.planning/phases/2B-quality-pipeline/2B-01-SUMMARY.md

@src/app/(dashboard)/brands/[id]/generate/generate-section.tsx
@src/app/actions/generate.ts

<interfaces>
<!-- Interfaces from Plan 01 that this plan consumes -->

From src/app/actions/generate.ts (added by Plan 01):
```typescript
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

export async function refineAndGate(
  brandId: number,
  generated: GenerationResult
): Promise<RefinedGenerationResult>

// Updated signature:
export async function saveGeneratedPosts(
  brandId: number,
  platformContents: Record<string, string>,
  sourceText: string,
  sourceUrl: string,
  qualityData?: Record<string, { score: number; details: QualityDetails }>
): Promise<{ error?: string }>
```

From src/db/schema.ts (added by Plan 01):
```typescript
export interface QualityDetails {
  hook:        { score: number; note: string }
  value:       { score: number; note: string }
  voice:       { score: number; note: string }
  uniqueness:  { score: number; note: string }
  platformFit: { score: number; note: string }
}
```

Existing imports already in generate-section.tsx:
```typescript
import { generateContent, saveGeneratedPosts, type GenerationResult } from '@/app/actions/generate'
import { Badge } from '@/components/ui/badge'
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire refineAndGate into generation flow and update UI</name>
  <files>src/app/(dashboard)/brands/[id]/generate/generate-section.tsx</files>
  <action>
Update `generate-section.tsx` to integrate the quality pipeline. The changes are:

**1. Update imports:**
Add `refineAndGate` and `RefinedGenerationResult` to the import from `@/app/actions/generate`.

**2. Replace result state type:**
Change `const [result, setResult] = useState<GenerationResult | null>(null)` to use `RefinedGenerationResult | null` instead. This is the type returned by `refineAndGate()` which extends `GenerationResult` with quality fields.

**3. Add loading message state:**
```typescript
const [loadingMessage, setLoadingMessage] = useState('Generating...')
```

**4. Update handleGenerate():**
The function should now call `generateContent()` first, then `refineAndGate()`:
```typescript
function handleGenerate() {
  setError(null)
  setLoadingMessage('Generating...')
  startTransition(async () => {
    // Phase 1: Generate raw content
    const genResult = await generateContent(brandId, selectedPlatforms, sourceText, sourceUrl)
    if (genResult.error) {
      setError(genResult.error)
      return
    }

    // Phase 2: Refine and quality gate
    setLoadingMessage('Refining...')
    const refined = await refineAndGate(brandId, genResult)
    if (refined.error) {
      setError(refined.error)
      return
    }

    setResult(refined)
    // Only populate editedContent for non-discarded platforms
    setEditedContent(
      Object.fromEntries(
        Object.entries(refined.platforms)
          .filter(([, v]) => !v.discarded)
          .map(([k, v]) => [k, v.content])
      )
    )
    setError(null)
  })
}
```

**5. Update loading state display:**
Replace the static "Generating..." text in the button with `loadingMessage`:
```tsx
{isPending ? loadingMessage : 'Generate Content'}
```

**6. Update results rendering to handle discarded platforms:**
In the TabsContent for each platform, check for discarded status before rendering the textarea. For discarded platforms, show an error card instead:

```tsx
{platformData.discarded ? (
  <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 space-y-2">
    <p className="text-sm font-medium text-destructive">Content Discarded</p>
    <p className="text-sm text-muted-foreground">
      Quality score too low ({platformData.qualityScore}/10).
      {platformData.discardReason && (
        <> Reason: {platformData.discardReason}</>
      )}
    </p>
  </div>
) : (
  // existing textarea + char count JSX
)}
```

**7. Add quality score badge per platform tab:**
Inside each TabsContent (for non-discarded platforms), add a quality score badge above the hook variants section:

```tsx
<div className="flex items-center gap-2">
  <Badge variant={platformData.qualityScore >= 8 ? 'default' : 'secondary'}>
    Quality: {platformData.qualityScore}/10
  </Badge>
  {platformData.qualityWarning && (
    <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
      Warning
    </Badge>
  )}
</div>
```

**8. Update handleSave() to pass quality data:**
Build quality data from the refined result and pass it to `saveGeneratedPosts()`:

```typescript
function handleSave() {
  startSavingTransition(async () => {
    // Build quality data from refined results
    const qualityData: Record<string, { score: number; details: any }> = {}
    if (result) {
      for (const [platform, data] of Object.entries(result.platforms)) {
        if (!data.discarded) {
          qualityData[platform] = {
            score: data.qualityScore,
            details: data.qualityDetails,
          }
        }
      }
    }

    const res = await saveGeneratedPosts(
      brandId,
      editedContent,
      sourceText,
      sourceUrl,
      Object.keys(qualityData).length > 0 ? qualityData : undefined
    )
    if (res?.error) {
      setError(res.error)
    }
  })
}
```

**9. Filter discarded platforms from tab triggers:**
In the TabsList, still show all platforms (including discarded) so users can see what was discarded. But adjust the tab label for discarded platforms to indicate the discard visually (e.g., strikethrough or dim text).

**10. Disable Save button if ALL platforms are discarded:**
Update the Save button's disabled condition:
```typescript
const hasPassingContent = result
  ? Object.values(result.platforms).some(p => !p.discarded)
  : false

// In button:
<Button onClick={handleSave} disabled={isSaving || !hasPassingContent}>
```

**11. Show combined cost:**
Track generation cost separately and sum with refinement cost for display:

```typescript
const [genCost, setGenCost] = useState(0)
// In handleGenerate, after generateContent:
setGenCost(genResult.totalCostUsd)
// In display:
<p className="text-xs text-muted-foreground">
  AI cost: ${((genCost ?? 0) + (result?.totalCostUsd ?? 0)).toFixed(4)}
</p>
```

**12. Show error with "Try Again" for fully discarded results:**
If every platform was discarded, show an error message after the tabs with a suggestion to try again with different source content:
```tsx
{result && !hasPassingContent && (
  <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
    All content was discarded due to low quality scores. Try with different or more detailed source material.
  </div>
)}
```
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
- Generate button shows "Generating..." then "Refining..." during the two phases
- Non-discarded platforms show quality score badge and editable textarea
- Discarded platforms show error card with score and reason
- Warning badge appears for marginal (5-6 after retry) content
- Save passes quality data to saveGeneratedPosts()
- Save is disabled when all platforms are discarded
- Combined AI cost displayed
- TypeScript compiles cleanly
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Verify end-to-end quality pipeline</name>
  <files>src/app/(dashboard)/brands/[id]/generate/generate-section.tsx</files>
  <action>
Human verification of the complete quality pipeline. Claude has automated all code changes -- this checkpoint confirms the pipeline works end-to-end with live AI calls.

What was built:
- refineAndGate() orchestrator with critique, rewrite, and quality gate
- Conditional skip for high-scoring drafts (>= 8)
- Re-refine retry for marginal scores (5-6)
- Discard routing for low scores (< 5)
- UI integration with quality badges, discard cards, and two-phase loading
- Quality data persistence in posts table
  </action>
  <verify>
    1. Start dev server: `npm run dev`
    2. Navigate to a brand's generate page (/brands/{id}/generate)
    3. Paste source text or URL, select at least one platform
    4. Click "Generate Content"
    5. Verify the button text changes from "Generating..." to "Refining..."
    6. After completion, verify:
       a. Each platform tab shows a "Quality: X/10" badge
       b. Content is displayed in editable textareas (for passing platforms)
       c. AI cost is shown at the bottom
    7. Click "Save as Draft" -- verify no errors
    8. Check the database to confirm quality data was saved:
       `sqlite3 data/social.db "SELECT quality_score, quality_details FROM posts ORDER BY id DESC LIMIT 1"`
    9. Verify quality_score is a number 1-10 and quality_details is valid JSON with 5 dimensions
    10. Check activity log for quality entries:
       `sqlite3 data/social.db "SELECT type, level, message FROM activity_log WHERE type='quality' ORDER BY id DESC LIMIT 5"`
  </verify>
  <done>User confirms: quality pipeline generates, refines, gates, displays scores, and persists quality data correctly.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes
2. Generation flow shows two-phase loading state
3. Quality scores appear as badges on each platform tab
4. Discarded content shows error card (if any platform scores < 5)
5. Save persists quality_score and quality_details to posts table
6. Activity log contains quality pipeline events (skip, pass, re-refine, or discard)
7. Combined AI cost (generation + refinement) displayed
</verification>

<success_criteria>
- Full end-to-end quality pipeline works: generate -> critique -> optional rewrite -> quality gate -> display -> save
- Quality scores stored in database on every saved post
- Activity log records all quality routing decisions
- UI clearly shows quality state (scores, warnings, discards)
- No regression in existing generation flow
</success_criteria>

<output>
After completion, create `.planning/phases/2B-quality-pipeline/2B-02-SUMMARY.md`
</output>
