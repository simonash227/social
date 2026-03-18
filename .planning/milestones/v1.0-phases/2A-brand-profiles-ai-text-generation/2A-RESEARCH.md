# Phase 2A: Brand Profiles + AI Text Generation - Research

**Researched:** 2026-03-17
**Domain:** Anthropic SDK structured outputs, Next.js 15 server actions, React 19 client state patterns
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Page:** Single-page creation flow at `/brands/[id]/generate` — not a multi-step wizard
- **Source input:** Textarea for raw text + URL field; URL stored as `sourceUrl`, raw text as `sourceText`; no extraction logic yet (Phase 3), pass directly to Claude as context
- **Platform selection:** Checkboxes for each connected account from `socialAccounts` table
- **Generation trigger:** "Generate" button calls server action → Claude API → returns per-platform content
- **Loading state:** Show loading skeleton while AI generates (reuse existing Skeleton component)
- **Results layout:** Per-platform cards appear below, each editable

- **AI system prompt includes:** brand voice/tone, target audience, goals, topics, dos/donts, example posts, platform-specific notes, banned hashtags
- **AI user prompt includes:** source material (text or URL), target platform name and constraints
- **Generation call:** All platforms in a single Claude API call (structured output with platform keys)
- **Primary model:** `getModelConfig().primary` (Sonnet in testing, Opus in production)
- **Spend:** `logAiSpend()` + `checkAiSpend()` before calling

- **Hook optimization:** Second Claude call after initial generation; 5 hook/title variants per platform post, each self-scored 1-10; auto-select highest-scoring hook; user can expand to see all variants with scores
- **Hook model:** `getModelConfig().critique` (Haiku in testing, Sonnet in production)
- **Cost logging:** Single combined cost logged per generation session

- **Preview:** Tab-based, one tab per platform; platform icon, character count with limit indicator, generated content in textarea
- **Character limits:** X (280), LinkedIn (3000), Instagram (2200), TikTok (2200)
- **Limit warnings:** Yellow at 90%, red at 100% — not hard blocks
- **No platform UI mockup** — clean text preview only

- **Save as Draft:** Creates one `posts` row (sourceUrl/sourceText, content=primary platform content, brandId, qualityScore=null) + one `postPlatforms` row per platform (platform-specific content, status=pending)
- **Generate Again:** Re-runs with same source material
- **No direct publish** from this page — publishing is Phase 5
- **After save:** Redirect to brand detail page

- **Navigation:** Add "Generate" button/link on brand detail page (`/brands/[id]/page.tsx`)
- **Route:** `/brands/[id]/generate`

### Claude's Discretion
- Exact prompt wording and template structure
- Loading state animations and skeleton layout
- Error handling UX (API failures, spend limit reached)
- Form validation approach
- How hook variants are visually displayed in the expandable section
- Whether to use streaming or wait for full response

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GEN-01 | User can paste a URL or type text as a content source | URL input + textarea in generate page; stored as sourceUrl/sourceText on posts table |
| GEN-03 | AI generates platform-optimized text content using brand voice and context | Anthropic SDK messages.create with structured output; system prompt uses all brand fields |
| GEN-04 | AI generates 5-10 hook/title variants, self-scores them, and uses the best one | Second Claude call (critique model) returning scored variants array; auto-select max score |
| GEN-05 | User can select target platforms (checkboxes for each connected account) | Query socialAccounts for brand, render checkboxes, pass selected platforms to generation action |
| GEN-06 | User can preview generated content per platform before publishing | Tabs component with per-platform content; character count display |
| GEN-07 | User can edit generated content before publishing | Controlled textareas for each platform post; state held in client component |
| GEN-08 | AI model selection is configurable via AI_MODE env var (testing vs production) | Already implemented in src/lib/ai.ts via getModelConfig(); just needs to be called |
</phase_requirements>

---

## Summary

