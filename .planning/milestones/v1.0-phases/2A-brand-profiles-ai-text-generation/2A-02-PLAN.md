---
phase: 2A-brand-profiles-ai-text-generation
plan: 02
type: execute
wave: 2
depends_on:
  - 2A-01
files_modified:
  - src/app/(dashboard)/brands/[id]/generate/page.tsx
  - src/app/(dashboard)/brands/[id]/page.tsx
autonomous: true
requirements:
  - GEN-01
  - GEN-05
  - GEN-06
  - GEN-07

must_haves:
  truths:
    - "User can enter a URL or paste/type text as source material for content generation"
    - "User can select which connected platform accounts to generate content for"
    - "User can see generated content per-platform in a tabbed preview with character counts"
    - "User can edit the generated content in textareas before saving"
    - "User can expand and see all hook variants with scores for each platform"
    - "User can save all generated content as drafts"
    - "User can navigate to the generation page from the brand detail page"
  artifacts:
    - path: "src/app/(dashboard)/brands/[id]/generate/page.tsx"
      provides: "Generation page with source input, platform selection, AI generation, preview, editing, save"
      min_lines: 150
    - path: "src/app/(dashboard)/brands/[id]/page.tsx"
      provides: "Brand detail page with Generate button linking to /brands/[id]/generate"
      contains: "Generate"
  key_links:
    - from: "src/app/(dashboard)/brands/[id]/generate/page.tsx"
      to: "src/app/actions/generate.ts"
      via: "import { generateContent, saveGeneratedPosts } from '@/app/actions/generate'"
      pattern: "generateContent|saveGeneratedPosts"
    - from: "src/app/(dashboard)/brands/[id]/generate/page.tsx"
      to: "src/db/schema.ts"
      via: "queries socialAccounts for platform checkboxes"
      pattern: "socialAccounts"
    - from: "src/app/(dashboard)/brands/[id]/page.tsx"
      to: "src/app/(dashboard)/brands/[id]/generate/page.tsx"
      via: "Link to /brands/[id]/generate"
      pattern: "generate"
---

<objective>
Build the complete generation page UI at `/brands/[id]/generate` and add a Generate button to the brand detail page.

Purpose: This is the user-facing content creation experience -- the core value proposition of the product. Users input source material, select platforms, trigger AI generation, preview per-platform results with character counts, edit content, view hook variants, and save as drafts.

Output: Working single-page generation flow accessible from the brand detail page.
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
@.planning/phases/2A-brand-profiles-ai-text-generation/2A-01-SUMMARY.md

@src/app/(dashboard)/brands/[id]/page.tsx
@src/app/(dashboard)/brands/[id]/accounts-section.tsx
@src/components/ui/tabs.tsx
@src/components/ui/skeleton.tsx
@src/components/ui/textarea.tsx
@src/components/ui/badge.tsx
@src/components/ui/button.tsx

<interfaces>
<!-- Types from Plan 01 that this plan consumes -->

From src/app/actions/generate.ts (created in Plan 01):
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

export async function generateContent(
  brandId: number,
  platforms: string[],
  sourceText: string,
  sourceUrl: string
): Promise<GenerationResult>

export async function saveGeneratedPosts(
  brandId: number,
  platforms: Record<string, string>,
  sourceText: string,
  sourceUrl: string
): Promise<{ error?: string }>
```

From src/app/(dashboard)/brands/[id]/accounts-section.tsx (established pattern):
```typescript
// Pattern: client component with useTransition for server action calls
const [isPending, startTransition] = useTransition()
// Call server action inside startTransition, store result in useState
```

From src/db/schema.ts:
```typescript
export const socialAccounts = sqliteTable('social_accounts', {
  id: integer().primaryKey(),
  brandId: integer('brand_id').notNull(),
  platform: text().notNull(),
  username: text().notNull(),
  status: text({ enum: ['connected', 'disconnected'] }).notNull().default('connected'),
  // ...
})
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Build the generation page at /brands/[id]/generate</name>
  <files>src/app/(dashboard)/brands/[id]/generate/page.tsx</files>
  <action>
Create `src/app/(dashboard)/brands/[id]/generate/page.tsx`. This is a SERVER component (thin wrapper) that queries brand + accounts data, then renders a CLIENT component `GenerateSection` for all interactive behavior.

**File structure:**
The page.tsx file should contain both the server page component and the client GenerateSection component. Use a `'use client'` boundary by extracting GenerateSection into the same file with a clear separation, OR create the client component inline. The established pattern (accounts-section.tsx) puts the client component in a separate file, but since this page IS the client component with a thin server wrapper, keep it in one file with the server component at top and client component below, separated by the `'use client'` comment approach. Actually, the simplest approach: make page.tsx a server component that fetches data, and create a `generate-section.tsx` client component in the same directory. But to keep files_modified minimal, put everything in page.tsx using this pattern:

