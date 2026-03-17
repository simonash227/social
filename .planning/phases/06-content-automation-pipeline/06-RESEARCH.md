# Phase 6: Content Automation Pipeline - Research

**Researched:** 2026-03-18
**Domain:** RSS feed polling, relevance filtering, automation level routing, spam prevention
**Confidence:** HIGH

## Summary

Phase 6 closes the autonomous loop: RSS/YouTube/Reddit/Google News feeds are polled on a cron, each entry scored by Claude Haiku for brand relevance, relevant entries flow through the existing quality pipeline, and spam-prevention guards control how fast posts accumulate per platform. The project already has the DB schema stubs (`feedSources`, `feedEntries`), the `sanitize` utility, the full quality pipeline (`generateContent` + `refineAndGate`), the scheduling machinery (`scheduleToNextSlot`, `publishDuePosts`), and the `node-cron` + circuit breaker infrastructure. Phase 6 is almost entirely about wiring these together with new cron jobs, new DB columns, a feed management UI, and enforcement of rate/spam rules.

The dominant new library needed is `rss-parser` — a lightweight, TypeScript-native RSS/Atom parser that handles all four required feed types (RSS, YouTube channel RSS, Reddit subreddit RSS, Google News RSS) through a single `parseURL()` call. No other major new dependencies are needed.

**Primary recommendation:** Install `rss-parser`, add four new DB migration columns (feed_sources: `failureCount`, `status`, `automationLevel`; brands: `automationLevel`), then implement three layers: (1) `pollFeeds()` cron lib module, (2) `autoGenerate()` cron lib module, (3) `spamGuard()` DB query helper. Connect all three in `cron.ts`. Build a minimal feeds UI inside the brand detail page.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FEED-01 | User can add RSS feed sources (RSS, YouTube channels, subreddits, Google News) | rss-parser handles all four URL formats; feedSources table exists — needs add/delete UI |
| FEED-02 | Per-feed config: poll interval, relevance threshold, target platforms, content types | feedSources columns already exist in schema; needs edit form |
| FEED-03 | Poll-feeds cron (every 5 min) fetches RSS, deduplicates by URL | rss-parser parseURL(); feedEntries.url has UNIQUE index already |
| FEED-04 | Haiku relevance filter scores each entry 1-10 against brand topics/goals | Existing ai.ts filter model + pattern from generate.ts critique calls |
| FEED-05 | Entries scoring >= threshold are extracted and queued for generation | feedEntries.relevanceScore column; existing extractFromUrl() in extract.ts |
| FEED-06 | Auto-generate cron (every 15 min) generates posts through full quality pipeline | Calls existing generateContent() + refineAndGate() from generate.ts |
| FEED-07 | Content mix management: avoid repeating same topic within 48 hours | Query posts by brandId + createdAt; Haiku topic similarity check or keyword dedup |
| FEED-08 | User can configure automation level per brand: manual, semi, mostly, full auto | New brands column automationLevel; feed management UI |
| FEED-09 | Confidence scoring determines auto-publish vs queue for review | Use qualityScore from refineAndGate result: >= threshold = schedule, else draft |
| FEED-10 | Feed auto-disables after 10 consecutive failures | New feedSources column consecutiveFailures + enabled; increment in catch block |
| SPAM-01 | Per-platform daily post caps (X: 3-5, Instagram: 1-3, LinkedIn: 1-2, TikTok: 1-3) | Count posts.publishedAt for today per platform per brand |
| SPAM-02 | Minimum 1 hour gap between posts on same platform | Query MAX(publishedAt OR scheduledAt) per platform per brand |
| SPAM-03 | Cross-platform staggering: same source content spaced 30-60 min apart | When auto-scheduling, offset scheduledAt by 30-60 min per platform |
| SPAM-04 | New account warmup: Week 1=1/day, Week 2=2/day, Week 3+=normal | brands.warmupDate already exists; compute weeks since warmupDate |
| SPAM-05 | Topic deduplication within configurable window (default 48 hours) | Query recent sourceUrl/sourceText fingerprints; Haiku similarity or URL exact match |
| SPAM-06 | Max 30-40% of posts contain links | Count posts with URLs in last N; enforce at auto-generate time |
| SPAM-07 | Platform-appropriate hashtag counts (X: 0-3, Instagram: 5-15, LinkedIn: 3-5) | Inject constraint into generation prompt; already partially in PLATFORM_CONSTRAINTS |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| rss-parser | ^3.13.0 | Parse RSS/Atom/YouTube/Reddit/Google News feeds | Lightweight, TypeScript-native, handles malformed real-world feeds, 2M+ weekly downloads |
| node-cron | ^3.0.3 | Schedule poll-feeds (5 min) and auto-generate (15 min) crons | Already in project; same pattern as publish cron |
| @anthropic-ai/sdk | ^0.79.0 | Haiku relevance scoring | Already in project; filter model defined in ai.ts |
| better-sqlite3 | ^12.8.0 | DB queries for spam guard, feed status | Already in project |
| drizzle-orm | ^0.45.1 | Schema migrations + typed queries | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (no new deps needed) | — | extract.ts already handles URL content extraction | Called for relevant feed entries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rss-parser | fast-xml-parser (manual RSS) | rss-parser handles Atom + malformed feeds out of the box; fast-xml-parser requires more glue code |
| rss-parser | feedparser (streaming) | feedparser requires streams API; rss-parser promises API matches project style |
| rss-parser | @rowanmanning/feed-parser | Both are good; rss-parser has higher adoption and existing TypeScript types |