Phase 2A requires installing the Anthropic SDK (`@anthropic-ai/sdk` v0.79.0), creating a generation server action that calls Claude twice (once for per-platform content, once for hook scoring), and building a single-page generation UI at `/brands/[id]/generate`. The entire phase works within the existing project patterns — server actions, drizzle inserts, shadcn/ui components — with one critical schema addition: `postPlatforms` is missing a `content` column which must be added via drizzle migration before this phase can function.

The generation flow uses the Anthropic SDK's `messages.create` with a JSON-in-prompt approach (not the `output_config` structured outputs feature) because the project's models include `claude-haiku-3-20250307` for critique, and native structured outputs only support the `.5`/`.6` model versions. The reliable approach is prompting for JSON in the system/user prompt and parsing the response with `JSON.parse()`.

**Primary recommendation:** Install `@anthropic-ai/sdk@^0.79.0`, add `content` column to `postPlatforms` table via migration, build generation server action with circuit-breaker-wrapped Claude calls, then build the page as a client component with `useTransition` for pending state.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | ^0.79.0 | Claude API calls | Official Anthropic SDK — not in package.json yet, must be added |
| `drizzle-orm` | 0.45.1 | DB insert/query | Already installed, use for migration + new rows |
| `@base-ui/react` | ^1.3.0 | UI primitives (Tabs, Dialog) | Already installed, shadcn components wrap it |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^0.577.0 | Platform icons | Use in tab triggers and platform checkboxes |
| `src/lib/circuit-breaker.ts` | internal | Wrap Claude calls | `getBreaker('anthropic').call(...)` |
| `src/lib/sanitize.ts` | internal | Clean source text | Sanitize textarea input before passing to Claude |
| `src/lib/ai.ts` | internal | Model config + spend | `getModelConfig()`, `checkAiSpend()`, `logAiSpend()` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct `@anthropic-ai/sdk` | `@ai-sdk/anthropic` (Vercel AI SDK) | Vercel AI SDK adds streaming UX easily, but project is already scoped to direct SDK pattern; adds dependency |
| JSON-in-prompt parsing | `output_config.format` structured outputs | Native structured outputs only support `.5`/`.6` models; haiku-3 is not supported. JSON prompt approach works with all models in the project. |
| `useTransition` + server action | Route handler + `fetch` | Server action pattern already established throughout project |

**Installation:**
```bash
npm install @anthropic-ai/sdk
```

---

## Architecture Patterns

### Recommended File Structure
```
src/
├── app/
│   ├── actions/
│   │   └── generate.ts            # NEW: generateContent server action
│   └── (dashboard)/
│       └── brands/
│           └── [id]/
│               ├── page.tsx        # MODIFY: add Generate button
│               └── generate/
│                   └── page.tsx    # NEW: generation page (client component)
├── lib/
│   └── ai.ts                      # EXISTING: getModelConfig, checkAiSpend, logAiSpend
└── db/
    ├── schema.ts                   # MODIFY: add content column to postPlatforms
    └── migrations/
        └── 0001_add_post_platform_content.sql  # NEW: migration
```

### Pattern 1: Server Action with Return Value (not redirect)

The generation action cannot use `redirect()` — it must return data to the client. This is different from the brands/accounts actions which redirect after success. The client holds AI results in `useState`.

**What:** Server action returns a result object; client component stores it in state.
**When to use:** When the action produces data the UI must display (AI generation results).

```typescript
// Source: established pattern in src/app/actions/accounts.ts (returns {synced, error})
// Extended for generation

'use server'

export interface GenerationResult {
  platforms: Record<string, {
    content: string
    hookVariants: Array<{ text: string; score: number }>
    winningHook: string
  }>
  totalCostUsd: number
  error?: string
}

export async function generateContent(
  brandId: number,
  platforms: string[],
  sourceText: string,
  sourceUrl: string
): Promise<GenerationResult> {
  // 1. checkAiSpend() — abort if over limit
  // 2. getBreaker('anthropic').call(() => anthropic.messages.create(...))
  // 3. parse JSON from response
  // 4. second call for hook scoring
  // 5. logAiSpend() for combined tokens
  // 6. return result
}
```

### Pattern 2: Client Component with useTransition for Server Actions

