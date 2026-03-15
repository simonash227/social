# Architecture Research

**Domain:** AI-powered social media content automation (personal tool)
**Researched:** 2026-03-15
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │Dashboard │  │ Calendar │  │ Create   │  │ Analytics│    │
│  │  Pages   │  │  Views   │  │  Flow    │  │  Charts  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
├───────┴──────────────┴──────────────┴──────────────┴─────────┤
│                      API LAYER (Next.js)                      │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Server Actions + API Routes + Server Components      │    │
│  └───────────────────────┬──────────────────────────────┘    │
├──────────────────────────┼───────────────────────────────────┤
│                   SERVICE LAYER                               │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────────┐   │
│  │   AI    │  │ Quality │  │Ingestion│  │  Publishing  │   │
│  │ Engine  │  │Pipeline │  │ Engine  │  │  (Upload-Post)│   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬───────┘   │
├───────┴─────────────┴───────────┴───────────────┴────────────┤
│                   AUTOMATION LAYER                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐    │
│  │  node-cron  │  │  Scheduler   │  │  Circuit Breaker │    │
│  │  (5 jobs)   │  │  (slot-based)│  │  + Spend Tracker │    │
│  └─────────────┘  └──────────────┘  └──────────────────┘    │
├──────────────────────────────────────────────────────────────┤
│                    DATA LAYER                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │  SQLite  │  │ R2 Blob  │  │ External │                   │
│  │  (WAL)   │  │ Storage  │  │  APIs    │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└──────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Dashboard Pages | UI for brand management, overview, activity log | Next.js App Router pages + server components |
| Calendar Views | Content scheduling visualization, drag-and-drop | Client component with server actions |
| Create Flow | Post creation: source → generate → preview → edit → publish | Multi-step form with AI generation |
| AI Engine | Brand-aware content generation, hook optimization | Claude API with prompt caching, model routing |
| Quality Pipeline | Self-refine, quality gate, multi-variant (M2) | Sonnet critique + Opus rewrite chain |
| Ingestion Engine | YouTube/article/PDF/RSS extraction | Library-specific parsers |
| Publishing | Send posts to platforms, handle retries | Upload-Post API client wrapper |
| node-cron jobs | poll-feeds, auto-generate, auto-publish, collect-analytics, backup-db | In-process cron with mutex guards |
| Scheduler | Slot-based timing, jitter, volume limits, warmup | Code-enforced rules in auto-publish job |
| SQLite | All relational data (brands, posts, feeds, metrics, learnings) | better-sqlite3 + drizzle-orm, WAL mode |
| R2 Storage | Generated images, carousel slides, DB backups | @aws-sdk/client-s3, S3-compatible API |

## Recommended Project Structure

```
social/
├── src/
│   ├── app/
│   │   ├── login/page.tsx                  # Simple auth
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                  # Shell: sidebar, brand switcher
│   │   │   ├── page.tsx                    # Home: cross-brand overview
│   │   │   ├── brands/page.tsx             # Brand list
│   │   │   ├── [brandId]/
│   │   │   │   ├── layout.tsx              # Brand sub-nav
│   │   │   │   ├── page.tsx                # Brand home: stats, recent posts
│   │   │   │   ├── profile/page.tsx        # Brand voice/goals editor
│   │   │   │   ├── accounts/page.tsx       # Connected social accounts
│   │   │   │   ├── create/page.tsx         # Create post flow
│   │   │   │   ├── activity/page.tsx       # Activity log
│   │   │   │   ├── feeds/page.tsx          # RSS feed management
│   │   │   │   ├── calendar/page.tsx       # Content calendar
│   │   │   │   ├── analytics/page.tsx      # Performance metrics
│   │   │   │   ├── media/page.tsx          # Generated images library
│   │   │   │   ├── pipeline/page.tsx       # Bulk pipeline (M2)
│   │   │   │   └── settings/page.tsx       # Automation settings
│   │   │   └── insights/page.tsx           # Cross-brand AI insights (M2)
│   │   └── api/
│   │       ├── webhooks/upload-post/route.ts
│   │       └── generate/image/route.ts
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts                    # SQLite connection + pragmas
│   │   │   └── schema.ts                   # Drizzle schema definitions
│   │   ├── auth/
│   │   │   └── index.ts                    # Password + session cookie
│   │   ├── cron/
│   │   │   ├── index.ts                    # Register all jobs
│   │   │   ├── poll-feeds.ts
│   │   │   ├── auto-generate.ts
│   │   │   ├── auto-publish.ts
│   │   │   ├── collect-analytics.ts
│   │   │   ├── analyze-performance.ts      # M2
│   │   │   ├── backup-db.ts
│   │   │   ├── prompt-evolution.ts         # M2
│   │   │   └── mutex.ts                    # isRunning guard
│   │   ├── upload-post/
│   │   │   ├── client.ts
│   │   │   ├── publish.ts
│   │   │   ├── analytics.ts
│   │   │   └── types.ts
│   │   ├── ai/
│   │   │   ├── generate.ts                 # Brand-aware generation
│   │   │   ├── strategist.ts               # Weekly content planning (M2)
│   │   │   ├── analyzer.ts                 # Performance analysis (M2)
│   │   │   └── prompts/                    # Per-platform templates
│   │   ├── quality/
│   │   │   ├── refine.ts                   # Self-refine loop
│   │   │   ├── gate.ts                     # Quality gate scoring
│   │   │   ├── multivariant.ts             # Multi-variant (M2)
│   │   │   └── types.ts
│   │   ├── storage/
│   │   │   └── r2.ts                       # Cloudflare R2 client
│   │   ├── images/
│   │   │   └── openai.ts                   # GPT Image generation
│   │   ├── ingestion/
│   │   │   ├── youtube.ts
│   │   │   ├── article.ts
│   │   │   └── pdf.ts
│   │   └── carousel/
│   │       ├── renderer.ts
│   │       └── templates/
│   └── components/
│       ├── dashboard/
│       ├── pipeline/
│       ├── calendar/
│       ├── brand/
│       ├── carousel/
│       └── ui/                             # shadcn components
├── CLAUDE.md                               # AI agent context
├── instrumentation.ts                      # Next.js startup hook → cron init
├── data/
│   └── social.db                           # SQLite DB (Railway volume)
├── drizzle.config.ts
├── package.json
└── .env.local
```

