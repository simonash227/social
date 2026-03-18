---
phase: 2A-brand-profiles-ai-text-generation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - src/db/schema.ts
  - src/db/migrations/0001_add_post_platform_content.sql
  - src/app/actions/generate.ts
autonomous: true
requirements:
  - GEN-03
  - GEN-04
  - GEN-08

must_haves:
  truths:
    - "generateContent server action calls Claude API with brand context and returns per-platform content"
    - "Hook optimization generates 5 variants per platform post, scores them, and selects the best"
    - "AI model selection uses getModelConfig() which reads AI_MODE env var"
    - "postPlatforms table has a content column for storing platform-specific generated text"
  artifacts:
    - path: "src/app/actions/generate.ts"
      provides: "generateContent server action, buildSystemPrompt, buildGenerationPrompt, buildHookScoringPrompt, parseJsonResponse, PLATFORM_CONSTRAINTS"
      exports: ["generateContent", "saveGeneratedPosts", "GenerationResult"]
    - path: "src/db/schema.ts"
      provides: "Updated postPlatforms table with content column"
      contains: "content.*text"
    - path: "src/db/migrations/0001_add_post_platform_content.sql"
      provides: "Migration adding content column to post_platforms"
      contains: "ALTER TABLE"
  key_links:
    - from: "src/app/actions/generate.ts"
      to: "src/lib/ai.ts"
      via: "getModelConfig, checkAiSpend, logAiSpend imports"
      pattern: "getModelConfig\\(\\)"
    - from: "src/app/actions/generate.ts"
      to: "src/lib/circuit-breaker.ts"
      via: "getBreaker('anthropic').call() wrapping Claude API calls"
      pattern: "getBreaker.*anthropic"
    - from: "src/app/actions/generate.ts"
      to: "src/db/schema.ts"
      via: "posts and postPlatforms inserts on save"
      pattern: "db\\.insert\\(posts\\)"
---

<objective>
Install the Anthropic SDK, add the missing `content` column to `postPlatforms` via migration, and build the complete AI generation server action with prompt construction and hook optimization.

Purpose: This is the AI backbone of the entire content engine. Without the generation action, no content can be produced. The server action encapsulates all Claude API interaction: brand-aware prompt building, per-platform content generation, hook variant scoring, cost tracking, and draft saving.

Output: Working `generateContent` and `saveGeneratedPosts` server actions that can be called from the generation page UI (Plan 02).
</objective>

<execution_context>
@C:/Users/simon/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/simon/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/2A-brand-profiles-ai-text-generation/2A-CONTEXT.md
@.planning/phases/2A-brand-profiles-ai-text-generation/2A-RESEARCH.md

@src/db/schema.ts
@src/db/index.ts
@src/lib/ai.ts
@src/lib/circuit-breaker.ts
@src/lib/sanitize.ts
@src/app/actions/brands.ts
@drizzle.config.ts

<interfaces>
<!-- Key types and contracts the executor needs. -->

From src/lib/ai.ts:
```typescript
export interface ModelConfig {
  primary: string    // Sonnet in testing, Opus in production
  critique: string   // Haiku in testing, Sonnet in production
  filter: string     // Haiku in both
}
export function getModelConfig(): ModelConfig
export async function checkAiSpend(): Promise<boolean>
export function logAiSpend(params: { brandId?: number; model: string; inputTokens: number; outputTokens: number; costUsd: string }): void
```

From src/lib/circuit-breaker.ts:
```typescript
export function getBreaker(service: string, opts?: CircuitBreakerOptions): CircuitBreaker
// Usage: await getBreaker('anthropic').call(() => apiCall())
```

From src/lib/sanitize.ts:
```typescript
export function sanitizeText(input: string): string
```

From src/db/schema.ts (brands table - fields needed for prompt):
```typescript
export const brands = sqliteTable('brands', {
  id: integer().primaryKey(),
  name: text().notNull(),
  niche: text().notNull(),
  voiceTone: text('voice_tone').notNull(),
  targetAudience: text('target_audience'),
  goals: text(),
  topics: text({ mode: 'json' }).$type<string[]>(),
  dosList: text('dos_list', { mode: 'json' }).$type<string[]>(),
  dontsList: text('donts_list', { mode: 'json' }).$type<string[]>(),
  examplePosts: text('example_posts', { mode: 'json' }).$type<string[]>(),
  platformNotes: text('platform_notes', { mode: 'json' }).$type<Record<string, string>>(),
  bannedHashtags: text('banned_hashtags', { mode: 'json' }).$type<string[]>(),
  // ... other fields
})
```

