---
phase: 03
slug: content-extraction-images
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (if installed) or `npx tsc --noEmit` |
| **Config file** | none — Wave 0 installs if needed |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | GEN-01 | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | GEN-02 | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | IMG-01 | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | IMG-02, IMG-03 | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 2 | IMG-04, IMG-05 | type-check | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| YouTube transcript extraction | GEN-01 | Requires live YouTube API | Paste YouTube URL, verify transcript appears |
| Article extraction via Readability | GEN-01 | Requires live HTTP fetch | Paste article URL, verify clean text extracted |
| Image generation with brand style | IMG-01 | Requires OpenAI API key | Generate image, verify brand style directive applied |
| Logo watermark on generated images | IMG-02 | Visual verification needed | Generate image with watermark, verify placement |
| R2 storage and thumbnail access | IMG-03 | Requires R2 bucket access | Generate image, verify viewable in media library |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
