---
phase: 5
slug: calendar-scheduling
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-18
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — project uses human verification plans |
| **Config file** | none |
| **Quick run command** | `npx next build` |
| **Full suite command** | `npx next build && npx next start` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx next build`
- **After every plan wave:** Run `npx next build && npx next start`
- **Before `/gsd:verify-work`:** Full build must succeed, human verification plan
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | SCHED-04 | manual | Human: configure slots, verify DB save | N/A | ⬜ pending |
| 05-01-02 | 01 | 1 | SCHED-05 | manual | Human: schedule post, inspect jitter offset | N/A | ⬜ pending |
| 05-01-03 | 01 | 1 | SCHED-06 | manual | Human: set scheduled_at to past, check activity log | N/A | ⬜ pending |
| 05-01-04 | 01 | 1 | SCHED-07 | manual | Human: use invalid account, verify failureCount | N/A | ⬜ pending |
| 05-02-01 | 02 | 1 | SCHED-01 | manual | Human: visit /calendar, check week/month views | N/A | ⬜ pending |
| 05-02-02 | 02 | 1 | SCHED-02 | manual | Human: drag event, verify DB update | N/A | ⬜ pending |
| 05-02-03 | 02 | 1 | SCHED-03 | manual | Human: visual inspection of platform colors | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — project uses human verification plans as quality gate.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Calendar renders week/month views | SCHED-01 | Visual UI component | Visit /calendar, toggle views |
| Drag-and-drop rescheduling | SCHED-02 | Browser interaction | Drag event, verify scheduled_at updates |
| Platform color coding | SCHED-03 | Visual styling | Inspect color badges on calendar events |
| Slot configuration saves | SCHED-04 | UI + DB | Configure slots, verify in DB |
| Jitter applied to schedule | SCHED-05 | Timing offset | Schedule post, check ±15 min offset |
| Publish cron fires | SCHED-06 | Cron + external API | Set past scheduled_at, check activity log |
| Retry logic with failure | SCHED-07 | Error handling flow | Use invalid account, verify 3 retries then failed |

---

## Validation Sign-Off

- [x] All tasks have manual verify instructions
- [x] Sampling continuity: human verification plan covers all
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