**What:** Client component calls server action via `startTransition`, uses `isPending` for loading state.
**When to use:** Anytime a server action returns data (not redirects) and loading UI is needed.

```typescript
// Source: established pattern in src/app/(dashboard)/brands/[id]/accounts-section.tsx
'use client'

import { useState, useTransition } from 'react'
import { generateContent, type GenerationResult } from '@/app/actions/generate'

export function GeneratePage({ brandId, accounts, brand }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleGenerate() {
    startTransition(async () => {
      const res = await generateContent(brandId, selectedPlatforms, sourceText, sourceUrl)
      if (res.error) {
        setError(res.error)
      } else {
        setResult(res)
      }
    })
  }
  // ...
}
```

**Known issue (MEDIUM confidence):** There is a Next.js 15 discussion thread reporting `isPending` staying `true` after `revalidatePath()`. Since the generation action does NOT call `revalidatePath()` or `redirect()` (it returns data), this issue does not apply here. The save action calls `redirect()` which terminates the component — no isPending issue.

### Pattern 3: Anthropic SDK Messages Call

**What:** Direct SDK call wrapped in circuit breaker; JSON response parsed from text content.
**When to use:** All Claude API calls in this project.

```typescript
// Source: @anthropic-ai/sdk docs, circuit-breaker.ts pattern
import Anthropic from '@anthropic-ai/sdk'
import { getBreaker } from '@/lib/circuit-breaker'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const response = await getBreaker('anthropic').call(() =>
  anthropic.messages.create({
    model: getModelConfig().primary,
    max_tokens: 4096,
    system: buildSystemPrompt(brand),
    messages: [{ role: 'user', content: buildUserPrompt(platforms, sourceText, sourceUrl) }],
  })
)

const text = response.content[0].type === 'text' ? response.content[0].text : ''
const parsed = JSON.parse(text) as GenerationOutputShape
```

### Pattern 4: Structured JSON via Prompt Engineering

Since `claude-haiku-3-20250307` does NOT support `output_config.format` (only `.5`/`.6` model versions do), use prompt-based JSON extraction for both the generation call and the hook scoring call.

**What:** System prompt instructs Claude to respond ONLY with valid JSON matching a specified shape.
**When to use:** Any call where structured output is needed and model may not support native structured outputs.

```typescript
// Generation system prompt closing instruction:
`
Respond with ONLY valid JSON — no markdown fences, no commentary:
{
  "twitter": { "content": "..." },
  "linkedin": { "content": "..." },
  "instagram": { "content": "..." }
}
Only include keys for the platforms requested.
`

// Hook scoring system prompt closing instruction:
`
Respond with ONLY valid JSON — no markdown fences, no commentary:
{
  "twitter": {
    "variants": [
      { "text": "...", "score": 8 },
      ...
    ]
  }
}
`
```

### Pattern 5: Schema Migration for postPlatforms.content

The existing `post_platforms` table has no `content` column. Platform-specific generated text must be stored per-platform. This requires a drizzle migration.

**Schema change needed:**
```typescript
// In src/db/schema.ts — add content to postPlatforms:
export const postPlatforms = sqliteTable('post_platforms', {
  id:           integer().primaryKey({ autoIncrement: true }),
  postId:       integer('post_id').notNull().references(() => posts.id),
  platform:     text().notNull(),
  content:      text(),    // NEW: platform-specific generated content
  status:       text({ enum: ['pending', 'published', 'failed'] }).notNull().default('pending'),
  failureCount: integer('failure_count').notNull().default(0),
  requestId:    text('request_id'),
})
```

Migration SQL:
```sql
ALTER TABLE `post_platforms` ADD `content` text;
```

### Anti-Patterns to Avoid

