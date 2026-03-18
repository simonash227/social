# Personal Content Engine

## What This Is

A personal content engine that manages multiple brands across social media platforms. AI generates platform-optimized content using each brand's voice, monitors RSS feeds for auto-posting, schedules with spam prevention, and publishes autonomously via Upload-Post. Built lean — single user, no SaaS overhead.

## Core Value

Set up a brand once, then only check in weekly. Everything else — discovery, filtering, generation, refinement, quality-checking, scheduling, publishing, and learning — runs autonomously.

## Requirements

### Validated

- ✓ Brand management: create/edit brands with voice, audience, goals, topics, dos/donts, examples, platform notes — v1.0
- ✓ Social account connection: connect brand accounts via Upload-Post — v1.0
- ✓ Content extraction: YouTube transcripts, articles, PDFs, manual text input — v1.0
- ✓ AI text generation: brand-aware, platform-optimized content with Claude API — v1.0
- ✓ Title/hook optimization: generate 5-10 hook variants, score, pick best — v1.0
- ✓ Self-refine loop: generate → Sonnet critique → Opus rewrite (conditional skip if score ≥ 8) — v1.0
- ✓ Quality gate: Sonnet scores 1-10, reject/improve/pass before scheduling — v1.0
- ✓ AI image generation: OpenAI GPT Image with brand watermark, style consistency — v1.0
- ✓ Carousel generation: Satori + sharp templates with brand colors, logo, CTA — v1.0
- ✓ RSS feed monitoring: RSS, YouTube channels, subreddits, Google News (all via RSS) — v1.0
- ✓ Relevance filtering: Haiku filters feed entries by brand relevance (1-10 score) — v1.0
- ✓ Content automation pipeline: discover → filter → extract → generate → decide → schedule → publish — v1.0
- ✓ Automation levels: manual, semi-auto, mostly-auto, full-auto per brand — v1.0
- ✓ Slot-based scheduling with timing jitter (±15 min) and volume limits — v1.0
- ✓ Auto-publish via Upload-Post with retry logic (3 retries, 5 min backoff) — v1.0
- ✓ Content calendar: week/month views, drag-and-drop rescheduling — v1.0
- ✓ Analytics collection: fetch metrics from Upload-Post every 6 hours, calculate engagement scores — v1.0
- ✓ Dashboard: cross-brand overview, brand home, activity log — v1.0
- ✓ Spam prevention: staggered posting, rate limits, warmup, dedup, link frequency — v1.0
- ✓ Simple password auth (single user, session cookie) — v1.0
- ✓ Daily DB backup to Cloudflare R2 — v1.0
- ✓ Circuit breaker for API failures — v1.0
- ✓ Daily AI spend tracking and limits — v1.0

### Active

<!-- M2 Intelligence Layer — requires 2-4 weeks of M1 data collection first -->

- [ ] Self-improvement: weekly analysis of top/bottom performers → learnings injected into prompts
- [ ] Learning validation: A/B test learnings, deactivate ineffective ones
- [ ] Golden examples: auto-curate 90th percentile posts as few-shot examples
- [ ] Multi-variant generation: 3 variants per post, gate picks best
- [ ] Prompt evolution: monthly cron suggests improved templates, A/B tests
- [ ] Evergreen recycling: resurface top performers with fresh angle
- [ ] Content repurposing chains: spread one source across days/platforms
- [ ] Engagement helper: unresponded comments + suggested replies
- [ ] Advanced analytics: charts, platform comparison, posting time heatmap

### Out of Scope

- Multi-user auth / billing / SaaS features — personal tool only
- Video generation (Remotion + TTS) — high complexity, deferred
- Audio transcription (Whisper) — not core to content repurposing
- Voice cloning — future personal brand feature
- Mobile app — web dashboard sufficient
- Auto-reply to comments — platform detection risk
- Real-time analytics — engagement data needs 48h to stabilize
- Offline mode — always-on server is core architecture

## Context

Shipped v1.0 with 13,213 LOC TypeScript across 215 files in 4 days.

**Tech stack:** Next.js 15 (App Router), SQLite (better-sqlite3 + drizzle-orm), node-cron, Tailwind v4 + shadcn/ui v4, Satori + sharp, Cloudflare R2, Railway

**Current state:** Full pipeline operational — RSS → Haiku filter → extract → Claude generate → Sonnet refine → quality gate → schedule → Upload-Post publish. Dashboard monitors all brands. Analytics collecting engagement data.

**Next:** Deploy to Railway, run M1 for 2-4 weeks collecting engagement data, then start M2 (Intelligence Layer) with self-improvement loop.

## Constraints

- **Tech stack**: Next.js 15 (App Router), SQLite via better-sqlite3 + drizzle-orm, node-cron, Tailwind v4 + shadcn/ui v4, TypeScript
- **Budget**: ~$31-38/mo testing mode, ~$74-131/mo production (optimized)
- **API keys**: 4 total — Anthropic (Claude), Upload-Post, OpenAI, Cloudflare R2
- **Hosting**: Railway with volume mount for SQLite persistence ($8-10/mo)
- **AI costs**: configurable per-task model selection (AI_MODE=testing → cheap models, production → Opus/Sonnet)
- **One process**: everything runs in a single Node.js process — web server, cron jobs, no separate services

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| SQLite over Postgres | Single user, entire DB is a file, trivial backup, no separate service | ✓ Good — simple, fast, zero-config |
| drizzle-orm over raw SQL | Type-safe queries, schema migrations, studio for debugging | ✓ Good — 7 migrations landed cleanly |
| node-cron over separate scheduler | Same process, same codebase, no extra service | ✓ Good — init via health endpoint workaround for standalone mode |
| Upload-Post over direct API | Handles 11 platforms, publishes from their servers, no IP concerns | ✓ Good — simplified publishing greatly |
| Tailwind v4 + shadcn v4 | Latest versions, best DX for 2026 greenfield project | ⚠ Revisit — base-ui API differences caused friction (asChild, render props) |
| Testing mode first | Start with cheap models (Haiku/Sonnet), upgrade when confident pipeline works | ✓ Good — kept costs low during development |
| Cloudflare R2 over S3 | Free first 10GB, S3-compatible, no vendor lock-in | ✓ Good — worked seamlessly |
| Satori + sharp for carousels | No browser needed, runs in Node.js, free | ✓ Good — WOFF font requirement was only gotcha |
| Railway over Vercel | Always-on (cron jobs need it), volume mount for SQLite, auto-deploy | ✓ Good — Dockerfile approach works, volume persists |
| Prompt-based JSON extraction | claude-haiku-3 doesn't support output_config.format | ✓ Good — reliable with fallback parsing |
| openai SDK v4 over v6 | v6 broke gpt-image-1 b64_json extraction | ⚠ Revisit — check if v6 fixes land |

---
*Last updated: 2026-03-19 after v1.0 milestone*