**Installation:**
```bash
npm install rss-parser
npm install --save-dev @types/rss-parser
```

Note: `rss-parser` ships its own TypeScript types in v3.x — no separate `@types` package needed.

## Architecture Patterns

### Recommended Project Structure

New files for Phase 6:
```
src/lib/
├── feed-poll.ts          # pollFeeds(): fetch RSS, deduplicate, score relevance, queue entries
├── auto-generate.ts      # autoGenerate(): consume queued entries, run quality pipeline, spam-guard, schedule
├── spam-guard.ts         # spamGuard(): enforce per-platform caps, gap, warmup, topic dedup
src/app/actions/
├── feeds.ts              # Server actions: addFeed, deleteFeed, updateFeedConfig, getBrandFeeds
src/app/(dashboard)/brands/[id]/
├── feeds/
│   └── page.tsx          # Feed management UI: list feeds, add form, status indicators
```

Schema migration (new file `0006_feed_automation.sql`):
```sql
ALTER TABLE feed_sources ADD COLUMN consecutive_failures INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE feed_sources ADD COLUMN enabled INTEGER DEFAULT 1 NOT NULL;  -- 0=disabled, 1=enabled
ALTER TABLE brands ADD COLUMN automation_level TEXT DEFAULT 'manual';
ALTER TABLE posts ADD COLUMN feed_entry_id INTEGER REFERENCES feed_entries(id);
```

### Pattern 1: Feed Polling Cron (every 5 min)

**What:** `pollFeeds()` iterates all enabled feed sources, fetches RSS via `rss-parser`, deduplicates by URL (UNIQUE constraint in `feedEntries`), runs Haiku relevance filter on each new entry.

**When to use:** Called from `cron.ts` every 5 minutes, guarded by `globalThis.__feedPollRunning` mutex.

**Example:**
```typescript
// Source: rss-parser README + project pattern from publish.ts mutex
import Parser from 'rss-parser'

const parser = new Parser({ timeout: 10000 })  // 10s timeout per feed

export async function pollFeeds(): Promise<void> {
  const g = globalThis as Record<string, unknown>
  if (g.__feedPollRunning) return
  g.__feedPollRunning = true
  try {
    const db = getDb()
    const feeds = db.select().from(feedSources)
      .where(eq(feedSources.enabled, 1))
      .all()

    for (const feed of feeds) {
      await pollSingleFeed(feed)
    }
  } finally {
    g.__feedPollRunning = false
  }
}

async function pollSingleFeed(feed: FeedSource): Promise<void> {
  try {
    const parsed = await parser.parseURL(feed.url)
    for (const item of parsed.items) {
      const url = item.link ?? item.guid
      if (!url) continue
      // Insert-or-ignore via unique constraint
      try {
        db.insert(feedEntries).values({
          feedSourceId: feed.id,
          url,
          title: sanitizeText(item.title ?? ''),
          createdAt: new Date().toISOString(),
        }).run()
        // Score relevance for new entry
        await scoreRelevance(feed, url, item.title ?? '')
      } catch {
        // UNIQUE constraint violation = already seen, skip
      }
    }
    // Reset failure count on success
    db.update(feedSources)
      .set({ consecutiveFailures: 0 })
      .where(eq(feedSources.id, feed.id))
      .run()
  } catch (err) {
    const newCount = feed.consecutiveFailures + 1
    db.update(feedSources)
      .set({
        consecutiveFailures: newCount,
        enabled: newCount >= 10 ? 0 : 1,
      })
      .where(eq(feedSources.id, feed.id))
      .run()
    // Log to activityLog
  }
}
```

