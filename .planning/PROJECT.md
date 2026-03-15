# Personal Content Engine

## What This Is

A personal tool for managing multiple brands/niches across multiple social media platforms. AI generates platform-optimized content using each brand's voice, schedules it, monitors RSS feeds for auto-posting, and learns from performance data to improve over time. Built lean — no SaaS overhead, no billing, no multi-user auth. You are the only user, but you manage multiple brands, each with their own social accounts, voice, and goals.

## Core Value

Set up a brand once, then only check in weekly. Everything else — discovery, filtering, generation, refinement, quality-checking, scheduling, publishing, and learning — runs autonomously.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

- [ ] Brand management: create/edit brands with voice, audience, goals, topics, dos/donts, examples, platform notes
- [ ] Social account connection: connect brand accounts via Upload-Post (X, LinkedIn, Instagram, TikTok, etc.)
- [ ] Content extraction: YouTube transcripts, articles, PDFs, manual text input
- [ ] AI text generation: brand-aware, platform-optimized content with Claude API
- [ ] Title/hook optimization: generate 5-10 hook variants, score, pick best
- [ ] Self-refine loop: generate → Sonnet critique → Opus rewrite (conditional skip if score ≥ 8)
- [ ] Quality gate: Sonnet scores 1-10, reject/improve/pass before scheduling
- [ ] AI image generation: OpenAI GPT Image with brand watermark, style consistency
- [ ] Carousel generation: Satori + sharp templates with brand colors, logo, CTA
- [ ] RSS feed monitoring: RSS, YouTube channels, subreddits, Google News (all via RSS)
- [ ] Relevance filtering: Haiku filters feed entries by brand relevance (1-10 score)
- [ ] Content automation pipeline: discover → filter → extract → generate → decide → schedule → publish
- [ ] Automation levels: manual, semi-auto, mostly-auto, full-auto per brand
- [ ] Slot-based scheduling with timing jitter (±15 min) and volume limits
- [ ] Auto-publish via Upload-Post with retry logic (3 retries, 5 min backoff)
- [ ] Content calendar: week/month views, drag-and-drop rescheduling
- [ ] Analytics collection: fetch metrics from Upload-Post every 6 hours, calculate engagement scores
- [ ] Dashboard: cross-brand overview, brand home, activity log
- [ ] Spam prevention: staggered posting, rate limits, warmup, dedup, link frequency
- [ ] Simple password auth (single user, session cookie)
- [ ] Daily DB backup to Cloudflare R2
- [ ] Circuit breaker for API failures
- [ ] Daily AI spend tracking and limits

### Out of Scope

- Multi-user auth / billing / SaaS features — personal tool only
- Video generation (Remotion + TTS) — deferred to future
- Audio transcription (Whisper) — deferred to future
- Voice cloning — deferred to future
- Mobile app — web dashboard only

## Context

- **Single user**: no RLS, no multi-tenancy, simple password auth
- **Upload-Post**: handles actual publishing to all platforms via their API. Basic plan: $16/mo, 5 profiles, unlimited uploads. Publishes from their servers (no IP concerns).
- **Railway**: always-on hosting with volume mount for SQLite persistence. Auto-deploys from Git.
- **Cloudflare R2**: S3-compatible storage for generated images/carousels. Free first 10GB.
- **Two milestones**: M1 = working engine (Phases 0-7, ~16.5 days), M2 = intelligence layer (Phases 8-11, ~9 days, after 2-4 weeks of M1 data collection)
- **Self-improvement system**: inspired by Karpathy's autoresearch pattern. AI analyzes performance data weekly, generates learnings, validates them against real engagement, evolves prompt templates monthly.

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
| SQLite over Postgres | Single user, entire DB is a file, trivial backup, no separate service | — Pending |
| drizzle-orm over raw SQL | Type-safe queries, schema migrations, studio for debugging | — Pending |
| node-cron over separate scheduler | Same process, same codebase, no extra service | — Pending |
| Upload-Post over direct API | Handles 11 platforms, publishes from their servers, no IP concerns | — Pending |
| Tailwind v4 + shadcn v4 | Latest versions, best DX for 2026 greenfield project | — Pending |
| Testing mode first | Start with cheap models (Haiku/Sonnet), upgrade when confident pipeline works | — Pending |
| Cloudflare R2 over S3 | Free first 10GB, S3-compatible, no vendor lock-in | — Pending |
| Satori + sharp for carousels | No browser needed, runs in Node.js, free | — Pending |
| Railway over Vercel | Always-on (cron jobs need it), volume mount for SQLite, auto-deploy | — Pending |

---
*Last updated: 2026-03-15 after initialization*
