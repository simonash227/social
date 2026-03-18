# Roadmap: Personal Content Engine

**Created:** 2026-03-15
**Milestone:** M1 — Working Engine
**Phases:** 8
**Requirements:** 67 mapped

## Phase Overview

| # | Phase | Status | Completed | Plans |
|---|-------|--------|-----------|-------|
| 0 | Infrastructure Validation | Complete | 2026-03-16 | 2/2 |
| 1 | Scaffolding + Database + Auth | Complete | 2026-03-16 | 5/5 |
| 2A | Brand Profiles + AI Generation | Complete | 2026-03-17 | 3/3 |
| 2B | Quality Pipeline | Complete | 2026-03-17 | 2/2 |
| 3 | Content Extraction + Images | Complete | 2026-03-17 | 4/4 |
| 4 | Carousel Generation | Complete | 2026-03-17 | 2/2 |
| 5 | 2/3 | In Progress|  | 0/3 |
| 6 | 3/4 | In Progress|  | 0/4 |
| 7 | 1/3 | In Progress|  | 0/3 |

---

## Phase Details

### Phase 0: Infrastructure Validation Spike

**Goal:** Validate the 5 riskiest stack assumptions before building anything. Half-day spike to prevent discovering deal-breakers later.

**Requirements:** INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05

**Success Criteria:**
1. SQLite + WAL mode works on Railway volume mount without corruption
2. better-sqlite3 + Next.js 15 builds and deploys successfully on Railway
3. node-cron starts via instrumentation.ts singleton and survives Railway redeploy
4. Satori + sharp renders carousel PNGs on Railway's Linux environment
5. Upload-Post API analytics data can be matched back to posts

**Estimated effort:** 0.5 days

**Plans:** 2/2 plans complete

Plans:
- [x] 00-01-PLAN.md — Scaffold Next.js 15 project + create 5 local validation scripts (DONE 2026-03-16)
- [x] 00-02-PLAN.md — Deploy to Railway + validate infrastructure on Linux environment (DONE 2026-03-16)

---

### Phase 1: Scaffolding + Database + Auth

**Goal:** Build the foundation that everything else depends on — database, auth, cron infrastructure, API client wrappers, brand CRUD, and the dashboard shell.

**Requirements:** INFRA-06, INFRA-07, INFRA-08, INFRA-09, AUTH-01, AUTH-02, AUTH-03, BRAND-01, BRAND-02, BRAND-03, BRAND-04, BRAND-05, BRAND-06, ACCT-01, ACCT-02, ACCT-03, DASH-04

**Success Criteria:**
1. Next.js app runs locally with SQLite (WAL mode, pragmas, drizzle schema)
2. Password auth works (login, session persistence, redirect)
3. Brand CRUD works end-to-end (create, edit, delete with confirmation)
4. Upload-Post client connects and lists available accounts
5. Cron jobs initialize via health endpoint with singleton guard

**Estimated effort:** 2 days

**Plans:** 5/5 plans complete

Plans:
- [ ] 01-01-PLAN.md — Foundation: shadcn/ui init, database schema + migrations, circuit breaker, sanitizer, API client stubs
- [ ] 01-02-PLAN.md — Auth: password login, session cookies, middleware protection
- [ ] 01-03-PLAN.md — Dashboard shell: sidebar navigation, brand switcher, top bar with AI_MODE badge
- [ ] 01-04-PLAN.md — Brand CRUD: create, edit, delete with confirmation, card grid, detail page
- [ ] 01-05-PLAN.md — Cron infrastructure, DB backup, AI spend tracking, social account sync

---

### Phase 2A: Brand Profiles + AI Text Generation

**Goal:** Core value proposition — generate brand-aware, platform-optimized content using Claude API with title/hook optimization.

**Requirements:** GEN-01, GEN-03, GEN-04, GEN-05, GEN-06, GEN-07, GEN-08

**Success Criteria:**
1. User can paste URL/text → AI generates platform-specific posts using brand voice
2. Title optimization generates 5-10 hook variants, scores them, uses best
3. Generated content can be previewed per-platform with accurate formatting
4. User can edit generated content before publishing

**Estimated effort:** 2 days

