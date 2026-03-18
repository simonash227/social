---
phase: 2A-brand-profiles-ai-text-generation
plan: 01
subsystem: ai
tags: [anthropic-sdk, claude-api, server-actions, drizzle-migration, prompt-engineering]

# Dependency graph
requires:
  - phase: 01-scaffolding-database-auth
    provides: "brands table, posts/postPlatforms tables, ai.ts helpers, circuit-breaker, sanitize"
provides:
  - "generateContent server action with two-pass Claude API flow"
  - "saveGeneratedPosts server action for draft persistence"
  - "GenerationResult type for generation page UI"
  - "postPlatforms.content column via migration"
  - "@anthropic-ai/sdk dependency"
affects: [2A-02, 2B-quality-pipeline, 6-content-automation-pipeline]

# Tech tracking
tech-stack:
  added: ["@anthropic-ai/sdk"]
  patterns: ["prompt-based JSON extraction (not native structured outputs)", "two-pass AI flow (generation + hook scoring)", "circuit-breaker-wrapped Claude API calls", "server action return-value pattern (not redirect)"]

key-files:
  created:
    - "src/app/actions/generate.ts"
    - "src/db/migrations/0001_stiff_pixie.sql"
  modified:
    - "src/db/schema.ts"
    - "package.json"

key-decisions:
  - "Prompt-based JSON extraction used instead of native structured outputs (claude-haiku-3 does not support output_config.format)"
  - "Module-level Anthropic client instantiation (one per process, reads ANTHROPIC_API_KEY from env)"
  - "saveGeneratedPosts uses redirect() after insert while generateContent returns data -- different action patterns"

patterns-established:
  - "Two-pass AI flow: generation call (primary model) + hook scoring call (critique model)"
  - "buildSystemPrompt includes all brand profile fields for brand-aware generation"
  - "PLATFORM_CONSTRAINTS constant defines character limits and hashtag guidance per platform"
  - "parseJsonResponse strips markdown fences defensively before JSON.parse"
  - "calculateCostUsd uses per-model pricing table for spend tracking"

requirements-completed: [GEN-03, GEN-04, GEN-08]

# Metrics
duration: 3min
completed: 2026-03-17
---

# Phase 2A Plan 01: AI Generation Server Action Summary

**Anthropic SDK installed, postPlatforms content column added via migration, and generateContent/saveGeneratedPosts server actions built with two-pass Claude API flow (generation + hook scoring), circuit breaker wrapping, and cost tracking**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T23:14:55Z
- **Completed:** 2026-03-16T23:17:53Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Installed @anthropic-ai/sdk for Claude API integration
- Added nullable content column to postPlatforms table with drizzle migration
- Built generateContent server action that queries brand, builds brand-aware prompts, calls Claude twice (generation + hook scoring), parses JSON responses, logs costs, and returns per-platform content with hook variants
- Built saveGeneratedPosts server action that creates posts + postPlatforms rows and redirects to brand detail page

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Anthropic SDK and add postPlatforms content column** - `632197d` (feat)
2. **Task 2: Build generation server action with prompt construction and hook optimization** - `beb4d54` (feat)

## Files Created/Modified
- `src/app/actions/generate.ts` - Main AI generation server action with generateContent, saveGeneratedPosts, prompt builders, hook scoring, cost calculation
- `src/db/schema.ts` - Added content column to postPlatforms table definition
- `src/db/migrations/0001_stiff_pixie.sql` - ALTER TABLE migration adding content column
- `src/db/migrations/meta/_journal.json` - Updated migration journal
- `src/db/migrations/meta/0001_snapshot.json` - Migration snapshot metadata
- `package.json` - Added @anthropic-ai/sdk dependency

## Decisions Made
- Used prompt-based JSON extraction instead of native structured outputs because claude-haiku-3-20250307 (critique model in testing mode) does not support output_config.format
- Instantiated Anthropic client at module level (reads ANTHROPIC_API_KEY from environment automatically) -- one client per process, not per request
- saveGeneratedPosts calls redirect() after DB insert (terminates request); generateContent returns data to client (different patterns for different use cases)
- Used drizzle-kit generate for migration (produced 0001_stiff_pixie.sql) rather than manual SQL file creation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

ANTHROPIC_API_KEY environment variable must be set in `.env.local` for local development and in Railway environment for production. The Anthropic SDK reads this automatically.

## Next Phase Readiness
- generateContent and saveGeneratedPosts are ready to be called from the generation page UI (Plan 02)
- GenerationResult type is exported for the client component to consume
- postPlatforms.content column will be available after migration runs on next DB connection

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 2A-brand-profiles-ai-text-generation*
*Completed: 2026-03-17*
