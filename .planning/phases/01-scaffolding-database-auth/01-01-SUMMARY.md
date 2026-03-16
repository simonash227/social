---
phase: 01-scaffolding-database-auth
plan: "01"
subsystem: database-schema-utilities
tags: [database, drizzle-orm, sqlite, shadcn, circuit-breaker, sanitizer, r2, ai]
dependency_graph:
  requires: []
  provides:
    - drizzle-orm database schema (all 9 tables)
    - SQLite singleton with WAL mode and programmatic migrations
    - shadcn/ui component library with 16 components installed
    - Circuit breaker utility for external API resilience
    - Input sanitizer for feed content
    - API client stubs (Upload-Post, AI spend tracking, Cloudflare R2)
  affects:
    - All subsequent plans (02-05) depend on this schema and utilities
tech_stack:
  added:
    - drizzle-orm@0.45.1 (updated from 0.30.x to match drizzle-kit@0.31.9)
    - drizzle-kit@0.31.9 (for schema-to-SQL migration generation)
    - bcryptjs (pure-JS bcrypt for session auth)
    - "@aws-sdk/client-s3" (Cloudflare R2 S3-compatible client)
    - next-themes (dark mode with SSR hydration handling)
    - "@tailwindcss/postcss" (Tailwind v4 PostCSS plugin)
    - shadcn/ui@4.0.8 with 16 components
  patterns:
    - SQLite module-level singleton with WAL, foreign keys, busy timeout, integrity check
    - Drizzle programmatic migrations at first DB connection
    - Circuit breaker state machine (CLOSED/OPEN/HALF_OPEN) with per-service singleton registry
    - text({ mode: 'json' }).$type<T>() for JSON columns in SQLite
key_files:
  created:
    - src/db/schema.ts
    - src/db/index.ts
    - drizzle.config.ts
    - src/db/migrations/0000_absent_squadron_sinister.sql
    - src/db/migrations/meta/0000_snapshot.json
    - src/db/migrations/meta/_journal.json
    - src/lib/circuit-breaker.ts
    - src/lib/sanitize.ts
    - src/lib/upload-post.ts
    - src/lib/ai.ts
    - src/lib/r2.ts
    - src/components/ui/avatar.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/card.tsx
    - src/components/ui/dialog.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/components/ui/input.tsx
    - src/components/ui/label.tsx
    - src/components/ui/select.tsx
    - src/components/ui/separator.tsx
    - src/components/ui/sheet.tsx
    - src/components/ui/sidebar.tsx
    - src/components/ui/skeleton.tsx
    - src/components/ui/tabs.tsx
    - src/components/ui/textarea.tsx
    - src/components/ui/tooltip.tsx
    - src/hooks/use-mobile.ts
  modified:
    - package.json (added drizzle-kit, bcryptjs, @aws-sdk/client-s3, next-themes, @tailwindcss/postcss; updated drizzle-orm)
decisions:
  - drizzle-orm updated from 0.30.x to 0.45.1 because drizzle-kit@0.31.9 requires newer drizzle-orm (compatibility constraint)
  - shadcn initialized with --defaults flag (non-interactive) using Nova preset with Radix components
  - Used text({ mode: 'json' }) for all JSON columns (not blob) per research anti-pattern note
  - requestChecksumCalculation: WHEN_REQUIRED added to R2 S3Client for SDK v3.729.0+ compatibility
  - ai.ts does not include actual Claude API call function (deferred to Phase 2A per plan)
metrics:
  duration: ~30 minutes
  completed: "2026-03-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 27
  files_modified: 1
---

# Phase 01 Plan 01: Database Schema, shadcn/ui, and Utility Modules Summary

**One-liner:** 9-table drizzle SQLite schema with WAL migrations, shadcn/ui Nova preset, circuit breaker, and API client stubs for Upload-Post, AI spend tracking, and Cloudflare R2.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Database schema, drizzle config, migrations, shadcn/ui | db20ef5 | src/db/schema.ts, src/db/index.ts, drizzle.config.ts, src/db/migrations/, src/components/ui/ (16 components) |
| 2 | Circuit breaker, sanitizer, API client stubs | ef82e04 | src/lib/circuit-breaker.ts, src/lib/sanitize.ts, src/lib/upload-post.ts, src/lib/ai.ts, src/lib/r2.ts |