### Pattern 2: Haiku Relevance Scoring

**What:** For each new feed entry, call Claude Haiku with brand topics/goals and entry title+URL to get a 1-10 relevance score. Store in `feedEntries.relevanceScore`.

**When to use:** Immediately after inserting a new `feedEntries` row.

**Example:**
```typescript
// Source: pattern from generate.ts runCritique()
async function scoreRelevance(feed: FeedSource, url: string, title: string): Promise<void> {
  const db = getDb()
  const brand = db.select().from(brands).where(eq(brands.id, feed.brandId)).get()
  if (!brand) return

  const underLimit = await checkAiSpend()
  if (!underLimit) return

  const modelConfig = getModelConfig()
  const prompt = [
    `Brand topics: ${(brand.topics ?? []).join(', ')}`,
    `Brand goals: ${brand.goals ?? 'general content'}`,
    `Feed entry title: "${title}"`,
    `Feed entry URL: ${url}`,
    '',
    'Score the relevance of this feed entry to the brand on a scale of 1-10.',
    'Return ONLY valid JSON: { "score": 7, "reason": "brief reason" }',
  ].join('\n')

  const response = await getBreaker('anthropic').call(() =>
    anthropic.messages.create({
      model: modelConfig.filter,
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })
  )
  // parse score, update feedEntries row
}
```

### Pattern 3: Auto-Generate Cron (every 15 min)

**What:** `autoGenerate()` picks up `feedEntries` where `relevanceScore >= threshold` and `processedAt IS NULL`, runs spam guard checks, calls existing `generateContent()` + `refineAndGate()`, then either saves as draft or schedules based on automation level.

**When to use:** Called from `cron.ts` every 15 minutes, guarded by `globalThis.__autoGenerateRunning` mutex.

**Automation level routing:**
```
manual    → skip (user triggers manually)
semi      → always save as draft (qualityScore stored, user reviews)
mostly    → schedule if qualityScore >= 7, else draft
full      → always schedule (above spam limits), discard if score < 5
```

### Pattern 4: Spam Guard

**What:** `checkSpamGuard(brandId, platform)` returns `{ allowed: boolean, reason?: string }`. Called before every auto-schedule decision.

**When to use:** Inside `autoGenerate()` before scheduling any post.

**Example:**
```typescript
// Source: custom pattern using existing DB schema
export async function checkSpamGuard(
  brandId: number,
  platform: string,
  sourceUrl?: string
): Promise<{ allowed: boolean; reason?: string }> {
  const db = getDb()
  const today = new Date().toISOString().slice(0, 10)
  const brand = db.select().from(brands).where(eq(brands.id, brandId)).get()
  if (!brand) return { allowed: false, reason: 'brand not found' }

  // 1. Warmup cap
  if (brand.warmupDate) {
    const warmupWeeks = Math.floor(
      (Date.now() - new Date(brand.warmupDate).getTime()) / (7 * 24 * 3600 * 1000)
    )
    const warmupCap = warmupWeeks === 0 ? 1 : warmupWeeks === 1 ? 2 : null
    if (warmupCap !== null) {
      const todayCount = countTodayPosts(db, brandId, platform, today)
      if (todayCount >= warmupCap) return { allowed: false, reason: `warmup cap ${warmupCap}/day` }
    }
  }

  // 2. Daily platform cap
  const DAILY_CAPS: Record<string, number> = {
    twitter: 5, x: 5, instagram: 3, linkedin: 2, tiktok: 3,
  }
  const cap = DAILY_CAPS[platform.toLowerCase()] ?? 5
  const todayCount = countTodayPosts(db, brandId, platform, today)
  if (todayCount >= cap) return { allowed: false, reason: `daily cap ${cap} reached` }

  // 3. Minimum 1-hour gap
  const lastPost = getLastPostTime(db, brandId, platform)
  if (lastPost && Date.now() - new Date(lastPost).getTime() < 3600_000) {
    return { allowed: false, reason: '1-hour minimum gap not met' }
  }

  // 4. Topic dedup (48-hour window)
  if (sourceUrl && wasRecentlyPosted(db, brandId, sourceUrl, 48)) {
    return { allowed: false, reason: 'same source within 48 hours' }
  }

  return { allowed: true }
}
```