**Plans:** 3/3 plans complete

Plans:
- [x] 2A-01-PLAN.md — Install Anthropic SDK, add postPlatforms content column, build generation server action with prompt construction and hook optimization (DONE 2026-03-17)
- [x] 2A-02-PLAN.md — Build generation page UI at /brands/[id]/generate with source input, platform selection, preview, editing, save; add Generate button to brand detail page (DONE 2026-03-17)
- [x] 2A-03-PLAN.md — Human verification of end-to-end AI content generation flow (DONE 2026-03-17)

---

### Phase 2B: Quality Pipeline

**Goal:** Ensure every post meets quality standards before publishing. Self-refine loop + quality gate.

**Requirements:** QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05

**Success Criteria:**
1. Self-refine loop: Sonnet critiques on 5 dimensions, Opus rewrites
2. Conditional skip: posts scoring >= 8 skip self-refine
3. Quality gate enforces routing: >= 7 pass, 5-7 re-refine, < 5 discard with reason

**Estimated effort:** 1.5 days

**Plans:** 2/2 plans complete

Plans:
- [x] 2B-01-PLAN.md — Schema migration for qualityDetails + refineAndGate() backend with critique/rewrite/gate logic + saveGeneratedPosts() extension (DONE 2026-03-17)
- [x] 2B-02-PLAN.md — Wire quality pipeline into generation UI with loading states, quality badges, discard handling, and human verification (DONE 2026-03-17)

---

### Phase 3: Content Extraction + Image Generation

**Goal:** Support multiple content source types and AI-generated visual content with brand consistency.

**Requirements:** GEN-01, GEN-02, IMG-01, IMG-02, IMG-03, IMG-04, IMG-05

**Success Criteria:**
1. YouTube transcripts, articles, and PDFs extract clean text
2. AI generates images with brand style directive and logo watermark
3. Images stored in R2 with thumbnails, viewable in media library
4. User can regenerate images or override prompts

**Estimated effort:** 2 days

**Plans:** 4/4 plans complete

Plans:
- [x] 03-01-PLAN.md — Content extraction: install youtube-transcript/readability/pdf-parse, create extract.ts module, integrate into generate action, add PDF upload + URL extract to generate UI (DONE 2026-03-17)
- [x] 03-02-PLAN.md — Image generation backend: install OpenAI SDK, generatedImages DB table + migration, image-gen.ts pipeline (gpt-image-1 + watermark + thumbnail + R2), server actions (DONE 2026-03-17)
- [x] 03-03-PLAN.md — Image generation UI + media library: image generation section on generate page, media library page with grid/detail/regenerate, brand detail Media Library link (DONE 2026-03-17)
- [x] 03-04-PLAN.md — Gap closure: add filter/sort controls to media library (date range, type dropdown, sort order) (DONE 2026-03-17)

---

### Phase 4: Carousel Generation

**Goal:** Generate high-engagement carousel content using Satori templates with brand visual consistency.

**Requirements:** CARO-01, CARO-02, CARO-03, CARO-04, CARO-05

**Success Criteria:**
1. 3-5 carousel templates render with brand colors, fonts, logo
2. First slide is hook-optimized, last slide has CTA + brand handle
3. User can preview, pick template, and edit individual slides

**Estimated effort:** 2 days

**Plans:** 2/2 plans complete

Plans:
- [ ] 04-01-PLAN.md — Database schema + fonts + 3 Satori carousel templates + render pipeline (carousel-gen.ts)
- [ ] 04-02-PLAN.md — AI slide content generation, carousel page UI with template picker + slide editor + render, brand detail Carousels link, human verification

---

### Phase 5: Calendar + Scheduling

**Goal:** Content calendar visualization and automated publishing with smart scheduling.

**Requirements:** SCHED-01, SCHED-02, SCHED-03, SCHED-04, SCHED-05, SCHED-06, SCHED-07

**Success Criteria:**
1. Week/month calendar view with platform color coding and content type icons
2. Drag-and-drop rescheduling updates scheduled_at
3. Auto-publish cron runs every minute, publishes due posts via Upload-Post
4. Retry logic: 3 attempts with 5 min backoff, then status=failed

**Estimated effort:** 1.5 days