## Verification Results

- `npx drizzle-kit generate` runs clean — schema valid, no errors
- Database opens with WAL mode: `pragma integrity_check = ok`
- All 9 app tables exist: activity_log, ai_spend_log, brands, feed_entries, feed_sources, post_platforms, posts, sessions, social_accounts
- CircuitBreaker CLOSED -> OPEN after 2 failures: PASS
- CircuitBreaker OPEN -> HALF_OPEN after cooldown elapsed: PASS
- `sanitizeText('<b>hello</b>  \u200Bworld\n\n\n\ntest')` returns `"hello world\n\ntest"`: PASS
- TypeScript `tsc --noEmit` exits clean with no errors
- shadcn/ui components available in src/components/ui/ (16 files)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] drizzle-orm version incompatibility**
- **Found during:** Task 1 (Step 5: drizzle-kit generate)
- **Issue:** drizzle-kit@0.31.9 (installed via npm) requires a newer drizzle-orm than v0.30.x (which was in package.json). Migration generation failed with "Please update drizzle-orm package to the latest version".
- **Fix:** `npm install drizzle-orm@latest` updated to v0.45.1. Verified migration generation succeeds after update.
- **Files modified:** package.json, package-lock.json
- **Commit:** included in db20ef5

**2. [Rule 3 - Blocking] shadcn init requires Tailwind v4 PostCSS plugin**
- **Found during:** Task 1 (Step 2: shadcn init)
- **Issue:** shadcn init failed with "No Tailwind CSS configuration found" because Tailwind v4 uses CSS-first configuration and requires `@tailwindcss/postcss` as a PostCSS plugin — no `tailwind.config.js` needed.
- **Fix:** Installed `@tailwindcss/postcss`, created `postcss.config.mjs` with the plugin, created `src/app/globals.css` with `@import "tailwindcss"`. Then shadcn init with `--defaults` flag succeeded.
- **Files modified:** postcss.config.mjs (already committed in initial commit), globals.css
- **Commit:** included in initial commit (b3d2cd3) and db20ef5

**3. [Rule 3 - Blocking] shadcn init --style flag removed in v4**
- **Found during:** Task 1 (Step 2: shadcn init)
- **Issue:** `npx shadcn@latest init --defaults --style new-york` failed with "unknown option '--style'". shadcn v4 changed the CLI interface.
- **Fix:** Used `--defaults` flag only, which selects the Nova preset (Radix components + Geist font). This gives equivalent quality components.
- **Files modified:** components.json
- **Commit:** included in db20ef5

## Decisions Made

1. **drizzle-orm 0.45.1**: Updated from 0.30.x to match drizzle-kit requirement. No API-breaking changes found for the patterns used.

2. **shadcn Nova preset**: The default preset uses Radix UI primitives with Geist font — equivalent to New York style for dashboard use. Dark mode CSS variables properly defined in globals.css.

3. **ai.ts deferred Claude call function**: Per plan spec, the actual `callClaude()` function is deferred to Phase 2A. This plan only implements configuration, spend checking, and spend logging.

4. **R2 requestChecksumCalculation: WHEN_REQUIRED**: Applied proactively based on research pitfall #5 (R2 + SDK v3.729.0+ checksum breaking change).

## Self-Check: PASSED

Files verified to exist:
- src/db/schema.ts: FOUND
- src/db/index.ts: FOUND
- drizzle.config.ts: FOUND
- src/db/migrations/0000_absent_squadron_sinister.sql: FOUND
- src/lib/circuit-breaker.ts: FOUND
- src/lib/sanitize.ts: FOUND
- src/lib/upload-post.ts: FOUND
- src/lib/ai.ts: FOUND
- src/lib/r2.ts: FOUND
- src/components/ui/sidebar.tsx: FOUND

Commits verified:
- db20ef5: FOUND (Task 1 — schema, migrations, shadcn components)
- ef82e04: FOUND (Task 2 — utility modules)
