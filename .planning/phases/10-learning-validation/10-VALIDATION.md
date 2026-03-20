---
phase: 10
slug: learning-validation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + TypeScript compiler |
| **Config file** | tsconfig.json |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | VALID-01 | compile + manual | `npx tsc --noEmit` | N/A | ⬜ pending |
| 10-01-02 | 01 | 1 | VALID-02, VALID-03, VALID-04 | compile + manual | `npx tsc --noEmit` | N/A | ⬜ pending |
| 10-02-01 | 02 | 2 | VALID-02, VALID-04 | compile + build | `npm run build` | N/A | ⬜ pending |
| 10-02-02 | 02 | 2 | VALID-01 | compile + build | `npm run build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Active learning IDs stored on post generation | VALID-01 | Requires content generation flow | Generate content for a brand with approved learnings, verify postActiveLearningIds populated |
| A/B comparison shows correct averages | VALID-02 | Requires posts with and without learnings | Check dashboard shows engagement averages for posts with vs without each learning |
| Auto-deactivation after N posts | VALID-03 | Requires accumulated post data | Wait for cron or manually trigger, verify ineffective learnings deactivated |
| Confidence indicator reflects A/B data | VALID-04 | Requires engagement data | Verify confidence badges update based on post count and delta magnitude |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