- **Don't use `output_config.format`** with `claude-haiku-3-20250307` — it throws an API error; haiku-3 is not a supported model for native structured outputs.
- **Don't call `redirect()` in the generation action** — must return data to client. Save action can redirect.
- **Don't use `form action=` pattern** for generation — this phase requires programmatic invocation from a button with `startTransition`.
- **Don't create a new Anthropic client per request** — instantiate once at module level (server module, so safe).
- **Don't store hook variants in the database** — they are ephemeral UI state only; only the winning hook content goes into `postPlatforms.content`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Claude API HTTP calls | Custom fetch wrapper | `@anthropic-ai/sdk` | SDK handles auth headers, retries, streaming, error types |
| API failure protection | Custom retry + backoff | `getBreaker('anthropic')` already exists | Circuit breaker in `src/lib/circuit-breaker.ts` is ready to use |
| Text sanitization | Custom HTML stripper | `sanitizeText()` from `src/lib/sanitize.ts` | Already handles HTML, invisible Unicode, whitespace normalization |
| Loading skeleton | Custom spinner | `<Skeleton>` from `src/components/ui/skeleton.tsx` | Already built, matches dark-mode design |
| Tab switching | Custom state | `<Tabs>` from `src/components/ui/tabs.tsx` | Already wraps `@base-ui/react/tabs`, project-consistent |
| Model selection | Config constants | `getModelConfig()` from `src/lib/ai.ts` | Already reads AI_MODE and returns correct model names |
| Spend tracking | Custom DB calls | `checkAiSpend()` + `logAiSpend()` from `src/lib/ai.ts` | Already implemented with daily total and hard stop |

**Key insight:** The entire infrastructure layer is built. Phase 2A only needs to: (1) install the SDK, (2) add the migration, (3) write the prompt builder, (4) write the server action, (5) build the page UI.

---

## Common Pitfalls

### Pitfall 1: postPlatforms Missing content Column
**What goes wrong:** Attempting to insert platform-specific content into `postPlatforms` will throw a drizzle/sqlite error because the column doesn't exist.
**Why it happens:** The schema was defined in Phase 1 before content generation was designed.
**How to avoid:** Wave 0 of this phase must add `content text` to `postPlatforms` schema + generate migration + run it.
**Warning signs:** TypeScript error on `postPlatforms.content` if schema not updated; runtime SQL error if migration not run.

### Pitfall 2: haiku-3 Incompatibility with Native Structured Outputs
**What goes wrong:** Passing `output_config.format` to `claude-haiku-3-20250307` returns an API error.
**Why it happens:** Native structured outputs only support models ending in `.5` or `.6` (claude-haiku-4-5, claude-sonnet-4-5, claude-sonnet-4-6, claude-opus-4-5, claude-opus-4-6). The project uses haiku-3 in testing mode for the critique model.
**How to avoid:** Use prompt-based JSON for all calls. Add explicit instructions: "Respond with ONLY valid JSON, no markdown fences."
**Warning signs:** API 400 errors containing "unsupported model" or "invalid parameter" when using output_config.

### Pitfall 3: Anthropic SDK Not Installed
**What goes wrong:** `import Anthropic from '@anthropic-ai/sdk'` fails to resolve — the SDK is referenced in code comments and `ai.ts` context but is not in `package.json`.
**Why it happens:** The project planned AI infrastructure (getModelConfig, logAiSpend) without installing the SDK because no AI calls existed yet.
**How to avoid:** `npm install @anthropic-ai/sdk` in Wave 0.
**Warning signs:** Module resolution TypeScript error on import.

### Pitfall 4: Server Component for Generation Page
**What goes wrong:** Generation page built as a server component can't hold the generated results in state.
**Why it happens:** Default in App Router is server components.
**How to avoid:** Generation page must be `'use client'` or split: thin server page that passes brand/accounts as props to a client `GenerateSection` component.
**Warning signs:** `useState` or `useTransition` import errors at build time.

### Pitfall 5: Malformed JSON from Claude
**What goes wrong:** `JSON.parse()` throws on Claude's response despite prompt instructions.
**Why it happens:** Model occasionally includes preamble text, markdown fences, or truncates JSON.
**How to avoid:**
1. System prompt: "Respond with ONLY valid JSON. No markdown code fences. No commentary before or after."
2. Extract JSON defensively: strip leading/trailing whitespace, optionally strip ` ```json ` and ` ``` ` if present.
3. Wrap `JSON.parse()` in try/catch, return `{ error: 'Generation failed: invalid response format' }`.
**Warning signs:** `SyntaxError: Unexpected token` in server action logs.