From src/db/schema.ts (tables for saving):
```typescript
export const posts = sqliteTable('posts', {
  id: integer().primaryKey({ autoIncrement: true }),
  brandId: integer('brand_id').notNull(),
  sourceUrl: text('source_url'),
  sourceText: text('source_text'),
  content: text().notNull(),
  status: text({ enum: ['draft','scheduled','published','failed'] }).notNull().default('draft'),
  qualityScore: integer('quality_score'),
  // ...
})
export const postPlatforms = sqliteTable('post_platforms', {
  id: integer().primaryKey({ autoIncrement: true }),
  postId: integer('post_id').notNull(),
  platform: text().notNull(),
  // content column MISSING - Task 1 adds it
  status: text({ enum: ['pending','published','failed'] }).notNull().default('pending'),
  // ...
})
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Anthropic SDK and add postPlatforms content column</name>
  <files>package.json, src/db/schema.ts, src/db/migrations/0001_add_post_platform_content.sql</files>
  <action>
1. Run `npm install @anthropic-ai/sdk` to add the Anthropic SDK to dependencies.

2. Update `src/db/schema.ts` -- add a `content` column to the `postPlatforms` table definition:
   ```typescript
   content: text(),  // nullable -- platform-specific AI-generated content
   ```
   Add it after the `platform` field and before `status`. Make it nullable (no `.notNull()`) because Phase 6 automation pipeline may create postPlatform rows before content is generated.

3. Create migration file `src/db/migrations/0001_add_post_platform_content.sql`:
   ```sql
   ALTER TABLE `post_platforms` ADD `content` text;
   ```

4. Update the drizzle migration metadata. Run `npx drizzle-kit generate` to let drizzle-kit create the proper migration with its metadata journal entry in `src/db/migrations/meta/`. If drizzle-kit generates a different migration file name, use that instead of manually creating the SQL file. The key requirement is that `post_platforms` gets a `content text` column.

Note: Migrations auto-run on first DB connection via `migrate()` in `src/db/index.ts`, so no explicit migration command needed at runtime.
  </action>
  <verify>
    <automated>cd C:/Users/simon/Documents/GitHub/social && node -e "require('@anthropic-ai/sdk')" && echo "SDK OK" && grep -q "content.*text" src/db/schema.ts && echo "Schema OK" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>@anthropic-ai/sdk in package.json dependencies. postPlatforms schema has content column. Migration SQL exists. TypeScript compiles without errors related to these changes.</done>
</task>

<task type="auto">
  <name>Task 2: Build generation server action with prompt construction and hook optimization</name>
  <files>src/app/actions/generate.ts</files>
  <action>
Create `src/app/actions/generate.ts` with `'use server'` directive. This file contains:

**Exports:**
- `GenerationResult` interface (returned to client)
- `generateContent(brandId: number, platforms: string[], sourceText: string, sourceUrl: string): Promise<GenerationResult>` -- main generation action
- `saveGeneratedPosts(brandId: number, platforms: Record<string, string>, sourceText: string, sourceUrl: string): Promise<{ error?: string }>` -- save action

**Internal helpers (not exported):**
- `buildSystemPrompt(brand): string` -- constructs system prompt from brand fields
- `buildGenerationPrompt(platforms, sourceText, sourceUrl, brand): string` -- constructs user prompt
- `buildHookScoringPrompt(platforms, generatedContent): string` -- constructs hook scoring prompt
- `parseJsonResponse<T>(text: string): T` -- defensive JSON parser
- `calculateCostUsd(model, inputTokens, outputTokens): string` -- cost calculation
- `PLATFORM_CONSTRAINTS` constant -- character limits and hashtag guidance per platform

**GenerationResult shape:**
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
```