### Pattern 5: Feed URL Formats

All four feed types parse through `rss-parser.parseURL()` with no special handling needed:

| Feed Type | URL Format | Example |
|-----------|-----------|---------|
| Standard RSS | Direct feed URL | `https://example.com/feed.xml` |
| YouTube channel | `https://www.youtube.com/feeds/videos.xml?channel_id=UC...` | Channel ID starts with `UC` |
| Reddit subreddit | `https://www.reddit.com/r/SUBREDDIT/.rss` | Append `.rss` to subreddit URL |
| Google News | `https://news.google.com/rss/search?q=TOPIC&hl=en-US&gl=US&ceid=US:en` | Search query encoded |

### Anti-Patterns to Avoid

- **Storing full article text in feedEntries:** Don't store extracted content at polling time — it wastes storage and many entries will be filtered out. Extract content only when `relevanceScore >= threshold` and the entry is queued for generation.
- **Running Haiku on every poll tick:** Rate-limit Haiku calls. Only score entries that haven't been seen before (null `relevanceScore`). On re-poll, skip already-scored entries.
- **Blocking the poll cron on slow feeds:** Use `Promise.allSettled()` or sequential iteration with per-feed timeout. One unresponsive feed must not block others.
- **Auto-disabling feed on network errors vs parse errors:** Network errors (timeout, 5xx) should increment `consecutiveFailures`. Parse errors on a valid response may indicate a feed format change — log as warn but also increment (10 consecutive means something is broken).
- **Missing `serverExternalPackages` for rss-parser:** `rss-parser` makes HTTP requests and uses Node.js `http`/`https` modules. If it causes bundling issues in Next.js standalone, add to `serverExternalPackages` in `next.config.ts`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RSS/Atom/YouTube feed parsing | Custom XML parser | rss-parser | Handles malformed feeds, Atom, MediaRSS, YouTube quirks |
| Feed URL deduplication | Custom hash table | SQL UNIQUE constraint on `feedEntries.url` (already exists) | Database handles concurrent inserts safely |
| Cron scheduling | Custom interval timers | node-cron (already in project) | Handles timezone, missed ticks, singleton guard already established |
| Content extraction from feed URLs | Custom HTTP scraper | extract.ts `extractFromUrl()` (already in project) | Handles YouTube transcripts, articles, PDFs |
| Quality pipeline | Re-implement | generateContent() + refineAndGate() (already in project) | Phase 2A/2B built and verified |

**Key insight:** Phase 6 is integration work, not new infrastructure. The quality pipeline, scheduling, cron, circuit breaker, AI spend tracking, and content extraction all exist. The main new code is the orchestration layer that connects feed sources to the existing pipeline.

## Common Pitfalls

### Pitfall 1: N+1 AI Calls on Large Feeds
**What goes wrong:** A feed with 50 new items triggers 50 sequential Haiku calls, taking several minutes and burning API budget.
**Why it happens:** Naive implementation calls Haiku once per entry.
**How to avoid:** Batch entry titles into a single Haiku call scoring multiple items at once. The Haiku response can return an array of `{ url, score, reason }` objects. Limit to processing max 20 new items per feed per poll cycle.
**Warning signs:** `checkAiSpend()` returns false shortly after feed polling starts.

### Pitfall 2: `rss-parser` Bundling Issue in Next.js Standalone
**What goes wrong:** Build fails or runtime errors when `rss-parser` is bundled by Next.js in standalone mode.
**Why it happens:** rss-parser uses Node.js `http`/`https` modules which can't be bundled.
**How to avoid:** Add `'rss-parser'` to `serverExternalPackages` in `next.config.ts`. The project already has `['better-sqlite3', 'node-cron', 'pdf-parse', 'openai']` — just add `'rss-parser'` to that array.
**Warning signs:** `TypeError: Cannot read properties of undefined reading 'get'` at runtime.

