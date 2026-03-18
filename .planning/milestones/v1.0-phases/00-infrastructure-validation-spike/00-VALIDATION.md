---
phase: 0
slug: infrastructure-validation-spike
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 0 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (standalone scripts — per CONTEXT.md decision) |
| **Config file** | none — scripts run directly with `tsx` |
| **Quick run command** | `npx tsx scripts/validate/{NN}-{name}.ts` |
| **Full suite command** | `for f in scripts/validate/*.ts; do npx tsx "$f" \|\| exit 1; done` |
| **Estimated runtime** | ~15 seconds (local), ~3 min (Railway deploy) |

---

## Sampling Rate

- **After every task commit:** Run the specific validation script for that task
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** All 5 scripts exit 0 + Railway deploy shows no build errors
- **Max feedback latency:** 15 seconds (local scripts)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 00-01-01 | 01 | 1 | INFRA-01 | smoke | `npx tsx scripts/validate/01-sqlite-wal.ts` | ❌ W0 | ⬜ pending |
| 00-01-02 | 01 | 1 | INFRA-02 | smoke | `npx tsx scripts/validate/02-better-sqlite3.ts` | ❌ W0 | ⬜ pending |
| 00-01-03 | 01 | 1 | INFRA-03 | smoke | `npx tsx scripts/validate/03-cron-singleton.ts` | ❌ W0 | ⬜ pending |
| 00-01-04 | 01 | 1 | INFRA-04 | smoke | `npx tsx scripts/validate/04-satori-sharp.ts` | ❌ W0 | ⬜ pending |
| 00-01-05 | 01 | 1 | INFRA-05 | smoke | `npx tsx scripts/validate/05-upload-post.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/validate/01-sqlite-wal.ts` — stubs for INFRA-01
- [ ] `scripts/validate/02-better-sqlite3.ts` — stubs for INFRA-02
- [ ] `scripts/validate/03-cron-singleton.ts` — stubs for INFRA-03
- [ ] `scripts/validate/04-satori-sharp.ts` — stubs for INFRA-04
- [ ] `scripts/validate/05-upload-post.ts` — stubs for INFRA-05
- [ ] `public/fonts/Inter-Regular.ttf` — required by Satori validation
- [ ] `.env.local` with `UPLOAD_POST_API_KEY` (manual, gitignored)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway deploy succeeds | INFRA-02 | Requires Railway environment | Push to Railway, check build logs for errors |
| Cron tick in Railway logs | INFRA-03 | Requires deployed app running for 1+ min | Check Railway runtime logs for `[cron] tick` messages |
| Railway volume persists across redeploy | INFRA-01 | Requires two sequential deploys | Deploy, write data, redeploy, verify data persists |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
