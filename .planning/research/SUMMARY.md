# Project Research Summary

**Project:** Personal Content Engine
**Domain:** AI-powered social media content automation
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

This is a personal content automation engine — a single-user tool that manages multiple brands across social media platforms. The architecture is intentionally monolithic: one Next.js process handles the web dashboard, API routes, and cron jobs. SQLite provides the database (trivial backup, no separate service), and Upload-Post handles multi-platform publishing.

The recommended approach follows a two-milestone strategy. M1 builds the working engine (discover → filter → generate → refine → quality-check → schedule → publish), while M2 adds the intelligence layer (self-improvement from engagement data). The 2-4 week gap between milestones lets M1 collect real engagement data that M2 needs.

Key risks are SQLite corruption on Railway (mitigated by volume mount + WAL mode), AI cost explosion (mitigated by spend limits and testing mode), and platform shadowbans (mitigated by comprehensive spam prevention). All three are addressed in the plan's Phase 0 validation spike.

## Key Findings

### Recommended Stack

The stack is well-chosen for a single-user tool. Next.js 15 with App Router provides the full-stack framework. SQLite via better-sqlite3 + drizzle-orm is ideal for single-user (entire DB is a file, back up by copying). Tailwind v4 + shadcn/ui v4 for the dashboard UI.

**Core technologies:**
- **Next.js 15 (App Router)**: Full-stack framework with `instrumentation.ts` for cron startup — single deploy on Railway
- **SQLite + drizzle-orm**: Type-safe queries, schema migrations, zero-config DB — perfect for single user
- **node-cron**: In-process scheduled jobs — poll-feeds, auto-generate, auto-publish, collect-analytics, backup-db
- **Claude API + OpenAI**: AI generation (Claude Opus/Sonnet/Haiku), image generation (GPT Image)
- **Upload-Post**: Multi-platform publishing (11 platforms), analytics endpoint

### Expected Features

**Must have (table stakes):**
- Brand management (voice, audience, goals, visual style)
- Social account connection via Upload-Post
- Manual post creation (source → generate → preview → publish)
- Content calendar with scheduling
- Activity log

**Should have (competitive edge):**
- AI generation with quality pipeline (title optimization, self-refine, quality gate)
- RSS feed automation (full pipeline)
- AI image generation with brand watermark
- Carousel generation
- Engagement score tracking

**Defer (M2):**
- Self-improvement loop, multi-variant, prompt evolution, evergreen recycling

### Architecture Approach

Single-process monolith: Next.js handles HTTP, cron jobs run in-process via `instrumentation.ts` singleton. Four layers: Presentation (pages), API (routes/actions), Service (AI, quality, ingestion, publishing), Data (SQLite, R2, external APIs).

**Major components:**
1. **Dashboard (6 pages per brand)** — brand management, creation, calendar, analytics, feeds, activity
2. **Content Pipeline (7 stages)** — discover → filter → extract → generate → decide → schedule → publish
3. **Quality Pipeline (4 techniques)** — title optimization → generate → self-refine → quality gate
4. **Cron System (5 jobs)** — poll-feeds, auto-generate, auto-publish, collect-analytics, backup-db

### Critical Pitfalls

1. **SQLite corruption on Railway** — mount volume, enable WAL, run integrity check on startup, daily R2 backup
2. **AI cost explosion** — MAX_DAILY_AI_SPEND limit, batch limits on feed polling, AI_MODE=testing during dev
3. **Platform shadowban** — per-platform rate limits, timing jitter, warmup period, content variety enforcement
4. **Duplicate publishes** — use `publishing` as intermediate state, only recover posts stuck > 30 min
5. **RSS prompt injection** — feed content in USER message only, sanitize HTML, quality gate catches anomalies

## Implications for Roadmap

### Phase 0: Infrastructure Validation Spike
**Rationale:** Validate risky assumptions before building — SQLite on Railway, Upload-Post analytics matching, better-sqlite3 builds, Satori renders, cron works
**Delivers:** Confidence that stack works end-to-end
**Avoids:** Discovering deal-breakers on day 10

### Phase 1: Scaffolding + Database + Auth
**Rationale:** Foundation everything else depends on — DB, auth, cron infra, API clients
**Delivers:** Working skeleton with all services connected
**Addresses:** Auth, DB setup, cron infrastructure, circuit breaker, spend tracker

### Phase 2A: Brand Profiles + AI Text Generation
**Rationale:** Core domain model (brands) + the primary value prop (AI generation)
**Delivers:** Create brand → generate content → preview → publish manually
**Addresses:** Brand CRUD, Claude integration, title optimization

### Phase 2B: Quality Pipeline
**Rationale:** Quality directly impacts brand reputation — add before automation
**Delivers:** Self-refine loop + quality gate wired into creation flow

### Phase 3: Content Extraction + Image Generation
**Rationale:** Multiple input types + visual content expand what the engine can do
**Delivers:** YouTube/article/PDF extraction, AI images with brand watermark

### Phase 4: Carousel Generation
**Rationale:** High engagement format, needs brand visual system from Phase 2A
**Delivers:** 3-5 Satori templates, carousel preview + generation

### Phase 5: Calendar + Scheduling
**Rationale:** Needs publishing (Phase 1) + content types (Phases 2-4)
**Delivers:** Calendar views, drag-and-drop, auto-publish cron with jitter

### Phase 6: Content Automation Pipeline
**Rationale:** The full pipeline — connects all previous phases into autonomous operation
**Delivers:** RSS feeds → filter → extract → generate → quality check → schedule → publish

### Phase 7: Analytics Collection + Dashboard + Polish
**Rationale:** Needs published posts (from Phase 6) to have something to measure
**Delivers:** Engagement metrics, dashboard pages, activity log, weekly digest

### Phase Ordering Rationale

- **Phase 0 first** — validates risky infrastructure assumptions
- **Phases 1-2B** — foundation + core value prop (AI generation with quality)
- **Phases 3-4** — expand content types (images, carousels) before automation
- **Phase 5** — scheduling infrastructure needed by Phase 6
- **Phase 6** — full automation pipeline connects everything
- **Phase 7** — analytics needs published posts to measure

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Upload-Post API specifics — auth flow, rate limits, webhook format
- **Phase 4:** Satori JSX limitations — what CSS properties are supported
- **Phase 6:** RSS feed edge cases — malformed feeds, encoding issues, rate limiting

Phases with standard patterns (skip research-phase):
- **Phase 2A:** Claude API is well-documented, standard prompt engineering
- **Phase 5:** Calendar UI is a solved problem with established patterns
- **Phase 7:** Dashboard pages are standard CRUD + charts

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Proven technologies, well-documented, community support |
| Features | HIGH | Comprehensive plan with detailed specifications |
| Architecture | HIGH | Monolithic single-process is ideal for single-user |
| Pitfalls | HIGH | Plan already addresses most pitfalls explicitly |

**Overall confidence:** HIGH

### Gaps to Address

- Upload-Post API: exact analytics matching mechanism (by request ID? by URL?) — validate in Phase 0
- Satori: confirm all needed CSS features work (gradients, shadows, custom fonts) — validate in Phase 0
- Tailwind v4 + shadcn v4: confirm full compatibility and component availability — check during Phase 1

## Sources

### Primary (HIGH confidence)
- Comprehensive project plan document (1785 lines)
- Next.js 15 official documentation
- drizzle-orm documentation
- Railway documentation (volumes, always-on)

### Secondary (MEDIUM confidence)
- Upload-Post API documentation
- Cloudflare R2 documentation
- Satori GitHub repository

---
*Research completed: 2026-03-15*
*Ready for roadmap: yes*
