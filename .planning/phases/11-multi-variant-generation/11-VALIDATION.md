---
phase: 11
slug: multi-variant-generation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 11 — Validation Strategy

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
| 11-01-01 | 01 | 1 | MVAR-01, MVAR-04 | compile + manual | `npx tsc --noEmit` | N/A | ⬜ pending |
| 11-01-02 | 01 | 1 | MVAR-01, MVAR-04 | compile + manual | `npx tsc --noEmit` | N/A | ⬜ pending |
| 11-02-01 | 02 | 2 | MVAR-02 | compile + build | `npm run build` | N/A | ⬜ pending |
| 11-02-02 | 02 | 2 | MVAR-03 | compile + build | `npm run build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 3 variants generated at different temperatures | MVAR-01 | Requires AI API calls | Enable variants on brand, trigger auto-generate, verify 3 posts with variant group |
| Winner selection by quality score | MVAR-01 | Requires critique scoring | Check winning variant has highest quality score, losers have variantOf set |
| Spend limit fallback to single-variant | MVAR-04 | Requires hitting spend limit | Set low MAX_DAILY_AI_SPEND, generate, verify single-variant fallback |
| Brand settings toggle with cost estimate | MVAR-02 | UI interaction | Toggle enableVariants, verify cost estimate shows before confirming |
| Post detail shows winner + runner-ups | MVAR-03 | Requires generated variants | Navigate to post detail after multi-variant generation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