### Pitfall 3: Schema Missing Columns Needed for Feed Automation
**What goes wrong:** `feedSources` lacks `consecutiveFailures` and `enabled` columns; `brands` lacks `automationLevel`; `posts` lacks `feedEntryId` for traceability.
**Why it happens:** The initial schema stub (migration 0000) created the table but not these operational columns.
**How to avoid:** Migration `0006_feed_automation.sql` must add these columns before implementing poll/generate logic.
**Warning signs:** Drizzle type errors when accessing `feed.consecutiveFailures`.

### Pitfall 4: Auto-Generate Running While Quality Pipeline Takes 30+ Seconds
**What goes wrong:** Two cron ticks of auto-generate overlap; the same feed entry gets processed twice, creating duplicate posts.
**Why it happens:** Quality pipeline (generate + refine + gate) takes 15-60 seconds per batch. 15-minute cron can overlap if previous run is still active.
**How to avoid:** Use `globalThis.__autoGenerateRunning` mutex (same pattern as `publishDuePosts`). Also mark `feedEntries.processedAt` at the START of processing (not end) to prevent double-pick in a race.
**Warning signs:** Duplicate posts appearing in the calendar.

### Pitfall 5: Spam Guard Not Accounting for Scheduled (Not Yet Published) Posts
**What goes wrong:** The 3-post/day Instagram cap is checked against `publishedAt`, but there are 2 posts scheduled for today that haven't published yet, allowing a 3rd auto-schedule that exceeds the real cap.
**Why it happens:** Counting only `published` status misses `scheduled` status.
**How to avoid:** `countTodayPosts()` must count posts where `status IN ('published', 'scheduled')` AND the scheduled/published time falls on today.
**Warning signs:** Bursts of same-platform posts on the calendar.

### Pitfall 6: Google News RSS URLs Redirect Through Google
**What goes wrong:** Articles in Google News RSS feeds use Google's redirect wrapper URLs, not the actual article URLs. Storing Google redirect URLs as the dedup key means two feeds covering the same article get different URLs and aren't deduplicated.
**Why it happens:** Google News wraps article URLs in `https://news.google.com/rss/articles/...` format.
**How to avoid:** For `type = 'google_news'` feeds, resolve the final URL after one redirect before using as dedup key. Alternatively, use the article title as secondary dedup signal. The content extraction in `extractFromUrl()` already follows redirects.
**Warning signs:** Same article appearing multiple times from different Google News queries.

### Pitfall 7: Cross-Platform Stagger Timing (SPAM-03)
**What goes wrong:** All platforms for the same source content get the same `scheduledAt` time.
**Why it happens:** Calling `scheduleToNextSlot()` independently for each platform without offset.
**How to avoid:** After scheduling the first platform, add 30-60 min random offset for each additional platform derived from the same source entry. Do this at auto-generate time when creating the post platforms.
**Warning signs:** Calendar shows multiple platform posts at identical times.

## Code Examples

Verified patterns from existing project code:

### Adding New Cron Jobs to cron.ts
```typescript
// Source: src/lib/cron.ts existing pattern
// Add inside initCron() after existing jobs:

// ── 3. Poll feeds every 5 minutes ──────────────────────────────────────────
cron.schedule('*/5 * * * *', async () => {
  try {
    const { pollFeeds } = await import('./feed-poll')
    await pollFeeds()
  } catch (err) {
    console.error('[cron] feed-poll failed:', err)
  }
})

// ── 4. Auto-generate every 15 minutes ──────────────────────────────────────
cron.schedule('*/15 * * * *', async () => {
  try {
    const { autoGenerate } = await import('./auto-generate')
    await autoGenerate()
  } catch (err) {
    console.error('[cron] auto-generate failed:', err)
  }
})
```

### Drizzle Migration Pattern
```sql
-- Source: src/db/migrations/0005_scheduling_slots.sql pattern
-- File: 0006_feed_automation.sql
ALTER TABLE `feed_sources` ADD COLUMN `consecutive_failures` integer DEFAULT 0 NOT NULL;
ALTER TABLE `feed_sources` ADD COLUMN `enabled` integer DEFAULT 1 NOT NULL;
ALTER TABLE `brands` ADD COLUMN `automation_level` text DEFAULT 'manual';
ALTER TABLE `posts` ADD COLUMN `feed_entry_id` integer REFERENCES `feed_entries`(`id`);
```

