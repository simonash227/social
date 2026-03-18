# Phase 1: Scaffolding + Database + Auth - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the foundation that everything else depends on — database schema with drizzle-orm, simple password auth, cron infrastructure, API client wrappers (Upload-Post, Claude, OpenAI, R2), brand CRUD, social account management, and the dashboard shell. No content generation, no scheduling, no automation — just the skeleton.

</domain>

<decisions>
## Implementation Decisions

### Database schema
- Use drizzle-orm with better-sqlite3 driver (validated in Phase 0)
- Schema-first approach: define all tables upfront in `src/db/schema.ts`, even if some are empty until later phases
- Tables needed now: brands, social_accounts, feed_sources, posts, post_platforms, feed_entries, activity_log, ai_spend_log
- Use drizzle-kit for migrations (`drizzle-kit generate` + `drizzle-kit migrate`)
- DB opens at `/data/app.db` (Railway volume) or `./data/app.db` (local dev) — use `RAILWAY_VOLUME_MOUNT_PATH` env var pattern from Phase 0
- WAL mode + integrity check on startup (pattern validated in Phase 0)

### Auth approach
- Single password stored as `AUTH_PASSWORD` env var (hashed with bcrypt at first login, or just compare plaintext since it's personal)
- Session via HTTP-only secure cookie with a random token stored in a `sessions` table
- Middleware checks session cookie on every request, redirects to `/login` if invalid
- No registration page — just a login form
- Session expires after 30 days of inactivity

### Cron infrastructure
- Initialize cron jobs in a server-side module loaded on first API request (not instrumentation.ts — doesn't work in standalone mode per Phase 0 finding)
- Use globalThis singleton guard pattern
- Cron jobs registered in Phase 1: DB backup (daily), AI spend reset (daily)
- Future phases add: poll-feeds, auto-generate, auto-publish, collect-analytics

### API client wrappers
- `src/lib/upload-post.ts` — Upload-Post API client (list accounts, publish, get analytics)
- `src/lib/ai.ts` — Claude API client with AI_MODE switching (testing → cheap models, production → Opus/Sonnet)
- `src/lib/r2.ts` — Cloudflare R2 client for media storage
- Each client reads API keys from env vars, throws clear errors if missing
- Circuit breaker wrapper: tracks consecutive failures per service, pauses calls after N failures, auto-resets after cooldown

### Brand CRUD
- Single-page brand form (not wizard) — create and edit use the same form
- Required fields on create: name, niche, voice/tone description
- Optional fields (can fill in later): target audience, goals, topics, dos/donts, example posts, platform-specific notes, CTA text, bio template, bio link, banned hashtags
- Visual style section: primary/secondary colors (color pickers), logo URL, watermark position (dropdown: top-left/top-right/bottom-left/bottom-right), watermark opacity (slider 0-100%)
- Warmup date: date picker for new accounts
- Delete brand: confirmation dialog with brand name typed to confirm
- Brands list: card grid showing brand name, niche, number of connected accounts, and visual style preview (color swatch)

### Social accounts
- Brand detail page has "Connected Accounts" section
- "Connect Account" opens Upload-Post dashboard in new tab (accounts are managed there)
- We fetch and display connected accounts from Upload-Post API
- Show: platform icon, username, connection status (connected/disconnected)
- Auto-mark disconnected after 5 consecutive publish failures (tracked in posts table)

### Dashboard shell
- Left sidebar navigation: Home, Brands, Calendar, Activity Log, Settings
- Top bar: current brand name (or "All Brands"), AI_MODE indicator badge (green=testing, orange=production), system health dot
- Brand switcher: dropdown in sidebar showing all brands, "All Brands" option at top
- Sidebar collapses to icons on mobile
- Use shadcn/ui components: Sidebar, Card, Button, Input, Select, Dialog, DropdownMenu, Badge, Avatar
- Dark mode only (simpler, looks professional for a dashboard)

### Infrastructure utilities
- Daily DB backup: cron copies SQLite file to R2 with date-stamped key, keeps last 7
- AI spend tracking: log each API call cost, sum daily, hard stop at MAX_DAILY_AI_SPEND env var
- Input sanitization: strip HTML tags, invisible unicode, excessive whitespace from feed content
- Circuit breaker: per-service failure counter, configurable threshold (default 5), cooldown (default 5 min)

### Claude's Discretion
- Exact drizzle schema column types and indexes
- Middleware implementation details
- Component file organization within src/
- Tailwind theme configuration
- Error page designs
- Loading state implementations

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/validate/01-sqlite-wal.ts` — WAL mode + integrity check pattern (reuse in DB init)
- `scripts/validate/03-cron-singleton.ts` — globalThis singleton guard (reuse in cron init)
- `Dockerfile` — multi-stage build with python3/make/g++ (keep as-is)
- `next.config.ts` — standalone output + serverExternalPackages configured

### Established Patterns
- Database path: `process.env.RAILWAY_VOLUME_MOUNT_PATH ?? './data'` + `/app.db`
- Cron init via globalThis guard (not instrumentation.ts — standalone mode bug)
- WOFF fonts for Satori (not WOFF2/variable TTF)
- better-sqlite3 v12.8.0 (not v9.x — Node 22 compatibility)

### Integration Points
- `src/app/api/health/route.ts` — existing health endpoint, will coexist with new API routes
- `public/fonts/Inter-Regular.woff` — font file for Satori (reuse for carousel generation later)
- `.env.local` — add AUTH_PASSWORD, ANTHROPIC_API_KEY, OPENAI_API_KEY, R2_* vars

</code_context>

<specifics>
## Specific Ideas

- Dark mode only — keeps the dashboard clean and focused
- Brand cards should show a color swatch preview of the brand's visual identity
- Keep the sidebar minimal — just the core navigation, no clutter
- AI_MODE badge in the top bar so it's always visible (avoid accidentally running expensive models)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-scaffolding-database-auth*
*Context gathered: 2026-03-16*
