# Phase 2A: Brand Profiles + AI Text Generation - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate brand-aware, platform-optimized text content from source material using Claude API. User pastes a URL or types/pastes text, selects target platforms, AI generates platform-specific posts using the brand's voice, topics, dos/donts, and examples. Hook/title optimization generates variants and picks the best. User can preview per-platform, edit, then save as draft or schedule.

Content extraction (YouTube transcripts, article parsing, PDF extraction) is Phase 3. Quality pipeline (self-refine loop, quality gate scoring) is Phase 2B. Scheduling/publishing is Phase 5. This phase handles: source input, AI generation, hook optimization, platform preview, and editing.

</domain>

<decisions>
## Implementation Decisions

### Content creation flow
- Single-page creation flow at `/brands/[id]/generate` — not a multi-step wizard
- Top section: source input (textarea for raw text, URL field for link-based sources)
- URL input stores the URL as `sourceUrl` on the post; raw text stored as `sourceText` — no extraction logic yet (Phase 3), just pass the URL/text as context to Claude
- Platform selection: checkboxes for each connected account (fetched from socialAccounts for the brand)
- "Generate" button triggers server action → Claude API call → returns per-platform content
- Show a loading skeleton while AI generates (reuse existing Skeleton component)
- Results appear below as per-platform cards, each editable

### AI generation prompt structure
- System prompt includes: brand voice/tone, target audience, goals, topics, dos/donts, example posts, platform-specific notes, banned hashtags
- User prompt includes: source material (text or URL), target platform name and constraints (character limits, hashtag norms)
- Generate one post per selected platform in a single Claude API call (structured output with platform keys)
- Use `getModelConfig().primary` for generation (Sonnet in testing, Opus in production)
- Log spend via existing `logAiSpend()` + check `checkAiSpend()` before calling

### Hook/title optimization
- After initial generation, run a second Claude call specifically for hook optimization
- Generate 5 hook/title variants per platform post, each self-scored 1-10 on attention-grab, relevance, and brand fit
- Auto-select the highest-scoring hook and splice it into the post
- User sees the winning hook in the preview but can click to expand and see all variants with scores
- Use `getModelConfig().critique` for hook scoring (Haiku in testing, Sonnet in production) — cheaper model is fine for scoring
- Single combined cost logged per generation session

### Platform preview and editing
- Tab-based preview: one tab per platform showing the generated post
- Each tab shows: platform icon, character count (with limit indicator), generated content in a textarea
- User can freely edit content in the textarea before saving
- Character limit warnings (not hard blocks) — yellow at 90%, red at 100%
- Platform character limits: X (280), LinkedIn (3000), Instagram (2200), TikTok (2200)
- No mockup of actual platform UI — just clean text preview with metadata. Keep it simple.

### Post saving
- "Save as Draft" button saves all platform posts with status=draft
- Creates one `posts` row (with sourceUrl/sourceText, content = primary platform content, brandId, qualityScore=null)
- Creates one `postPlatforms` row per selected platform (with platform-specific content, status=pending)
- "Generate Again" button re-runs AI generation with same source material
- No direct publish from this page — publishing comes in Phase 5 (scheduling)
- After save, redirect to brand detail page or a future "posts" list page

### Navigation integration
- Add "Generate" button/link on brand detail page (next to brand name or in actions area)
- Generation page is brand-scoped: `/brands/[id]/generate`
- Sidebar doesn't change — generation is accessed through the brand context

### Claude's Discretion
- Exact prompt wording and template structure
- Loading state animations and skeleton layout
- Error handling UX (API failures, spend limit reached)
- Form validation approach
- How hook variants are visually displayed in the expandable section
- Whether to use streaming or wait for full response

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/ai.ts`: `getModelConfig()`, `checkAiSpend()`, `logAiSpend()` — all ready for generation calls
- `src/lib/circuit-breaker.ts`: wrap Claude API calls with circuit breaker
- `src/lib/sanitize.ts`: sanitize source text input before passing to AI
- `src/components/ui/skeleton.tsx`: loading states during generation
- `src/components/ui/tabs.tsx`: platform tab switching for preview
- `src/components/ui/textarea.tsx`: editable content areas
- `src/components/ui/badge.tsx`: platform labels, character count indicators
- `src/components/brand-form.tsx`: pattern for server actions with form state

### Established Patterns
- Server actions in `src/app/actions/` (see `brands.ts`, `accounts.ts`)
- Brand detail page at `src/app/(dashboard)/brands/[id]/page.tsx` — add generate link here
- Client components for interactive sections (see `accounts-section.tsx`, `delete-dialog.tsx`)
- Dark mode only, shadcn/ui v4 components throughout
- drizzle-orm for all database operations

### Integration Points
- `src/db/schema.ts`: `posts` and `postPlatforms` tables ready — insert on save
- `src/app/actions/`: new `generate.ts` for generation server action
- `src/app/(dashboard)/brands/[id]/generate/page.tsx`: new generation page
- `socialAccounts` table: query connected accounts for platform checkbox list
- Brand data from `brands` table: voice, topics, dos/donts, examples feed into prompt

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user trusts Claude's judgment on all UX decisions. Follow established patterns: dark mode, minimal, clean dashboard feel. Keep the generation flow simple and single-page.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 2A-brand-profiles-ai-text-generation*
*Context gathered: 2026-03-17*