### Schema Updates (drizzle)
```typescript
// Source: src/db/schema.ts existing pattern — add to feedSources table definition
consecutiveFailures: integer('consecutive_failures').notNull().default(0),
enabled: integer().notNull().default(1),  // 1=enabled, 0=disabled

// Add to brands table definition
automationLevel: text('automation_level', {
  enum: ['manual', 'semi', 'mostly', 'full']
}).default('manual'),

// Add to posts table definition
feedEntryId: integer('feed_entry_id').references(() => feedEntries.id),
```

### Batched Haiku Relevance Scoring
```typescript
// Source: pattern derived from generate.ts parseJsonResponse() + ai.ts getModelConfig()
async function scoreBatch(
  brand: BrandRow,
  entries: Array<{ id: number; url: string; title: string }>
): Promise<void> {
  const prompt = [
    `Brand topics: ${(brand.topics ?? []).join(', ')}`,
    `Brand goals: ${brand.goals ?? 'general content'}`,
    '',
    'Score each feed entry for relevance to the brand (1-10).',
    'Return ONLY valid JSON array: [{ "id": 1, "score": 7 }, ...]',
    '',
    'Entries:',
    entries.map(e => `ID ${e.id}: "${e.title}" (${e.url})`).join('\n'),
  ].join('\n')

  const response = await getBreaker('anthropic').call(() =>
    anthropic.messages.create({
      model: getModelConfig().filter,  // Haiku
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    })
  )
  // parse array, update each feedEntries row with relevance_score
}
```