### Pitfall 6: ANTHROPIC_API_KEY Not Set
**What goes wrong:** `new Anthropic()` without an explicit `apiKey` reads from `process.env.ANTHROPIC_API_KEY` — if not set, SDK throws.
**Why it happens:** Environment variable not added to `.env.local` or Railway config.
**How to avoid:** Explicit check at instantiation time with a clear error message; document required env var.
**Warning signs:** `Error: The ANTHROPIC_API_KEY environment variable is missing or empty`.

### Pitfall 7: isPending Stays True (Known Next.js 15 Bug)
**What goes wrong:** After save action calls `redirect()`, the page navigates away — but if `revalidatePath()` is called from within `startTransition`, `isPending` can get stuck.
**Why it happens:** Next.js 15 + React 19 interaction with cache revalidation.
**How to avoid:** Save action should use `redirect()` (which terminates the request). The generation action returns data without `redirect()`/`revalidatePath()`, so `isPending` resolves normally. Save action should not be wrapped in `startTransition` — call directly since it redirects.
**Warning signs:** Button stays in loading state after successful save.

---

## Code Examples

### Building the Brand System Prompt

```typescript
// src/app/actions/generate.ts
function buildSystemPrompt(brand: BrandType): string {
  const parts: string[] = [
    `You are a social media content writer for the brand "${brand.name}".`,
    '',
    `NICHE: ${brand.niche}`,
    `VOICE AND TONE: ${brand.voiceTone}`,
  ]

  if (brand.targetAudience) {
    parts.push(`TARGET AUDIENCE: ${brand.targetAudience}`)
  }
  if (brand.goals) {
    parts.push(`GOALS: ${brand.goals}`)
  }
  if (brand.topics?.length) {
    parts.push(`TOPICS TO COVER: ${brand.topics.join(', ')}`)
  }
  if (brand.dosList?.length) {
    parts.push(`ALWAYS DO:\n${brand.dosList.map(d => `- ${d}`).join('\n')}`)
  }
  if (brand.dontsList?.length) {
    parts.push(`NEVER DO:\n${brand.dontsList.map(d => `- ${d}`).join('\n')}`)
  }
  if (brand.examplePosts?.length) {
    parts.push(`EXAMPLE POSTS (match this style):\n${brand.examplePosts.join('\n---\n')}`)
  }
  if (brand.bannedHashtags?.length) {
    parts.push(`BANNED HASHTAGS (never use): ${brand.bannedHashtags.join(', ')}`)
  }

  parts.push('')
  parts.push('Respond with ONLY valid JSON — no markdown fences, no commentary.')

  return parts.join('\n')
}
```

### Platform Constraints Definition

```typescript
// Platform character limits and hashtag guidance
const PLATFORM_CONSTRAINTS: Record<string, { limit: number; hashtagNote: string }> = {
  twitter:   { limit: 280,  hashtagNote: '0-3 hashtags' },
  x:         { limit: 280,  hashtagNote: '0-3 hashtags' },
  linkedin:  { limit: 3000, hashtagNote: '3-5 hashtags' },
  instagram: { limit: 2200, hashtagNote: '5-15 hashtags' },
  tiktok:    { limit: 2200, hashtagNote: '3-5 hashtags' },
}
```

### Generation User Prompt

```typescript
function buildGenerationPrompt(
  platforms: string[],
  sourceText: string,
  sourceUrl: string,
  brand: BrandType
): string {
  const source = sourceText
    ? `SOURCE TEXT:\n${sourceText}`
    : `SOURCE URL: ${sourceUrl}\n(Use this URL as context for what the content is about)`

  const platformInstructions = platforms.map(platform => {
    const p = platform.toLowerCase()
    const constraints = PLATFORM_CONSTRAINTS[p] ?? { limit: 2000, hashtagNote: 'appropriate hashtags' }
    const platformNote = brand.platformNotes?.[p] ?? ''
    return [
      `${platform.toUpperCase()}: max ${constraints.limit} characters, ${constraints.hashtagNote}`,
      platformNote ? `  Platform note: ${platformNote}` : '',
    ].filter(Boolean).join('\n')
  }).join('\n')

  return [
    source,
    '',
    'Write a platform-optimized post for each of these platforms:',
    platformInstructions,
    '',
    'Return JSON with this shape:',
    '{',
    platforms.map(p => `  "${p.toLowerCase()}": { "content": "..." }`).join(',\n'),
    '}',
  ].join('\n')
}
```

