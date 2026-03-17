---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 05-01-PLAN.md (scheduling backend)
last_updated: "2026-03-17T22:23:40.474Z"
progress:
  total_phases: 9
  completed_phases: 6
  total_plans: 21
  completed_plans: 19
---

# STATE: Personal Content Engine

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-15)

**Core value:** Set up a brand once, then only check in weekly. Everything else runs autonomously.
**Current focus:** Phase 4 complete (carousel generation fully implemented and verified), ready for Phase 5 (Calendar + Scheduling)

## Current Milestone

**Milestone 1: Working Engine**
- Status: In Progress
- Phases: 8 (Phase 0 through Phase 7)
- Requirements: 67

## Phase Status

| # | Phase | Status | Started | Completed |
|---|-------|--------|---------|-----------|
| 0 | Infrastructure Validation | Complete | 2026-03-16 | 2026-03-16 |
| 1 | Scaffolding + Database + Auth | Complete | 2026-03-16 | 2026-03-16 |
| 2A | Brand Profiles + AI Generation | Complete | 2026-03-17 | 2026-03-17 |
| 2B | Quality Pipeline | Complete | 2026-03-17 | 2026-03-17 |
| 3 | Content Extraction + Images | Complete | 2026-03-17 | 2026-03-17 |
| 4 | Carousel Generation | Complete | 2026-03-17 | 2026-03-17 |
| 5 | Calendar + Scheduling | Not Started | — | — |
| 6 | Content Automation Pipeline | Not Started | — | — |
| 7 | Analytics + Dashboard + Polish | Not Started | — | — |

## Decisions

