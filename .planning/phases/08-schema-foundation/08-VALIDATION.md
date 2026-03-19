---
phase: 08
slug: schema-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (schema-only phase) |
| **Config file** | drizzle.config.ts |
| **Quick run command** | `npx drizzle-kit generate --dry-run` |
| **Full suite command** | `npx tsx src/db/index.ts` (triggers migrate) |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx drizzle-kit generate --dry-run`
- **After every plan wave:** Run `npx tsx src/db/index.ts`
- **Before `/gsd:verify-work`:** Full migration + pipeline cycle test
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | (infra) | schema | `npx drizzle-kit generate --dry-run` | ✅ | ⬜ pending |
| 08-01-02 | 01 | 1 | (infra) | migration | `npx tsx src/db/index.ts` | ✅ | ⬜ pending |
| 08-01-03 | 01 | 1 | (infra) | regression | manual pipeline check | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. drizzle-kit and better-sqlite3 are already installed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing pipeline runs without errors after migration | SC-3 | Requires cron cycle | Start dev server, trigger health endpoint, verify cron logs show no errors |
| Drizzle studio shows new tables | SC-4 | Visual check | Run `npx drizzle-kit studio`, verify all new tables visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