### Hook Scoring Call

```typescript
function buildHookScoringPrompt(
  platforms: string[],
  generatedContent: Record<string, { content: string }>
): string {
  const entries = platforms.map(p => {
    const content = generatedContent[p.toLowerCase()]?.content ?? ''
    return `${p.toUpperCase()}: "${content.slice(0, 100)}..."`
  }).join('\n')

  return [
    'For each platform post below, generate 5 alternative hook/title variants.',
    'Score each variant 1-10 based on attention-grab, relevance, and brand fit.',
    '',
    entries,
    '',
    'Return JSON:',
    '{',
    platforms.map(p => [
      `  "${p.toLowerCase()}": {`,
      '    "variants": [',
      '      { "text": "...", "score": 8 },',
      '      ...',
      '    ]',
      '  }',
    ].join('\n')).join(',\n'),
    '}',
  ].join('\n')
}
```

### Token Cost Calculation

```typescript
// Approximate pricing (testing mode uses Sonnet 4 + Haiku 3)
// Source: platform.claude.com/docs/en/api/pricing
function calculateCostUsd(model: string, inputTokens: number, outputTokens: number): string {
  // Prices per million tokens
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-20250514': { input: 3.00,  output: 15.00 },
    'claude-opus-4-20250514':   { input: 15.00, output: 75.00 },
    'claude-haiku-3-20250307':  { input: 0.25,  output: 1.25  },
  }
  const p = pricing[model] ?? { input: 3.00, output: 15.00 }
  const cost = (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output
  return cost.toFixed(6)
}
```

### Character Count Indicator

```typescript
// Used in platform preview textarea
function getCharCountColor(current: number, limit: number): string {
  const ratio = current / limit
  if (ratio >= 1.0) return 'text-destructive'   // red: at/over limit
  if (ratio >= 0.9) return 'text-yellow-500'    // yellow: 90%+
  return 'text-muted-foreground'                 // normal
}
```

### Defensive JSON Parse

```typescript
function parseJsonResponse<T>(text: string): T {
  // Strip markdown fences if present
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  return JSON.parse(cleaned) as T
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prompt Claude to return JSON (unreliable) | Native structured outputs via `output_config.format` | Nov 2025 (GA Mar 2026) | Guaranteed valid JSON, but only for models `.5`/`.6` |
| Beta header `structured-outputs-2025-11-13` | No header needed; `output_config.format` is GA | Mar 2026 | Simpler SDK usage |
| `output_format` parameter | `output_config.format` (migrated) | Early 2026 | Old `output_format` still works temporarily |

**Context for this project:** Since `claude-haiku-3-20250307` (used as critique model in testing mode) does NOT support native structured outputs, and the project must work in both testing and production modes, **prompt-based JSON extraction is the correct approach for all calls in this phase**. Native structured outputs can be adopted when the project upgrades to haiku-4-5 or later.

**Deprecated/outdated:**
- `anthropic-beta: structured-outputs-2025-11-13` header: no longer required; feature is GA
- `output_format` top-level parameter: replaced by `output_config.format`; temporary compatibility maintained

---

## Open Questions

1. **ANTHROPIC_API_KEY environment variable**
   - What we know: The SDK reads it from `process.env.ANTHROPIC_API_KEY` automatically
   - What's unclear: Whether it's already set in the Railway environment / `.env.local` for development
   - Recommendation: Wave 0 task should verify env var is configured; add to `.env.local.example` documentation

2. **Streaming vs. wait-for-full-response**
   - What we know: Marked as Claude's discretion; streaming would reduce perceived latency on long AI calls
   - What's unclear: Whether streaming from a server action is practical (server actions don't stream natively; would require route handler + ReadableStream)
   - Recommendation: Use non-streaming (wait for full response) for simplicity. Generation takes ~3-8 seconds, which skeleton UI adequately covers. Streaming adds significant complexity via route handlers.

3. **postPlatforms content column nullability**
   - What we know: The column needs to exist; it stores AI-generated text per platform
   - What's unclear: Whether it should be `NOT NULL` (draft saves always have content) or nullable (cron-generated posts in Phase 6 may be created before content exists)
   - Recommendation: Make it nullable (`text()` without `.notNull()`) to avoid breaking Phase 6 pipeline patterns.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no jest/vitest/pytest config present |
| Config file | Wave 0 gap — none exists |
| Quick run command | N/A — Wave 0 gap |
| Full suite command | N/A — Wave 0 gap |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GEN-01 | URL and text inputs render and bind to state | manual | N/A | ❌ Wave 0 |
| GEN-03 | generateContent action returns per-platform content | unit | N/A — no test framework | ❌ Wave 0 |
| GEN-04 | Hook variants returned with scores; winner selected | unit | N/A — no test framework | ❌ Wave 0 |
| GEN-05 | Platform checkboxes populated from socialAccounts | manual | N/A | ❌ Wave 0 |
| GEN-06 | Tab per platform shows content and char count | manual | N/A | ❌ Wave 0 |
| GEN-07 | Textarea edits update state | manual | N/A | ❌ Wave 0 |
| GEN-08 | AI_MODE=testing uses Sonnet+Haiku; production uses Opus+Sonnet | unit | N/A — no test framework | ❌ Wave 0 (getModelConfig already exists) |

### Sampling Rate
- Per task commit: manual smoke test (run dev, navigate to `/brands/[id]/generate`, verify UI renders)
- Per wave merge: manual end-to-end (generate content, view results, save draft, verify DB rows)
- Phase gate: Full manual flow green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No test framework installed — testing is manual for this project
- [ ] `@anthropic-ai/sdk` not in package.json — install before any AI calls
- [ ] `content` column missing from `post_platforms` table — migration must be Wave 0 task

*(Note: This project has no automated test infrastructure. All validation is manual, end-to-end, running the dev server.)*

---

## Sources

### Primary (HIGH confidence)
- Official Anthropic API docs (platform.claude.com) — structured outputs feature, model compatibility, SDK usage
- `src/db/schema.ts` + `src/db/migrations/0000_absent_squadron_sinister.sql` — confirmed `content` column absent from `post_platforms`
- `src/lib/ai.ts` — confirmed model names: `claude-haiku-3-20250307` does not support native structured outputs
- `package.json` — confirmed `@anthropic-ai/sdk` not installed
- `src/app/actions/accounts.ts` — confirmed server action return-value pattern
- `src/app/(dashboard)/brands/[id]/accounts-section.tsx` — confirmed `useTransition` + `startTransition` pattern

### Secondary (MEDIUM confidence)
- WebSearch: `@anthropic-ai/sdk` version 0.79.0 is current (March 2026) — verified against GitHub releases
- WebSearch: Structured outputs GA for `.5`/`.6` model versions only — cross-referenced with official docs

### Tertiary (LOW confidence)
- WebSearch: Next.js 15 `isPending` bug with `revalidatePath()` inside `startTransition` — multiple community reports; mitigation: don't call `revalidatePath()` from generation action (it returns data, no revalidation needed)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing dependencies confirmed from package.json; SDK version from npm/GitHub
- Architecture: HIGH — all patterns verified from existing codebase code
- Structured output approach: HIGH — confirmed from official Anthropic docs that haiku-3 is excluded
- Schema gap (postPlatforms.content): HIGH — confirmed from migration SQL and schema.ts
- Pitfalls: HIGH for SDK/schema; MEDIUM for isPending bug (community reports, not official docs)

**Research date:** 2026-03-17
**Valid until:** 2026-04-17 (Anthropic SDK stable; model pricing/availability can change)
