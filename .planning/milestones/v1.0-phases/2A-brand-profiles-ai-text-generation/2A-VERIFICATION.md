---
phase: 2A-brand-profiles-ai-text-generation
verified: 2026-03-17T00:00:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification: false
human_verification:
  - test: "End-to-end generation flow with live Claude API"
    expected: "Enter source text, select platforms, click Generate — AI returns per-platform content with 5 hook variants each, character counts display, content is editable, Save as Draft redirects to brand page"
    why_human: "Requires ANTHROPIC_API_KEY configured, live API call, and interactive browser session to confirm the two-pass Claude flow returns well-formed JSON and the UI renders results correctly"
  - test: "URL-as-context generation"
    expected: "Pasting a URL (without source text) into the URL field causes AI to generate content using the URL as contextual reference in the prompt"
    why_human: "The URL is passed as a text hint to Claude — not fetched/scraped. Need to confirm Claude produces relevant content from the URL string alone, not just generic brand content"
  - test: "Hook variant display and winner badge"
    expected: "After generation, clicking 'View hook variants' shows all variants sorted by score, highest-scoring variant has a 'Winner' badge, and that variant is also the winning hook used in the generated content"
    why_human: "Requires live generation result; UI logic is correct in code but interaction with real AI-scored variants needs visual confirmation"
  - test: "Character count color coding"
    expected: "Content near the platform limit (90-99%) shows yellow count, content at or over the limit shows red, content well under shows muted"
    why_human: "Visual color state depends on rendered component in browser"
  - test: "Save as Draft database write"
    expected: "Clicking Save creates one posts row (status='draft') and one post_platforms row per selected platform with platform-specific content in the content column"
    why_human: "Requires database inspection after a live save action to confirm postPlatforms.content is populated correctly"
---

# Phase 2A: Brand Profiles + AI Text Generation Verification Report

**Phase Goal:** Core value proposition — generate brand-aware, platform-optimized content using Claude API with title/hook optimization.
**Verified:** 2026-03-17
**Status:** HUMAN NEEDED (all automated checks passed)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can paste URL/text and AI generates platform-specific posts using brand voice | VERIFIED | `generate-section.tsx:154-173` — URL Input + Textarea bound to state; `generate.ts:53-87` — `buildSystemPrompt` injects all brand fields (name, niche, voiceTone, targetAudience, goals, topics, dosList, dontsList, examplePosts, bannedHashtags, platformNotes) |
| 2 | Title optimization generates 5-10 hook variants, scores them, uses best | VERIFIED | `generate.ts:126-157` — `buildHookScoringPrompt` requests exactly 5 variants; `generate.ts:291-293` — variants sorted by score, `sorted[0].text` becomes `winningHook` |
| 3 | Generated content can be previewed per-platform with accurate formatting | VERIFIED | `generate-section.tsx:251-348` — Tabs component renders one tab per platform; character count displayed as `{charCount} / {limit} characters` with color coding |
| 4 | User can edit generated content before publishing | VERIFIED | `generate-section.tsx:328-334` — editable `Textarea` per platform tab, bound to `editedContent` state via `updateEditedContent()` |

**Score: 4/4 truths verified**

### Plan-Level Must-Have Truths (Plan 01)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | generateContent server action calls Claude API with brand context and returns per-platform content | VERIFIED | `generate.ts:188-312` — full implementation: brand query → spend check → sanitize → build prompts → circuit-breaker-wrapped `anthropic.messages.create` → parse JSON → return `GenerationResult` |
| 2 | Hook optimization generates 5 variants per platform, scores them, selects the best | VERIFIED | `generate.ts:249-300` — second `anthropic.messages.create` call for hook scoring; variants sorted by score, `sorted[0]` is winner |
| 3 | AI model selection uses getModelConfig() which reads AI_MODE env var | VERIFIED | `ai.ts:5,19` — `AI_MODE = process.env.AI_MODE ?? 'testing'`; `getModelConfig()` returns different models per mode; `generate.ts:217` — `const modelConfig = getModelConfig()` |
| 4 | postPlatforms table has a content column for storing platform-specific generated text | VERIFIED | `schema.ts:88` — `content: text()` (nullable); `0001_stiff_pixie.sql` — `ALTER TABLE 'post_platforms' ADD 'content' text` |

