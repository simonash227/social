---
phase: 2A-brand-profiles-ai-text-generation
plan: 03
type: execute
wave: 3
depends_on:
  - 2A-02
files_modified: []
autonomous: false
requirements:
  - GEN-01
  - GEN-03
  - GEN-04
  - GEN-05
  - GEN-06
  - GEN-07
  - GEN-08

must_haves:
  truths:
    - "Full generation flow works end-to-end: input source, select platforms, generate, preview, edit, save"
    - "Hook variants are visible and highest-scoring hook is used"
    - "Saved drafts appear in the database with correct structure"
  artifacts: []
  key_links: []
---

<objective>
Verify the complete AI content generation flow works end-to-end with a human tester.

Purpose: The generation flow involves live Claude API calls, interactive UI state, and database writes. Automated verification cannot confirm the AI output quality, prompt effectiveness, UI usability, or data flow correctness. A human walk-through catches integration issues that TypeScript compilation cannot.

Output: Confirmed working generation flow or list of issues to address.
</objective>

<execution_context>
@C:/Users/simon/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/simon/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/2A-brand-profiles-ai-text-generation/2A-CONTEXT.md
@.planning/phases/2A-brand-profiles-ai-text-generation/2A-01-SUMMARY.md
@.planning/phases/2A-brand-profiles-ai-text-generation/2A-02-SUMMARY.md
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Verify complete AI content generation flow end-to-end</name>
  <files></files>
  <action>
Present the human verification checklist to the user. This is a blocking checkpoint -- execution pauses until the user confirms the flow works or reports issues.

What was built: Complete AI content generation flow -- source input (URL/text), platform selection, Claude-powered generation with hook optimization, tabbed preview with character counts, content editing, and draft saving.

How to verify:

**Prerequisites:**
- Ensure `ANTHROPIC_API_KEY` is set in `.env.local`
- Ensure at least one brand exists with connected social accounts (sync first if needed)
- Run `npm run dev`

**Test steps:**

1. **Navigate to generation page:** Go to a brand detail page (e.g., `/brands/1`). Verify "Generate Content" button is visible in the header. Click it -- should navigate to `/brands/1/generate`.

2. **Source input:** Verify URL input field and text textarea are both visible. Type some source text (a paragraph about a topic relevant to the brand). Verify the text binds to the textarea.

3. **Platform selection:** Verify checkboxes appear for each connected account (platform name + @username). Check at least 2 platforms. If no accounts shown, go back and sync accounts first.

4. **Generate content:** Click "Generate Content" button. Verify loading skeleton appears while AI generates. Wait for results (5-15 seconds depending on AI_MODE). Verify no errors appear.

5. **Preview results:** Verify tabs appear, one per selected platform. Click through each tab. Verify each tab shows generated content in a textarea. Verify character count is displayed (e.g., "142 / 280 characters"). Verify character count color is normal for content well within limit.

6. **Hook variants:** Look for "View hook variants" toggle on a platform tab. Click it -- verify 5 variants appear with scores (1-10). Verify one variant is highlighted as the winner (highest score).

7. **Edit content:** Edit the content in one of the textareas. Verify character count updates as you type. If you exceed the limit, verify the count turns red.

8. **Save as draft:** Click "Save as Draft". Verify redirect to brand detail page. Check the database: verify a `posts` row exists with status='draft' and the source material, and `post_platforms` rows exist with the per-platform content.

9. **Generate again:** Navigate back to `/brands/1/generate`. Enter source material and select platforms again. Click "Generate Content". Click "Generate Again" after results appear. Verify new content is generated (replacing previous results).

10. **AI_MODE verification:** Check the dev server console/logs for the model name used. If AI_MODE=testing (default), should see `claude-sonnet-4-20250514` for generation and `claude-haiku-3-20250307` for hooks. Verify `ai_spend_log` table has entries for the generation calls.

11. **Error cases (optional):** Try generating with no source text and no URL (button should be disabled). Try generating with no platforms selected (button should be disabled).
  </action>
  <verify>User confirms "approved" or provides issue list</verify>
  <done>Human has verified the complete AI content generation flow works end-to-end, including source input, platform selection, AI generation, hook variants, content editing, character counts, and draft saving.</done>
</task>

</tasks>

<verification>
Human verification of end-to-end flow. No automated verification for this plan.
</verification>

<success_criteria>
- Human confirms: source input works (URL and text)
- Human confirms: platform selection checkboxes populate from connected accounts
- Human confirms: AI generation produces per-platform content
- Human confirms: hook variants are visible with scores
- Human confirms: content is editable and character counts are accurate
- Human confirms: save creates proper database rows
- Human confirms: AI_MODE uses correct models
</success_criteria>

<output>
After completion, create `.planning/phases/2A-brand-profiles-ai-text-generation/2A-03-SUMMARY.md`
</output>
