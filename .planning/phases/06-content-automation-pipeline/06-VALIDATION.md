---
phase: 6
slug: content-automation-pipeline
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-18
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | tsx validation scripts (established project pattern) |
| **Config file** | none — scripts run standalone |
| **Quick run command** | `npx tsx scripts/validate-spam-guard.ts` |
| **Full suite command** | `npx next build` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx next build`
- **After every plan wave:** Run validation scripts + manual smoke test
- **Before `/gsd:verify-work`:** Full build + all validation scripts green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | FEED-01 | manual | Human: add feed via UI, verify poll | N/A | ⬜ pending |
| 06-01-02 | 01 | 1 | FEED-03 | manual | Human: verify dedup in DB | N/A | ⬜ pending |
| 06-01-03 | 01 | 1 | FEED-04 | manual | Human: check relevance scores in DB | N/A | ⬜ pending |
| 06-01-04 | 01 | 1 | FEED-10 | manual | Human: verify feed disables after failures | N/A | ⬜ pending |
| 06-02-01 | 02 | 2 | FEED-08,FEED-09 | manual | Human: trigger auto-generate, check results | N/A | ⬜ pending |
| 06-02-02 | 02 | 2 | SPAM-01,SPAM-02 | manual | Human: verify rate limits enforced | N/A | ⬜ pending |
| 06-02-03 | 02 | 2 | SPAM-04 | manual | Human: verify warmup caps | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — project uses human verification plans as quality gate.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| RSS feed polling | FEED-01 | External HTTP fetch | Add feed URL, wait for cron, check entries |
| Haiku relevance scoring | FEED-04 | Requires live API | Check relevanceScore in feedEntries |
| Auto-generate pipeline | FEED-08 | Full pipeline integration | Trigger cron, verify posts created |
| Automation levels | FEED-09 | Business logic + DB state | Set automation level, verify draft vs scheduled |
| Feed auto-disable | FEED-10 | Failure simulation | Use invalid feed URL, wait for 10 failures |
| Rate limiting | SPAM-01,02 | Timing-dependent | Schedule many posts, verify caps enforced |
| Warmup caps | SPAM-04 | Time-window dependent | New brand, verify 1/day week 1 limit |

---

## Validation Sign-Off

- [x] All tasks have manual verify instructions
- [x] Sampling continuity: human verification plan covers all
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