### Plan-Level Must-Have Truths (Plan 02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can enter a URL or paste/type text as source material | VERIFIED | `generate-section.tsx:154-173` — URL Input (type="url") + Textarea, both bound to state |
| 2 | User can select which connected platform accounts to generate content for | VERIFIED | `generate-section.tsx:194-217` — checkboxes rendered per `accounts` prop, `togglePlatform()` updates `selectedPlatforms` |
| 3 | User can see generated content per-platform in a tabbed preview with character counts | VERIFIED | `generate-section.tsx:251-348` — Tabs with TabsTrigger per platform, character count span with color-coded CSS class |
| 4 | User can edit the generated content in textareas before saving | VERIFIED | `generate-section.tsx:328-334` — Textarea with `onChange` calling `updateEditedContent()` |
| 5 | User can expand and see all hook variants with scores for each platform | VERIFIED | `generate-section.tsx:270-325` — toggle button shows/hides hook variants list sorted by score; `Badge` shows `{variant.score}/10` |
| 6 | User can save all generated content as drafts | VERIFIED | `generate-section.tsx:124-132` — `handleSave()` calls `saveGeneratedPosts()`; `generate.ts:315-358` — inserts `posts` row + one `postPlatforms` row per platform, calls `redirect()` |
| 7 | User can navigate to the generation page from the brand detail page | VERIFIED | `brands/[id]/page.tsx:57-60` — `Button` with `render={<Link href={'/brands/${brand.id}/generate'} />}` labelled "Generate Content" with Sparkles icon |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/actions/generate.ts` | generateContent, saveGeneratedPosts, prompt builders, hook scoring, cost tracking | VERIFIED | 359 lines; exports `generateContent`, `saveGeneratedPosts`, `GenerationResult`; contains `buildSystemPrompt`, `buildGenerationPrompt`, `buildHookScoringPrompt`, `parseJsonResponse`, `PLATFORM_CONSTRAINTS` |
| `src/db/schema.ts` | Updated postPlatforms table with content column | VERIFIED | Line 88: `content: text()` with comment confirming nullable platform-specific AI content |
| `src/db/migrations/0001_stiff_pixie.sql` | Migration adding content column to post_platforms | VERIFIED | `ALTER TABLE 'post_platforms' ADD 'content' text` |
| `src/app/(dashboard)/brands/[id]/generate/page.tsx` | Generation page with source input, platform selection, AI generation, preview, editing, save | VERIFIED | Server component fetches brand + connected accounts; renders `GenerateSection` |
| `src/app/(dashboard)/brands/[id]/generate/generate-section.tsx` | Client component with full interactive flow | VERIFIED | 374 lines (min 150 required); full 'use client' component with all required functionality |
| `src/app/(dashboard)/brands/[id]/page.tsx` | Brand detail page with Generate button | VERIFIED | Line 57-60: Button linking to `/brands/${brand.id}/generate` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `generate-section.tsx` | `generate.ts` | `import { generateContent, saveGeneratedPosts }` | WIRED | Lines 11-15: import present; lines 102 and 126: both functions called in handlers |
| `generate-section.tsx` | `src/db/schema.ts` | `socialAccounts` for platform checkboxes | WIRED | `page.tsx` queries `socialAccounts` and passes as `accounts` prop; component renders checkboxes per account |
| `brands/[id]/page.tsx` | `generate/page.tsx` | `Link href="/brands/[id]/generate"` | WIRED | Line 57: `render={<Link href={'`/brands/${brand.id}/generate`'} />}` |
| `generate.ts` | `src/lib/ai.ts` | `getModelConfig, checkAiSpend, logAiSpend` | WIRED | Line 7: import; lines 206, 217, 239, 271: all three called in `generateContent` |
| `generate.ts` | `src/lib/circuit-breaker.ts` | `getBreaker('anthropic').call()` | WIRED | Line 8: import; lines 220 and 251: both Claude API calls wrapped in `getBreaker('anthropic').call()` |
| `generate.ts` | `src/db/schema.ts` | `db.insert(posts)` and `db.insert(postPlatforms)` | WIRED | Lines 333 and 344: both insert calls present in `saveGeneratedPosts` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GEN-01 | 2A-02 | User can paste a URL or type text as content source (PDF upload deferred to Phase 3) | SATISFIED (partial) | URL input field + textarea in `generate-section.tsx:154-173`; PDF upload is Phase 3 scope |
| GEN-03 | 2A-01 | AI generates platform-optimized text content using brand voice and context | SATISFIED | `buildSystemPrompt` injects full brand context; `buildGenerationPrompt` applies per-platform constraints |
| GEN-04 | 2A-01 | AI generates 5 hook variants, self-scores them, uses best | SATISFIED | Prompt requests exactly 5 variants; scoring via second Claude call; winner auto-selected by highest score |
| GEN-05 | 2A-02 | User can select target platforms via checkboxes | SATISFIED | Platform checkboxes in `generate-section.tsx:194-217` |
| GEN-06 | 2A-02 | User can preview generated content per platform | SATISFIED | Tabbed preview in `generate-section.tsx:251-348` |
| GEN-07 | 2A-02 | User can edit generated content before publishing | SATISFIED | Editable textarea per tab |
| GEN-08 | 2A-01 | AI model selection configurable via AI_MODE env var | SATISFIED | `getModelConfig()` reads `process.env.AI_MODE`; `generate.ts:217` calls it |
| GEN-02 | (none) | System extracts text from YouTube/articles/PDFs | NOT IN SCOPE | Correctly excluded — Phase 2A ROADMAP entry lists GEN-01,GEN-03–GEN-08 only; GEN-02 mapped to Phase 3 |

**Note on GEN-01 scope:** REQUIREMENTS.md lists GEN-01 as covering URL, PDF, and typed text. Phase 2A covers URL field + typed text only. PDF upload is deferred to Phase 3 (with GEN-02 content extraction). The ROADMAP Phase 2A success criteria explicitly says "paste URL/text" — no PDF. This is correct scoping, not a gap.

**Note on REQUIREMENTS.md Phase mapping typo:** Line 179 of REQUIREMENTS.md reads `GEN-01 through GEN-08, GEN-03 through GEN-04` — the duplication `GEN-03 through GEN-04` appears to be a data entry artifact in the requirements table. The ROADMAP itself at line 79 states the authoritative list: `GEN-01, GEN-03, GEN-04, GEN-05, GEN-06, GEN-07, GEN-08`.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `generate-section.tsx` | 157, 168 | `placeholder=` attribute on inputs | Info | These are HTML input placeholder attributes, not stub patterns — false positive |

No blockers or warnings found. No TODO/FIXME/XXX comments in any phase 2A file. No empty return implementations. No stub handlers.

---

## Human Verification Required

### 1. End-to-End Generation with Live Claude API

**Test:** With `ANTHROPIC_API_KEY` set, navigate to a brand with connected accounts. Enter source text, check at least two platform accounts, click "Generate Content". Wait for results.
**Expected:** Loading skeleton appears during generation, then tabbed results appear with actual AI-generated content per platform, each with a character count and a "View hook variants" toggle.
**Why human:** Requires a live API key, real network call, and browser to confirm the two-pass Claude flow returns well-formed JSON that the UI can parse and display.

### 2. URL-as-Context Generation

**Test:** Paste a URL (e.g. a news article) into the URL field, leave the text area blank. Click "Generate Content".
**Expected:** Claude generates content that is contextually related to the URL topic, not just generic brand content.
**Why human:** The URL is passed as a text hint in the prompt (`SOURCE URL: https://... (Use this URL as context)`), not fetched. Quality of context-from-URL is a judgment call that only a human can evaluate.

