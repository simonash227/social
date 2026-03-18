# Phase 0: Infrastructure Validation Spike - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate the 5 riskiest stack assumptions before building anything. Half-day spike to prevent discovering deal-breakers later. No production code — just proof that each piece works.

</domain>

<decisions>
## Implementation Decisions

### Validation environment
- Test locally first for fast iteration (SQLite, better-sqlite3, Satori+sharp)
- Deploy a minimal Railway test app to validate Railway-specific concerns (volume mount, WAL mode, instrumentation.ts)
- Upload-Post validation requires real API key against their sandbox/test endpoint
- Keep Railway test app alive briefly for validation, tear down after

### Fallback strategy
- SQLite fails on Railway → switch to Turso (libSQL, SQLite-compatible, hosted) — minimal code changes since drizzle-orm abstracts the driver
- better-sqlite3 build fails → try libsql as drop-in, or worst case use PostgreSQL on Railway (free tier)
- node-cron in instrumentation.ts fails → move cron to a separate lightweight process or use Railway's built-in cron
- Satori+sharp fails on Railway Linux → pre-render carousels as SVGs client-side, convert server-side with sharp only
- Upload-Post analytics can't match → store our own post IDs mapped to Upload-Post IDs at publish time

### Test artifacts
- Keep validation scripts as standalone files in a `scripts/validate/` directory
- Each test is a self-contained script that exits 0 (pass) or 1 (fail) with clear output
- These become smoke tests we can re-run after Railway config changes or upgrades
- Don't over-engineer — simple scripts, not a test framework

### API key requirements
- **Upload-Post**: Real API key needed — test listing accounts and checking analytics endpoint shape
- **Claude/OpenAI/R2**: NOT needed for Phase 0 — these are validated implicitly by their well-documented SDKs
- Store test API key in `.env.local` (gitignored)

### Claude's Discretion
- Exact Railway configuration (Dockerfile vs Nixpacks, volume mount path)
- Order of validation tests
- How much logging/output each validation script produces
- Whether to use a monorepo or flat structure for the test app

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 0 will establish initial patterns

### Integration Points
- Railway deployment pipeline (git push → auto-deploy)
- Upload-Post API (REST endpoints for publishing and analytics)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — user trusts Claude's technical judgment on all implementation details. Focus on validating quickly and moving on.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 00-infrastructure-validation-spike*
*Context gathered: 2026-03-16*