### Structure Rationale

- **`src/app/`**: Next.js App Router — pages are routes, layouts provide shells
- **`src/lib/`**: Business logic, organized by domain (ai, cron, db, etc.)
- **`src/components/`**: React components, organized by feature area
- **`instrumentation.ts`**: Next.js hook — runs once at startup, initializes cron singleton

## Architectural Patterns

### Pattern 1: Singleton Cron via instrumentation.ts

**What:** Next.js `instrumentation.ts` runs once at server start. Use it to initialize all cron jobs.
**When to use:** Always — prevents duplicate cron instances on hot reload.
**Trade-offs:** Couples cron lifecycle to Next.js. Stops when server stops.

### Pattern 2: Mutex Guard per Cron Job

**What:** Each cron job checks `let isRunning = false` before executing. Prevents overlapping runs.
**When to use:** All cron jobs — especially important for jobs that call external APIs.
**Trade-offs:** Simple but not persistent. If process crashes mid-job, mutex resets on restart.

### Pattern 3: Circuit Breaker for External Services

**What:** Track consecutive failures per service. After N failures, pause and log alert.
**When to use:** Upload-Post API, Claude API, OpenAI API — any external dependency.
**Trade-offs:** Prevents cascading failures but may delay recovery if service comes back.

### Pattern 4: State Recovery on Startup

**What:** On startup, reset any `status = 'publishing'` posts older than 30 min back to `scheduled`.
**When to use:** Always — Railway redeploys kill running processes.
**Trade-offs:** Posts may publish twice if recovery happens within publish window. Upload-Post deduplication helps.

## Data Flow

### Content Pipeline Flow

```
RSS Feed / Manual Input
    ↓
[poll-feeds cron] → Fetch RSS → Dedup by URL
    ↓
[Haiku filter] → Relevance score (1-10) → Skip if < threshold
    ↓
[Ingestion] → Extract text (youtube-transcript / article-extractor / pdf-parse)
    ↓
[auto-generate cron] → Check content mix, decide content type
    ↓
[AI Engine] → Title optimization → Generate (Opus) → Self-refine → Quality gate
    ↓
[Scheduler] → Find next slot with jitter → Set scheduled_at
    ↓
[auto-publish cron] → Upload-Post API → Published ✓
    ↓
[collect-analytics cron] → Fetch metrics → Calculate engagement score
    ↓
[analyze-performance cron] → Weekly insights → Update learnings (M2)
```

### Request Flow (Dashboard)

```
Browser → Next.js Server Component → drizzle-orm → SQLite
Browser → Server Action → Service Layer → External API → Response
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1 user, 3-5 brands | Current architecture — no changes needed |
| 1 user, 15+ brands | Upgrade Upload-Post to Pro ($33/mo), consider staggering cron job batches |
| Multi-user (future) | Add proper auth (NextAuth), RLS or tenant isolation, consider PostgreSQL |

### Scaling Priorities

1. **First bottleneck:** AI API costs — mitigated by configurable models, spend limits, conditional self-refine
2. **Second bottleneck:** Cron job duration — mitigated by batch limits (max 10 feeds per poll run)

## Anti-Patterns

### Anti-Pattern 1: Storing SQLite on Ephemeral Filesystem

**What people do:** Deploy to Railway without volume mount
**Why it's wrong:** Railway's filesystem resets on every deploy — all data lost
**Do this instead:** Mount a Railway volume at `/data/`, set `DATABASE_PATH=/data/social.db`

### Anti-Pattern 2: Running Cron Without Mutex

**What people do:** Start cron jobs without `isRunning` guard
**Why it's wrong:** Long-running jobs overlap, duplicate API calls, race conditions
**Do this instead:** `let isRunning = false` guard at top of every cron handler

### Anti-Pattern 3: Trusting AI Output Without Quality Gate

**What people do:** Publish AI-generated content directly
**Why it's wrong:** ~10-15% of outputs are below standard, damages brand voice
**Do this instead:** Quality gate scores every post, reject/improve/pass

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Claude (Anthropic) | SDK client, prompt caching, model routing | System prompt caching saves ~90% on repeated context |
| OpenAI | SDK client for GPT Image | Images only, not text generation |
| Upload-Post | REST API client, webhook for status | Publishes from their servers, analytics endpoint |
| Cloudflare R2 | S3-compatible SDK | Free first 10GB, use for images + DB backups |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Cron ↔ Services | Direct function calls | Same process, no IPC needed |
| Pages ↔ DB | drizzle-orm queries via server components/actions | No REST API layer needed |
| AI ↔ Quality | Function pipeline (generate → refine → gate) | Each step returns typed result |

---
*Architecture research for: AI-powered social media content automation*
*Researched: 2026-03-15*
