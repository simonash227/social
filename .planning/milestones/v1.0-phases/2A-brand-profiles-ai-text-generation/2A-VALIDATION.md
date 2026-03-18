---
phase: 2A
slug: brand-profiles-ai-text-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 2A — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no automated test framework in project |
| **Config file** | N/A |
| **Quick run command** | `npm run dev` + manual smoke test |
| **Full suite command** | Manual end-to-end: generate content → preview → edit → save draft → verify DB |
| **Estimated runtime** | ~60 seconds manual |

---

## Sampling Rate

- **After every task commit:** `npm run dev`, navigate to `/brands/[id]/generate`, verify UI renders
- **After every plan wave:** Manual end-to-end flow (generate → preview → edit → save → check DB)
- **Before `/gsd:verify-work`:** Full manual flow must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2A-01-01 | 01 | 1 | GEN-01 | manual | `npm run dev` + check inputs render | N/A | ⬜ pending |
| 2A-01-02 | 01 | 1 | GEN-03 | manual | `npm run dev` + generate content | N/A | ⬜ pending |
| 2A-01-03 | 01 | 1 | GEN-04 | manual | `npm run dev` + check hook variants | N/A | ⬜ pending |
| 2A-01-04 | 01 | 1 | GEN-05 | manual | `npm run dev` + check platform checkboxes | N/A | ⬜ pending |
| 2A-01-05 | 01 | 1 | GEN-06 | manual | `npm run dev` + check tab preview | N/A | ⬜ pending |
| 2A-01-06 | 01 | 1 | GEN-07 | manual | `npm run dev` + edit content | N/A | ⬜ pending |
| 2A-01-07 | 01 | 1 | GEN-08 | manual | Check `getModelConfig()` returns correct models | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `@anthropic-ai/sdk` — install Anthropic SDK (`npm install @anthropic-ai/sdk`)
- [ ] `post_platforms.content` column — add via drizzle migration
- [ ] Verify `ANTHROPIC_API_KEY` is configured in `.env.local`

*No automated test framework to install — project uses manual verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| URL/text source input | GEN-01 | UI interaction | Enter URL and text, verify both bind to form state |
| AI generates platform posts | GEN-03 | Requires live Claude API | Paste text, select platforms, click Generate, verify output |
| Hook variant scoring | GEN-04 | Requires live Claude API | Check 5+ variants appear with scores, best auto-selected |
| Platform checkboxes | GEN-05 | UI interaction | Verify connected accounts appear as checkboxes |
| Per-platform preview | GEN-06 | UI rendering | Switch tabs, verify content and character counts per platform |
| Content editing | GEN-07 | UI interaction | Edit textarea content, verify changes persist to save |
| AI_MODE switching | GEN-08 | Config validation | Check model names in console/logs match AI_MODE setting |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: manual smoke test after each task
- [ ] Wave 0 covers all MISSING references (SDK, migration, API key)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