```
// page.tsx (server component)
export default async function GeneratePage({ params }) {
  // fetch brand + accounts
  // pass as props to GenerateSection
}

// Separate file: generate-section.tsx ('use client')
```

Actually, create TWO files in this task:
- `src/app/(dashboard)/brands/[id]/generate/page.tsx` -- thin server component
- `src/app/(dashboard)/brands/[id]/generate/generate-section.tsx` -- client component with all interactivity

**Server component (page.tsx):**
1. Accept `params: Promise<{ id: string }>` (Next.js 15 async params).
2. Parse brandId, query brand from DB, query socialAccounts where brandId matches AND status = 'connected'.
3. If brand not found, call `notFound()`.
4. Render page header ("Generate Content" with brand name) and `<GenerateSection>` with props: brandId, brand (for display), accounts (connected only).

**Client component (generate-section.tsx):**

`'use client'` at top. Imports: `useState`, `useTransition` from React. `generateContent`, `saveGeneratedPosts`, `GenerationResult` from `@/app/actions/generate`. shadcn components: Button, Tabs/TabsList/TabsTrigger/TabsContent, Textarea, Badge, Skeleton, Input, Label, Checkbox (or use native checkboxes).

**State:**
- `sourceText: string` -- textarea content
- `sourceUrl: string` -- URL input content
- `selectedPlatforms: string[]` -- checked platform names
- `result: GenerationResult | null` -- AI generation output
- `editedContent: Record<string, string>` -- user-edited content per platform (initialized from result)
- `expandedHooks: string | null` -- which platform's hook variants are expanded
- `isPending` via `useTransition` -- generation loading state
- `isSaving` via separate `useTransition` -- save loading state
- `error: string | null` -- error message display

**Layout (single page, top to bottom):**

1. **Source Input Section:**
   - URL input: `<Input>` with placeholder "Paste a URL (article, blog post, etc.)". Bound to `sourceUrl`.
   - "or" divider text.
   - Text input: `<Textarea>` with placeholder "Type or paste your source content here..." with 6 rows. Bound to `sourceText`.

2. **Platform Selection Section:**
   - Label: "Target Platforms"
   - For each connected account: a checkbox with platform label and @username. Use native `<input type="checkbox">` or shadcn Checkbox. Toggle platform in `selectedPlatforms` array.
   - If no connected accounts, show message: "No connected accounts. Connect accounts on Upload-Post, then sync from the brand page."

3. **Generate Button:**
   - `<Button>` labeled "Generate Content" (or "Generating..." when isPending).
   - Disabled when: isPending, or (sourceText is empty AND sourceUrl is empty), or selectedPlatforms is empty.
   - onClick: call `startTransition(async () => { const res = await generateContent(brandId, selectedPlatforms, sourceText, sourceUrl); if (res.error) setError(res.error); else { setResult(res); setEditedContent(Object.fromEntries(Object.entries(res.platforms).map(([k, v]) => [k, v.content]))); setError(null); } })`.

4. **Loading State:**
   - When `isPending` is true, show Skeleton components mimicking the results layout (3-4 skeleton blocks).

5. **Error Display:**
   - If `error` is set, show a red error banner with the message. Dismissable or auto-cleared on next generation.

6. **Results Section (only visible when result is not null and not isPending):**
   - Use `<Tabs>` component with one tab per platform in the result.
   - TabsList: one TabsTrigger per platform key (capitalize platform name, show platform icon from lucide-react if available -- Twitter/X, LinkedIn, Instagram, TikTok).
   - Each TabsContent contains:
     a. **Hook Variants Toggle:** A clickable text/button "View hook variants (5)" that toggles `expandedHooks` for this platform. When expanded, show a list of all variants with their scores as small badges (score/10). Highlight the winning hook (highest score) with a distinct style.
     b. **Content Textarea:** `<Textarea>` with the content, bound to `editedContent[platform]`. When user edits, update `editedContent`. Use 8-10 rows for comfortable editing.
     c. **Character Count:** Below the textarea, show current character count vs platform limit. Use color coding: normal text color when under 90%, yellow (`text-yellow-500`) at 90-99%, red (`text-destructive`) at 100%+. Format: "142 / 280 characters". Platform limits: twitter/x = 280, linkedin = 3000, instagram = 2200, tiktok = 2200.

