# Phase 2B: Quality Pipeline - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a quality pipeline that processes generated content before it can be scheduled or published. Two stages: (1) self-refine loop where a critique model scores the draft and a primary model rewrites based on feedback, and (2) a quality gate that routes posts based on final score. This is a backend pipeline — no new pages, just logic that integrates into the existing generation flow from Phase 2A.

Content generation is Phase 2A (done). Scheduling/publishing is Phase 5. This phase adds quality assurance between generation and draft-saving.

</domain>

<decisions>
## Implementation Decisions

### Self-refine loop (QUAL-01)
- After `generateContent()` produces per-platform content, run a self-refine pass
- Critique call: use `getModelConfig().critique` (Sonnet in production, Haiku in testing) to score the draft on 5 dimensions:
  1. **Hook** — Does the opening grab attention?
  2. **Value** — Does it deliver useful/interesting content?
  3. **Voice** — Does it match the brand's tone and style?
  4. **Uniqueness** — Is it fresh, not generic?
  5. **Platform fit** — Is it optimized for the target platform's norms?
- Each dimension scored 1-10, with a brief critique note explaining the score
- Overall score = average of 5 dimensions, rounded to nearest integer
- Rewrite call: use `getModelConfig().primary` (Opus in production, Sonnet in testing) to rewrite the content incorporating the critique feedback
- The rewrite prompt includes: original content, dimension scores, critique notes, and the instruction to improve weak areas while preserving strong ones

### Conditional skip (QUAL-02)
- If the initial critique scores the draft ≥ 8 overall, skip the rewrite entirely
- The original content passes through unchanged
- This saves an API call and cost when the first draft is already strong
- Log the skip decision to `activityLog` for observability

### Quality gate scoring (QUAL-03)
- After self-refine (or skip), run a final quality gate
- Same critique model scores the final content on the same 5 dimensions
- If self-refine was skipped (score ≥ 8), use the initial scores as the gate scores (don't re-score)
- If self-refine ran, re-score the rewritten content

### Quality gate routing (QUAL-04)
- Score ≥ 7: **Pass** — content proceeds as normal draft, quality score stored on post
- Score 5-6: **Re-refine** — run the self-refine loop one more time (max 1 retry), then re-score. If still 5-6 after retry, pass with a warning flag
- Score < 5: **Discard** — content is not saved, return an error with the reason (lowest-scoring dimension's critique note)
- The routing logic lives in a `qualityPipeline()` function that wraps the existing `generateContent()` flow

### Quality score storage (QUAL-05)
- Store the final overall quality score (1-10 integer) in `posts.qualityScore`
- Store per-dimension scores in `posts` metadata or a new JSON column — use existing `posts` table, add dimension scores to a `qualityDetails` JSON text column
- Quality score is displayed as a badge on the post when viewing drafts (future phase)

### Integration with Phase 2A
- `generateContent()` remains unchanged — it returns raw generated content
- New `refineAndGate()` function takes generated content, runs self-refine + quality gate, returns refined content with scores
- The generation page calls `refineAndGate()` after `generateContent()` before displaying results
- Loading state shows "Refining..." after "Generating..." to indicate the two-stage process
- If content is discarded (score < 5), show an error message with the reason and offer to try again

### Cost tracking
- Each critique and rewrite call logs spend via existing `logAiSpend()`
- The quality pipeline may add 2-4 extra API calls per generation (critique + rewrite + gate, possibly retry)
- In testing mode this is cheap (Haiku critiques + Sonnet rewrites)

### Claude's Discretion
- Exact prompt wording for critique and rewrite calls
- How to structure the critique JSON response format
- Whether to show quality scores in the UI during preview or just store them
- Error handling for malformed critique responses
- Whether the quality pipeline runs per-platform or on all platforms at once

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/actions/generate.ts`: `generateContent()`, `saveGeneratedPosts()`, `parseJsonResponse()`, `calculateCostUsd()`, `PLATFORM_CONSTRAINTS` — all reusable
- `src/lib/ai.ts`: `getModelConfig()`, `checkAiSpend()`, `logAiSpend()` — critique and rewrite calls use these
- `src/lib/circuit-breaker.ts`: `getBreaker('anthropic')` — wrap all new API calls
- `src/db/schema.ts`: `posts.qualityScore` column already exists (integer, nullable)
- `src/app/(dashboard)/brands/[id]/generate/generate-section.tsx`: client component that calls `generateContent()` — needs to also call the refine step

### Established Patterns
- Server actions in `src/app/actions/` return result objects (not redirects) for data operations
- Two-pass Claude flow pattern established in `generateContent()` (generation + hook scoring)
- Prompt-based JSON extraction with `parseJsonResponse()` (defensive, strips markdown fences)
- Circuit breaker wrapping all Anthropic API calls

### Integration Points
- `src/app/actions/generate.ts`: add `refineAndGate()` function alongside existing actions
- `src/app/(dashboard)/brands/[id]/generate/generate-section.tsx`: call refine after generate, update loading state
- `src/db/schema.ts`: may need `qualityDetails` text column on posts for per-dimension scores
- `activityLog` table: log quality decisions (skip, pass, re-refine, discard)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user trusts Claude's judgment on all implementation details. Follow the established two-pass Claude pattern from Phase 2A and keep the quality pipeline as a clean function that slots between generation and saving.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 2B-quality-pipeline*
*Context gathered: 2026-03-17*
