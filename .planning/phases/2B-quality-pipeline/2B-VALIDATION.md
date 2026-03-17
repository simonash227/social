---
phase: 2B
slug: quality-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 2B — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual verification via dev server |
| **Config file** | N/A |
| **Quick run command** | `npm run dev` + manual generation test |
| **Full suite command** | Manual end-to-end: generate → observe refinement → check DB |
| **Estimated runtime** | ~90 seconds manual |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit` + `npm run dev` smoke test
- **After every plan wave:** Manual end-to-end (generate → refine → gate → save → check DB)
- **Before `/gsd:verify-work`:** Full manual flow must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2B-01-01 | 01 | 1 | QUAL-01 | manual | `npm run dev` + generate, check activityLog | N/A | ⬜ pending |
| 2B-01-02 | 01 | 1 | QUAL-02 | manual | Check activityLog for quality_skip entry | N/A | ⬜ pending |
| 2B-01-03 | 01 | 1 | QUAL-03 | manual | Inspect posts table quality columns | N/A | ⬜ pending |
| 2B-01-04 | 01 | 1 | QUAL-04 | manual | Test with weak content, verify discard | N/A | ⬜ pending |
| 2B-01-05 | 01 | 1 | QUAL-05 | manual | Query SQLite for quality_score + quality_details | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `qualityDetails` text column — add via drizzle migration on `posts` table

*No automated test framework to install — project uses manual verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Self-refine loop fires | QUAL-01 | Requires live Claude API | Generate content, check activityLog for critique + rewrite entries |
| High-score skip | QUAL-02 | Requires specific AI output | Generate high-quality content, verify skip logged |
| Quality gate scoring | QUAL-03 | Requires live Claude API | Check posts table for qualityScore and qualityDetails |
| Discard routing | QUAL-04 | Requires low-quality input | Test with weak source, verify error returned |
| Score persistence | QUAL-05 | DB verification | Query posts table after save |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: tsc check after each task
- [ ] Wave 0 covers migration
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