**Plans:** 2/3 plans executed

Plans:
- [ ] 05-01-PLAN.md — Schema migration (scheduling_slots + retryAt), publish module, auto-publish cron, schedule server actions
- [ ] 05-02-PLAN.md — FullCalendar UI (month/week views, drag-and-drop, platform colors, status indicators), slot configuration panel
- [ ] 05-03-PLAN.md — Human verification of all SCHED requirements end-to-end

---

### Phase 6: Content Automation Pipeline

**Goal:** Full autonomous content pipeline — RSS feeds to published posts with spam prevention.

**Requirements:** FEED-01, FEED-02, FEED-03, FEED-04, FEED-05, FEED-06, FEED-07, FEED-08, FEED-09, FEED-10, SPAM-01, SPAM-02, SPAM-03, SPAM-04, SPAM-05, SPAM-06, SPAM-07

**Success Criteria:**
1. Add RSS feed → entries polled → Haiku filters by relevance → relevant entries extracted
2. Auto-generate runs with full quality pipeline, respects content mix
3. Automation levels work: semi (drafts), mostly (auto above threshold), full
4. Spam prevention enforced: rate limits, jitter, warmup, staggered cross-platform
5. Feed auto-disables after 10 consecutive failures

**Estimated effort:** 3 days

**Plans:** 3/4 plans executed

Plans:
- [ ] 06-01-PLAN.md — Schema migration + spam guard module + feed polling with Haiku relevance scoring
- [ ] 06-02-PLAN.md — Auto-generate pipeline with automation level routing + cron wiring
- [ ] 06-03-PLAN.md — Feed management UI + automation level config
- [ ] 06-04-PLAN.md — Human verification of full automation pipeline

---

### Phase 7: Analytics Collection + Dashboard + Polish

**Goal:** Collect engagement metrics and build the dashboard for monitoring the engine.

**Requirements:** ANLY-01, ANLY-02, ANLY-03, ANLY-04, DASH-01, DASH-02, DASH-03, DASH-05

**Success Criteria:**
1. Collect-analytics cron fetches metrics for posts 48h+ old, calculates engagement scores
2. Posts classified as top/average/underperformer per brand per platform
3. Cross-brand home, brand home, and activity log pages render with real data
4. Weekly digest data shows on dashboard home

**Estimated effort:** 2 days

**Plans:** 1/3 plans executed

Plans:
- [ ] 07-01-PLAN.md — Analytics backend: postAnalytics schema + collect-analytics cron + engagement scoring + tier classification
- [ ] 07-02-PLAN.md — Dashboard pages: cross-brand home + weekly digest, activity log, brand detail stats, per-brand analytics
- [ ] 07-03-PLAN.md — Human verification of analytics and dashboard end-to-end

---

## Dependency Graph

```
Phase 0 (Validation) → Phase 1 (Foundation)
                            ↓
                    Phase 2A (AI Generation)
                            ↓
                    Phase 2B (Quality Pipeline)
                            ↓
              ┌─────────────┼─────────────┐
              ↓             ↓             ↓
        Phase 3         Phase 4       Phase 5
        (Extraction     (Carousels)   (Calendar +
         + Images)                    Scheduling)
              └─────────────┼─────────────┘
                            ↓
                    Phase 6 (Automation Pipeline)
                            ↓
                    Phase 7 (Analytics + Dashboard)
```

## M1 Timeline: ~16.5 days

| Phase | Days | Cumulative |
|-------|------|------------|
| 0 | 0.5 | 0.5 |
| 1 | 2 | 2.5 |
| 2A | 2 | 4.5 |
| 2B | 1.5 | 6 |
| 3 | 2 | 8 |
| 4 | 2 | 10 |
| 5 | 1.5 | 11.5 |
| 6 | 3 | 14.5 |
| 7 | 2 | 16.5 |

## M1 Definition of Done

Create a brand, connect accounts, add RSS feeds, and the system autonomously discovers → filters → generates → refines → quality-checks → schedules → publishes content. Dashboard shows activity. Engagement data is being collected for M2.

---
*Roadmap created: 2026-03-15*
*Last updated: 2026-03-18 after Phase 7 plans created*
