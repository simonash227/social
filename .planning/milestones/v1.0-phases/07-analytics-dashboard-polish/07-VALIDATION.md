---
phase: 7
slug: analytics-dashboard-polish
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-18
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — human verification |
| **Config file** | none |
| **Quick run command** | `npx next build` |
| **Full suite command** | `npx next build && npx next start` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx next build`
- **After every plan wave:** Build + manual smoke test
- **Before `/gsd:verify-work`:** Full build green, human verification
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | ANLY-01 | manual | Human: check analytics cron fetches metrics | N/A | ⬜ pending |
| 07-01-02 | 01 | 1 | ANLY-02 | manual | Human: verify engagement scores calculated | N/A | ⬜ pending |
| 07-01-03 | 01 | 1 | ANLY-03 | manual | Human: verify top/avg/under classification | N/A | ⬜ pending |
| 07-02-01 | 02 | 2 | DASH-01 | manual | Human: check cross-brand home page | N/A | ⬜ pending |
| 07-02-02 | 02 | 2 | DASH-02 | manual | Human: check brand home page | N/A | ⬜ pending |
| 07-02-03 | 02 | 2 | DASH-03 | manual | Human: check activity log page | N/A | ⬜ pending |
| 07-02-04 | 02 | 2 | DASH-05 | manual | Human: verify weekly digest on home | N/A | ⬜ pending |
| 07-02-05 | 02 | 2 | ANLY-04 | manual | Human: verify daily AI spend on home | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Analytics cron fetches metrics | ANLY-01 | External API call | Wait for cron, check DB for metrics |
| Engagement score calculation | ANLY-02 | Formula validation | Check scores in DB match formula |
| Post classification | ANLY-03 | Percentile logic | Verify top/avg/under labels |
| Cross-brand home | DASH-01 | Visual rendering | Visit /, check stats cards |
| Brand home | DASH-02 | Visual rendering | Visit brand detail, check metrics |
| Activity log | DASH-03 | Visual rendering | Visit /activity, check entries |
| Weekly digest | DASH-05 | Data aggregation | Check home page digest section |

---

## Validation Sign-Off

- [x] All tasks have manual verify instructions
- [x] Sampling continuity: human verification covers all
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