### rss-parser Feed Fetch
```typescript
// Source: rss-parser README (https://github.com/rbren/rss-parser)
import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 10_000,  // 10s timeout
  headers: { 'User-Agent': 'SocialContentEngine/1.0' },
})

// All four feed types use the same API:
const feed = await parser.parseURL(feedSource.url)
// feed.items[].link  -- the article URL
// feed.items[].title -- entry title
// feed.items[].pubDate -- publication date string
// feed.items[].isoDate -- ISO-8601 date (more reliable)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| xml2js for RSS parsing | rss-parser (purpose-built) | 2018+ | Handles Atom, MediaRSS, malformed feeds; TypeScript native |
| Polling every minute | 5-min poll interval | Standard practice | Reduces API rate limit risk; most feeds update <hourly |
| Hard daily post limits | Warmup-aware caps | Industry standard 2023+ | New accounts need gradual ramp-up or risk flagging |

**Deprecated/outdated:**
- `feedparser` (older streaming API): Still works but streams API is less ergonomic than async/await rss-parser provides.
- Storing full article HTML in feed entries at poll time: Modern practice is to defer extraction until generation time (lazy extraction).

## Open Questions

1. **Content type support in auto-generate (FEED-02 mentions "content types")**
   - What we know: FEED-02 specifies "content types" as part of per-feed config, but requirements don't enumerate what types are supported
   - What's unclear: Does "content types" mean text-only vs include carousels/images? Or does it mean article/video/social?
   - Recommendation: Default to text posts only for auto-generated content in Phase 6. Carousel auto-generation is complex and out of scope for this phase.

2. **Confidence threshold for FEED-09**
   - What we know: "Confidence scoring determines auto-publish vs queue for review"
   - What's unclear: Is confidence the same as qualityScore from refineAndGate? Or a separate score combining relevance + quality?
   - Recommendation: Use `qualityScore` from the quality pipeline as the confidence score. Threshold default = 7 (same as quality gate pass threshold). Configurable per brand via automationLevel logic.

3. **SPAM-07 hashtag enforcement**
   - What we know: Platform constraints are already in `generate.ts` PLATFORM_CONSTRAINTS as prompt instructions
   - What's unclear: Whether hashtag count enforcement should be post-generation validation or just prompt guidance
   - Recommendation: Add hashtag count validation as a post-generation check in auto-generate.ts. If count is out of range, trim/add rather than discard.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — project has no test framework configured |
| Config file | None — Wave 0 must install |
| Quick run command | N/A until Wave 0 complete |
| Full suite command | N/A until Wave 0 complete |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FEED-03 | URL deduplication — inserting same URL twice stores only one entry | unit | `npx tsx scripts/validate-feed-dedup.ts` | Wave 0 |
| FEED-04 | Haiku scores entry 1-10 | manual-only | N/A — requires live Anthropic API | manual |
| FEED-10 | Feed disables after 10 consecutive failures | unit | `npx tsx scripts/validate-feed-disable.ts` | Wave 0 |
| SPAM-01 | Daily cap enforced per platform | unit | `npx tsx scripts/validate-spam-guard.ts` | Wave 0 |
| SPAM-02 | 1-hour gap enforced | unit | `npx tsx scripts/validate-spam-guard.ts` | Wave 0 |
| SPAM-04 | Warmup cap: week 1=1/day | unit | `npx tsx scripts/validate-warmup.ts` | Wave 0 |
| FEED-08 | semi mode creates drafts, full mode schedules | smoke | manual — check DB state after cron tick | manual |

Note: The project uses `tsx` validation scripts (per STATE.md decisions) rather than a formal test framework. Validation scripts are the established pattern (e.g., Phase 0 infrastructure validation scripts). Continue this pattern.

### Sampling Rate
- **Per task commit:** Run `npx tsx scripts/validate-*.ts` (any new validation scripts created in Wave 0)
- **Per wave merge:** Manual smoke: trigger cron via health endpoint, verify feedEntries table populated
- **Phase gate:** All spam guard unit scripts pass; feed polling and auto-generate verified via activity log

### Wave 0 Gaps
- [ ] `scripts/validate-feed-dedup.ts` — covers FEED-03
- [ ] `scripts/validate-spam-guard.ts` — covers SPAM-01, SPAM-02, SPAM-05
- [ ] `scripts/validate-warmup.ts` — covers SPAM-04
- [ ] `scripts/validate-feed-disable.ts` — covers FEED-10
- [ ] `0006_feed_automation.sql` migration file — needed before any implementation

## Sources

### Primary (HIGH confidence)
- [rss-parser GitHub README](https://github.com/rbren/rss-parser) — parseURL API, TypeScript support, custom fields
- Project source: `src/lib/cron.ts` — cron pattern with globalThis mutex
- Project source: `src/lib/publish.ts` — globalThis mutex + per-item loop pattern
- Project source: `src/app/actions/generate.ts` — quality pipeline (generateContent + refineAndGate)
- Project source: `src/db/schema.ts` — feedSources, feedEntries, posts schema (existing columns confirmed)
- Project source: `src/db/migrations/0000_*.sql` — confirmed feedEntries.url has UNIQUE index
- Project source: `src/lib/ai.ts` — getModelConfig() filter model = Haiku, checkAiSpend(), logAiSpend()
- Project source: `next.config.ts` — serverExternalPackages pattern for Node-only modules

### Secondary (MEDIUM confidence)
- [YouTube RSS format](https://danielmiessler.com/blog/rss-feed-youtube-channel) — `feeds/videos.xml?channel_id=UC...` confirmed standard
- [Reddit RSS format](https://www.howtogeek.com/320264/how-to-get-an-rss-feed-for-any-subreddit/) — append `.rss` to subreddit URL confirmed
- [Google News RSS](https://www.newscatcherapi.com/blog-posts/google-news-rss-search-parameters-the-missing-documentaiton) — search query RSS format confirmed
- Social media warmup research — week-based ramp-up is industry practice

### Tertiary (LOW confidence)
- Google News redirect URL deduplication concern — observed pattern, not officially documented

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — rss-parser is the dominant RSS library for Node.js; all other dependencies already in project
- Architecture: HIGH — patterns directly derived from existing project code (publish.ts, generate.ts, cron.ts)
- Schema changes: HIGH — feedSources/feedEntries exist; missing columns identified from requirements
- Pitfalls: HIGH for items 1-5 (derived from code analysis); MEDIUM for items 6-7 (observed patterns)
- Spam guard rules: HIGH — requirements are explicit with exact numbers

**Research date:** 2026-03-18
**Valid until:** 2026-09-18 (stable domain — RSS parsing and SQLite patterns don't change rapidly)