- better-sqlite3 v12.8.0 required (not v9.6.0) for prebuilt Node 22 Windows binaries
- Satori requires WOFF format fonts (not WOFF2 or variable TTF) -- use @fontsource/inter WOFF files
- tsx validation scripts need async main() wrapper (CJS output doesn't support top-level await)
- @fontsource/inter installed as devDependency for reliable binary font files
- Dockerfile required for Railway (not Railpack): better-sqlite3 needs python3/make/g++ for native compilation
- HOSTNAME=0.0.0.0 required in Dockerfile ENV for Railway networking
- node-cron must be in serverExternalPackages explicitly (auto-externals not reliable in standalone)
- Next.js standalone does NOT compile instrumentation.ts -- cron must initialize via health endpoint or custom server.js
- SQLite volume mount confirmed: /data volume persists across Railway redeployment
- [Phase 01-01]: drizzle-orm updated to 0.45.1 (from 0.30.x) to match drizzle-kit@0.31.9 requirement
- [Phase 01-01]: shadcn v4 uses Nova preset (Radix + Geist) -- --style flag removed in shadcn v4 CLI
- [Phase 01-01]: R2 S3Client requires requestChecksumCalculation: WHEN_REQUIRED for SDK v3.729.0+ compatibility with R2
- [Phase 01]: middleware.ts runtime: nodejs is stable in Next.js 15.5 enabling better-sqlite3 session lookup without JWT or edge workarounds
- [Phase 01]: bcryptjs pure-JS library used for password validation (not bcrypt) -- avoids native C++ binding issues in Next.js bundler
- [Phase 01-scaffolding-database-auth]: shadcn v4 base-ui Triggers (DropdownMenuTrigger, TooltipTrigger) do not accept asChild prop -- use className directly
- [Phase 01-scaffolding-database-auth]: AppSidebar is a server component querying getDb() directly for brand switcher data -- no separate API route needed
- [Phase 01-scaffolding-database-auth]: [Phase 01-03]: Dark mode only -- html className=dark + ThemeProvider(defaultTheme=dark, enableSystem=false) eliminates light-mode flash
- [Phase 01-04]: base-ui Button/DialogTrigger use render prop (render={<Link />}) not asChild -- all UI components follow this pattern
- [Phase 01-04]: base-ui Select onValueChange passes string|null -- handlers must accept null
- [Phase 01-04]: DeleteBrandDialog isolated as client component to keep detail page as server component while enabling typed-name confirmation state
- [Phase 01-scaffolding-database-auth]: Cron logs to activityLog table for observability without extra infrastructure
- [Phase 01-scaffolding-database-auth]: syncAccounts never deletes rows -- only inserts or re-connects -- preserves history
- [Phase 2A-01]: Prompt-based JSON extraction used instead of native structured outputs (claude-haiku-3 does not support output_config.format)
- [Phase 2A-01]: Module-level Anthropic client instantiation (one per process, reads ANTHROPIC_API_KEY from env)
- [Phase 2A-01]: saveGeneratedPosts uses redirect() after insert; generateContent returns data -- different action patterns for different use cases
- [Phase 2A-02]: Native HTML checkboxes with has-[:checked] Tailwind styling (no shadcn Checkbox component needed)
- [Phase 2A-02]: Generation page split into server page.tsx + client generate-section.tsx following accounts-section.tsx pattern
- [Phase 2A-02]: Separate useTransition hooks for generate and save operations (independent loading states)
- [Phase 2B-01]: Critique fallback returns score=7 (not throw) to avoid blocking users when AI parse fails
- [Phase 2B-01]: refineAndGate() uses per-platform retried flag ensuring exactly one retry per platform at score 5-6
- [Phase 2B-02]: genCost tracked separately in state so generation cost is preserved while refinement runs
- [Phase 2B-02]: Discarded tabs shown with strikethrough/opacity so user sees what was attempted
- [Phase 2B-02]: hasPassingContent derived from result.platforms at render time (not state) to stay in sync
- [Phase 03]: gpt-image-1 returns b64_json only (not URL) -- response.data[0].b64_json extraction required
- [Phase 03]: Module-level OpenAI client (same singleton pattern as Anthropic client in generate.ts)
- [Phase 03]: Watermark failure is non-fatal in image-gen.ts -- logged and image proceeds without watermark
- [Phase 03-01]: pdf-parse v2 uses PDFParse class API (not v1 function call) -- new PDFParse({ data: Uint8Array }) + .getText()
- [Phase 03-01]: extractSource action is additive -- called client-side before generateContent so user can see and edit extracted text
- [Phase 03]: Image generation section always visible on generate page (not gated by text results) -- independent image workflows
- [Phase 03]: Media grid detail view uses inline expanded panel below grid (not modal/overlay) -- simpler UX, no portal needed
- [Phase 03]: router.refresh() after regeneration to re-fetch server component data (Next.js App Router pattern)
- [Phase 03-03]: openai downgraded from v6 to v4 — v6 broke gpt-image-1 b64_json extraction; v4 stable and compatible
- [Phase 03-03]: openai added to serverExternalPackages in next.config.ts — required for Node.js-only SDK in Next.js standalone build
- [Phase 03-04]: Client-side useMemo filtering for media library (no server roundtrip; per-brand dataset is small)
- [Phase 03-04]: useEffect closes detail panel on filter/sort change to prevent orphaned detail views
- [Phase 04-carousel-generation]: Migration renamed from 0004_brainy_morph to 0004_carousels; 0003_snapshot.json manually created to fix drizzle-kit lineage gap
- [Phase 04-carousel-generation]: Satori object-vnode style (no JSX) used in all carousel templates; fonts loaded once per renderCarouselSlides call
- [Phase 04-carousel-generation]: getCarousels wraps getR2PublicUrl in try/catch so missing R2_MEDIA_PUBLIC_BASE in dev is non-fatal
- [Phase 04-carousel-generation]: Carousel section uses optimistic UI update after render -- no router.refresh() needed
- [Phase 04-carousel-generation]: Clicking a previous carousel card expands inline detail panel showing all slides (added during verification)
- [Phase 05-01]: publishDuePosts uses globalThis.__publishRunning mutex to prevent overlapping cron ticks
- [Phase 05-01]: Per-platform publish retry: 5-minute backoff, capped at 3 failures before status=failed
- [Phase 05-01]: Post status only transitions to published/failed after ALL platforms are resolved
- [Phase 05-01]: scheduleToNextSlot applies UTC-based slot matching with +/-15 min random jitter

## Blockers

None.

## Notes

- Using AI_MODE=testing during development ($6-11/mo vs $90-230/mo)
- Tailwind v4 + shadcn v4 chosen for latest compatibility
- drizzle-orm for type-safe queries + migrations
- After M1 runs 2-4 weeks collecting data, start M2 (Phases 8-11)
- INFRA-01 through INFRA-05 validated locally (Plan 01) and on Railway (Plan 02) -- all confirmed
- Railway test project deleted after capturing results (spike complete)

## Session Continuity

Last session: 2026-03-17T22:23:40.469Z
Stopped at: Completed 05-01-PLAN.md (scheduling backend)
Resume file: None

---
*State initialized: 2026-03-15*
*Last updated: 2026-03-17 after Phase 04 Plan 02 completion*
