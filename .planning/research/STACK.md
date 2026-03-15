# Stack Research

**Domain:** AI-powered social media content automation (personal tool)
**Researched:** 2026-03-15
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x (App Router) | Full-stack framework | SSR + API routes + `instrumentation.ts` for cron startup. Railway-friendly. Single deploy. |
| TypeScript | 5.x | Type safety | Drizzle-orm requires it. Catches AI response parsing errors early. |
| SQLite | 3.x via better-sqlite3 | Database | Single user = single file DB. WAL mode for concurrent read/write. Trivial backup (copy file). |
| drizzle-orm | 0.36.x | ORM + migrations | Type-safe queries, `drizzle-kit` for schema migrations and studio, lightweight vs Prisma. |
| node-cron | 3.x | Scheduled jobs | In-process cron. No separate service. Works with `instrumentation.ts` singleton pattern. |
| Tailwind CSS | 4.x | Styling | CSS-first config, automatic content detection, smaller builds. Latest for 2026 greenfield. |
| shadcn/ui | v4 | UI components | Copy-paste components (not a dependency), Tailwind v4 native, great for dashboards. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @anthropic-ai/sdk | latest | Claude API | All AI tasks: generation, filtering, analysis, quality gate |
| openai | latest | GPT Image generation | AI image creation for posts |
| satori | latest | SVG from JSX | Carousel slide rendering (no browser needed) |
| sharp | latest | Image processing | PNG from SVG, thumbnails, watermark overlay |
| rss-parser | latest | RSS feed parsing | All feed types: RSS, YouTube channels, subreddits, Google News |
| youtube-transcript | latest | YouTube captions | Extract video transcripts for repurposing |
| @extractus/article-extractor | latest | Article extraction | Clean text from web articles |
| pdf-parse | latest | PDF extraction | Text from uploaded PDFs |
| @aws-sdk/client-s3 | latest | Cloudflare R2 storage | S3-compatible API for image/carousel storage |
| date-fns-tz | latest | Timezone handling | Scheduling posts in user's timezone |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| drizzle-kit | Schema migrations + DB browser | `npx drizzle-kit generate`, `migrate`, `studio` |
| Railway CLI | Deploy, volumes, logs | `railway up`, `railway logs`, volume mount for SQLite |
| wrangler | Cloudflare R2 management | `wrangler r2 object put`, bucket operations |

## Installation

```bash
# Core
npm install next@latest react@latest react-dom@latest better-sqlite3 drizzle-orm node-cron

# AI & Content
npm install @anthropic-ai/sdk openai satori sharp rss-parser youtube-transcript @extractus/article-extractor pdf-parse

# Storage & Utils
npm install @aws-sdk/client-s3 date-fns-tz

# Dev dependencies
npm install -D typescript @types/node @types/better-sqlite3 @types/node-cron drizzle-kit tailwindcss @tailwindcss/postcss postcss
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| SQLite + better-sqlite3 | PostgreSQL | If you need multi-user, RLS, or hosted DB (Neon/Supabase) |
| drizzle-orm | Prisma | If you prefer schema-first approach; heavier runtime, slower cold starts |
| node-cron | BullMQ + Redis | If you need job persistence across restarts, distributed workers |
| Upload-Post | Direct platform APIs | If you need real-time features or Upload-Post doesn't support a platform |
| Satori + sharp | Puppeteer/Playwright | If you need full HTML/CSS rendering; much heavier, needs headless browser |
| Cloudflare R2 | AWS S3 | If you're already in AWS ecosystem; R2 has free egress |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma | Heavy runtime, slow cold starts, overkill for SQLite single-user | drizzle-orm |
| pg_cron | Requires PostgreSQL, separate service | node-cron (in-process) |
| Vercel | Serverless = no persistent cron, no volume mount for SQLite | Railway |
| Canvas/Puppeteer for carousels | Requires headless browser, heavy dependency | Satori + sharp |
| direct platform APIs | Each platform is different, auth complexity, IP concerns | Upload-Post |

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 15 | React 19 | App Router is default and stable |
| Tailwind v4 | shadcn/ui v4 | shadcn v4 built specifically for Tailwind v4 |
| better-sqlite3 | drizzle-orm 0.36+ | Use `drizzle-orm/better-sqlite3` driver |
| satori | sharp | Satori outputs SVG, sharp converts to PNG/WebP |

## Sources

- Next.js 15 official docs — App Router, instrumentation.ts
- drizzle-orm docs — SQLite driver, migration API
- shadcn/ui v4 — Tailwind v4 compatibility confirmed
- Railway docs — volume mounts, always-on containers
- Cloudflare R2 docs — S3 compatibility, free tier limits

---
*Stack research for: AI-powered social media content automation*
*Researched: 2026-03-15*