### 3. Hook Variant Display and Winner Selection

**Test:** After generation succeeds, click "View hook variants" on a platform tab.
**Expected:** 5 variants appear sorted by score (highest first). The highest-scoring variant has a "Winner" badge and a highlighted background. The same text should be identifiable as the leading line of the generated content.
**Why human:** Visual badge/highlight rendering and correspondence between winner text and generated content requires browser inspection.

### 4. Character Count Color Coding

**Test:** Edit a platform's content in the textarea, typing to approach and then exceed the character limit.
**Expected:** Count stays muted until 90% of limit (yellow at 90-99%, red at 100%+).
**Why human:** CSS color state is a visual runtime behavior.

### 5. Save as Draft — Database Verification

**Test:** Complete a generation and click "Save as Draft". After redirect to brand page, inspect the database (e.g., via `turso db shell`): `SELECT * FROM posts ORDER BY id DESC LIMIT 1;` and `SELECT * FROM post_platforms WHERE post_id = <id>;`.
**Expected:** One `posts` row with `status='draft'` and populated `source_text` or `source_url`. One `post_platforms` row per selected platform, each with its platform-specific `content` populated (not NULL).
**Why human:** Requires database access after a live save action to confirm the content column in `postPlatforms` is populated.

---

## Summary

All automated checks pass for Phase 2A. The implementation is substantive throughout:

- `generate.ts` (359 lines) is a fully implemented two-pass Claude API flow — brand-aware prompt construction, circuit-breaker wrapping, cost logging, JSON parsing with defensive markdown stripping, hook scoring and selection.
- `generate-section.tsx` (374 lines) is a complete interactive client component — not a placeholder.
- The brand detail page correctly exposes the "Generate Content" navigation link.
- The database schema and migration correctly add the `postPlatforms.content` column.
- All 7 claimed requirements (GEN-01, GEN-03 through GEN-08) have clear implementation evidence.
- GEN-02 (content extraction) is correctly excluded from this phase and deferred to Phase 3.

The phase goal — "generate brand-aware, platform-optimized content using Claude API with title/hook optimization" — is architecturally achieved. Human verification is required to confirm live API behavior and UI rendering correctness.

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier)_