7. **Action Buttons (below results):**
   - "Save as Draft" button: calls `saveGeneratedPosts(brandId, editedContent, sourceText, sourceUrl)`. This action redirects, so do NOT wrap in startTransition -- call directly. Show "Saving..." text while isSaving.
   - "Generate Again" button: re-runs generation with same source material (same as Generate button click). Clears previous results first.

8. **Cost Display:** Small muted text below action buttons showing "AI cost: $0.003" from `result.totalCostUsd`.

**Styling notes:**
- Dark mode only (matches project convention).
- Use existing shadcn component classes throughout.
- Clean, minimal spacing. Use `space-y-6` for major sections, `space-y-3` for subsections.
- No animations beyond what Skeleton provides.
- All text uses standard Tailwind dark-mode-friendly classes.

**Platform character limits constant** (duplicate from generate.ts for client-side display):
```typescript
const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 280, x: 280, linkedin: 3000, instagram: 2200, tiktok: 2200,
}
```

**Character count color helper:**
```typescript
function getCharCountColor(current: number, limit: number): string {
  const ratio = current / limit
  if (ratio >= 1.0) return 'text-destructive'
  if (ratio >= 0.9) return 'text-yellow-500'
  return 'text-muted-foreground'
}
```
  </action>
  <verify>
    <automated>cd C:/Users/simon/Documents/GitHub/social && npx tsc --noEmit 2>&1 | head -30 && echo "---" && test -f "src/app/(dashboard)/brands/[id]/generate/page.tsx" && echo "Page exists" && test -f "src/app/(dashboard)/brands/[id]/generate/generate-section.tsx" && echo "Section exists"</automated>
  </verify>
  <done>Generation page renders at /brands/[id]/generate with: URL input + text textarea for source material, platform checkboxes for connected accounts, Generate button that calls the server action, loading skeleton during generation, tabbed results with per-platform content in editable textareas, character count with color coding, expandable hook variants with scores, Save as Draft and Generate Again buttons. All TypeScript compiles cleanly.</done>
</task>

<task type="auto">
  <name>Task 2: Add Generate button to brand detail page</name>
  <files>src/app/(dashboard)/brands/[id]/page.tsx</files>
  <action>
Modify `src/app/(dashboard)/brands/[id]/page.tsx` to add a "Generate Content" button/link in the header actions area.

Current header has an "Edit Brand" button. Add a "Generate Content" button next to it (before or after Edit Brand -- use your judgment on visual hierarchy).

Implementation:
1. Add `import` for any needed icon from lucide-react (e.g., `Sparkles` for AI generation).
2. In the header `<div>` that contains "Edit Brand", add a second Button:
   ```tsx
   <Button variant="default" size="sm" render={<Link href={`/brands/${brand.id}/generate`} />}>
     <Sparkles className="mr-2 h-4 w-4" />
     Generate Content
   </Button>
   ```
   Use `variant="default"` (primary) for the Generate button to make it visually prominent, and keep Edit Brand as `variant="outline"` (secondary). The Generate button is the primary action on this page.

3. Wrap both buttons in a `<div className="flex items-center gap-2">` if not already wrapped.

The `render={<Link />}` pattern is established (used for Edit Brand button already). Follow this exact pattern.
  </action>
  <verify>
    <automated>cd C:/Users/simon/Documents/GitHub/social && grep -n "generate" "src/app/(dashboard)/brands/[id]/page.tsx" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Brand detail page has a "Generate Content" button (primary variant with Sparkles icon) that links to /brands/[id]/generate. Button appears next to "Edit Brand" in the header. TypeScript compiles cleanly.</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passes with no errors
2. Generation page file exists at `src/app/(dashboard)/brands/[id]/generate/page.tsx`
3. Generate section client component exists at `src/app/(dashboard)/brands/[id]/generate/generate-section.tsx`
4. Brand detail page contains link to `/brands/[id]/generate`
5. `npm run dev` starts and navigating to `/brands/1/generate` renders the page (requires a brand with id=1 to exist)
</verification>

<success_criteria>
- Generation page renders with source input section (URL + text), platform checkboxes, and generate button
- Clicking generate calls the server action and shows loading skeleton
- Results appear in tabbed layout with per-platform content in editable textareas
- Character counts display with proper color coding (green/yellow/red)
- Hook variants expandable per platform showing scores
- Save as Draft creates DB rows and redirects to brand detail
- Generate Again re-runs with same source material
- Brand detail page has prominent Generate Content button linking to generation page
</success_criteria>

<output>
After completion, create `.planning/phases/2A-brand-profiles-ai-text-generation/2A-02-SUMMARY.md`
</output>