**generateContent implementation flow:**
1. Query brand from DB by brandId (use `getDb()` + drizzle select from `brands` table). Return `{ error }` if not found.
2. Call `checkAiSpend()` -- if returns false, return `{ error: 'Daily AI spend limit reached' }`.
3. If sourceText is provided, sanitize it via `sanitizeText()` from `@/lib/sanitize`.
4. Build system prompt using `buildSystemPrompt(brand)` -- include brand name, niche, voiceTone, targetAudience, goals, topics, dos/donts, examplePosts, platformNotes for selected platforms, bannedHashtags. End with instruction: "Respond with ONLY valid JSON -- no markdown fences, no commentary."
5. Build user prompt using `buildGenerationPrompt(platforms, sourceText, sourceUrl, brand)` -- include source material, platform names with character limits and hashtag guidance from PLATFORM_CONSTRAINTS. Request JSON shape: `{ "platformKey": { "content": "..." } }`.
6. Call Claude via circuit breaker: `getBreaker('anthropic').call(() => anthropic.messages.create({ model: getModelConfig().primary, max_tokens: 4096, system: systemPrompt, messages: [{ role: 'user', content: userPrompt }] }))`. Instantiate `new Anthropic()` at module level (reads ANTHROPIC_API_KEY from env automatically).
7. Parse response: extract text from `response.content[0]`, pass through `parseJsonResponse()`.
8. Log cost for generation call via `logAiSpend()`.
9. Run hook scoring: build hook prompt using `buildHookScoringPrompt()` which takes the generated content and asks for 5 hook/title variants per platform, each scored 1-10 on attention-grab, relevance, and brand fit. Use `getModelConfig().critique` model (Haiku in testing, Sonnet in production). Wrap in circuit breaker.
10. Parse hook response, merge winning hooks into results (highest score per platform replaces first line/sentence of content).
11. Log cost for hook call via `logAiSpend()`.
12. Return `GenerationResult` with combined data and total cost.

**Error handling:**
- Wrap entire flow in try/catch. On error, return `{ platforms: {}, totalCostUsd: 0, error: errorMessage }`.
- `parseJsonResponse` strips markdown fences (```json and ```) before parsing. On parse failure, throw with descriptive message.
- Circuit breaker errors surface as "Service temporarily unavailable" to user.

**PLATFORM_CONSTRAINTS:**
```typescript
const PLATFORM_CONSTRAINTS: Record<string, { limit: number; hashtagNote: string }> = {
  twitter:   { limit: 280,  hashtagNote: '0-3 hashtags' },
  x:         { limit: 280,  hashtagNote: '0-3 hashtags' },
  linkedin:  { limit: 3000, hashtagNote: '3-5 hashtags' },
  instagram: { limit: 2200, hashtagNote: '5-15 hashtags' },
  tiktok:    { limit: 2200, hashtagNote: '3-5 hashtags' },
}
```

**saveGeneratedPosts implementation:**
1. Insert one row into `posts` table with: brandId, sourceUrl (or null), sourceText (or null), content = content from the first platform in the Record, status = 'draft', qualityScore = null.
2. Insert one row into `postPlatforms` per platform key with: postId from the inserted post, platform name, content = platform-specific content, status = 'pending'.
3. Call `revalidatePath('/brands/' + brandId)`.
4. Call `redirect('/brands/' + brandId)`.

**Anti-patterns to avoid (from RESEARCH.md):**
- Do NOT use `output_config.format` structured outputs -- haiku-3 does not support it. Use prompt-based JSON.
- Do NOT call `redirect()` from `generateContent` -- it returns data. Only `saveGeneratedPosts` redirects.
- Do NOT create a new Anthropic client per request -- instantiate once at module level.
- Do NOT store hook variants in the database -- they are ephemeral UI state.
  </action>
  <verify>
    <automated>cd C:/Users/simon/Documents/GitHub/social && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>generateContent action compiles, accepts brandId + platforms + source text/URL, calls Claude API twice (generation + hook scoring), returns GenerationResult with per-platform content and hook variants. saveGeneratedPosts creates posts + postPlatforms rows and redirects. TypeScript has no errors.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. `@anthropic-ai/sdk` resolves in Node: `node -e "require('@anthropic-ai/sdk')"`
3. Schema file contains `content` column in postPlatforms definition
4. Migration SQL file exists with ALTER TABLE statement
5. `src/app/actions/generate.ts` exports `generateContent` and `saveGeneratedPosts`
</verification>

<success_criteria>
- Anthropic SDK installed and importable
- postPlatforms schema updated with nullable content column
- Migration file created and will auto-run on next DB connection
- generateContent server action compiles and exports correct types
- saveGeneratedPosts server action compiles and will insert proper DB rows
- All AI calls wrapped in circuit breaker and cost tracking
</success_criteria>

<output>
After completion, create `.planning/phases/2A-brand-profiles-ai-text-generation/2A-01-SUMMARY.md`
</output>
