---
phase: 09
slug: learning-engine-golden-examples
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + TypeScript compilation |
| **Config file** | tsconfig.json |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full build + manual cron verification
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-* | 01 | 1 | LEARN-01,02,05,06 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 09-02-* | 02 | 1 | LEARN-03,07,GOLD-01,02 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 09-03-* | 03 | 2 | LEARN-04,GOLD-03 | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No new test framework needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Weekly cron fires and produces learnings | LEARN-01 | Cron timing | Trigger analyzeForBrand() manually, verify brandLearnings rows created |
| Learnings inject into generation prompt | LEARN-03 | AI output varies | Generate content with approved learnings, verify prompt includes learning text |
| Golden examples appear in generation prompt | GOLD-02 | AI output varies | Generate content with pinned examples, verify prompt includes example posts |
| Learnings dashboard shows correct data | LEARN-04 | UI verification | Load learnings page, verify types/confidence/counts display |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
