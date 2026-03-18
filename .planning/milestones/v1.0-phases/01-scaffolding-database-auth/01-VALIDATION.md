---
phase: 1
slug: scaffolding-database-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (standalone scripts via `tsx`, per Phase 0 pattern) |
| **Config file** | none — scripts run directly |
| **Quick run command** | `npx tsx scripts/validate/{script}.ts` |
| **Full suite command** | `for f in scripts/validate/*.ts; do npx tsx "$f" \|\| exit 1; done` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run the specific validation script for that task
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green + browser smoke tests pass
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | INFRA-07 | unit | `npx tsx scripts/validate/07-circuit-breaker.ts` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | INFRA-08 | unit | `npx tsx scripts/validate/08-ai-spend.ts` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | INFRA-09 | unit | `npx tsx scripts/validate/09-sanitize.ts` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | INFRA-06 | integration | `npx tsx scripts/validate/06-r2-backup.ts` | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | AUTH-01 | smoke | manual (curl POST /api/auth/login) | N/A | ⬜ pending |
| 01-02-02 | 02 | 1 | AUTH-02 | smoke | manual (curl -I /brands → 307) | N/A | ⬜ pending |
| 01-02-03 | 02 | 1 | AUTH-03 | smoke | manual (browser refresh) | N/A | ⬜ pending |
| 01-03-01 | 03 | 2 | BRAND-01..06 | smoke | manual (browser CRUD) | N/A | ⬜ pending |
| 01-03-02 | 03 | 2 | ACCT-01..03 | mixed | `npx tsx scripts/validate/10-upload-post-accounts.ts` | ❌ W0 | ⬜ pending |
| 01-04-01 | 04 | 2 | DASH-04 | smoke | manual (browser render) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/validate/06-r2-backup.ts` — stubs for INFRA-06
- [ ] `scripts/validate/07-circuit-breaker.ts` — stubs for INFRA-07
- [ ] `scripts/validate/08-ai-spend.ts` — stubs for INFRA-08
- [ ] `scripts/validate/09-sanitize.ts` — stubs for INFRA-09
- [ ] `scripts/validate/10-upload-post-accounts.ts` — stubs for ACCT-02
- [ ] `scripts/validate/11-account-disconnect.ts` — stubs for ACCT-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login form accepts password, sets cookie | AUTH-01 | Browser interaction | 1. Visit /login 2. Enter password 3. Check cookie set |
| Unauthenticated redirect to /login | AUTH-02 | Middleware behavior | 1. Clear cookies 2. Visit /brands 3. Verify redirect |
| Session persists across refresh | AUTH-03 | Browser state | 1. Login 2. Refresh 3. Still authenticated |
| Brand CRUD (create/edit/delete) | BRAND-01..06 | Form interactions | 1. Create brand 2. Edit fields 3. Delete with confirmation |
| Dashboard shell renders | DASH-04 | Visual layout | 1. Login 2. Check sidebar, brand switcher, AI_MODE badge |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
