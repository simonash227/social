# Pitfalls Research

**Domain:** AI-powered social media content automation (personal tool)
**Researched:** 2026-03-15
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: SQLite Corruption on Railway Volume

**What goes wrong:** SQLite database becomes corrupted after Railway redeploy or crash, losing all data.

**Why it happens:** Railway's ephemeral filesystem resets on deploy. If SQLite file isn't on a persistent volume, or WAL mode isn't enabled, corruption can occur during write-heavy operations interrupted by process kill.

**How to avoid:**
- Mount Railway volume at `/data/`, set `DATABASE_PATH=/data/social.db`
- Enable `PRAGMA journal_mode = WAL` on startup
- Run `PRAGMA integrity_check` on startup to detect corruption early
- Daily backup to R2 as safety net

**Warning signs:** Missing data after deploy, `SQLITE_CORRUPT` errors, `integrity_check` returns errors.

**Phase to address:** Phase 0 (Infrastructure Validation Spike)

---

### Pitfall 2: Duplicate Publishes After Crash Recovery

**What goes wrong:** A post gets published twice because the process crashed after Upload-Post accepted the request but before the post status was updated to `published`.

**Why it happens:** No intermediate `publishing` state, or state recovery resets posts back to `scheduled` without checking if they were already sent.

**How to avoid:**
- Use `publishing` as intermediate state between `scheduled` and `published`
- State recovery: only reset posts stuck in `publishing` for > 30 minutes
- Store Upload-Post request IDs to check for duplicates

**Warning signs:** Same post appears twice on a platform, Upload-Post returns duplicate request IDs.

**Phase to address:** Phase 1 (Scaffolding — cron infra)

---

### Pitfall 3: AI Cost Explosion from Uncontrolled Generation

**What goes wrong:** Monthly AI bill spikes to $500+ because feed polling triggered unlimited generation chains, or self-refine loops didn't terminate.

**Why it happens:** No spend tracking, no per-poll batch limits, no circuit breaker on API failures (retries compound costs).

**How to avoid:**
- `MAX_DAILY_AI_SPEND` env var with hard stop
- `max_entries_per_poll` limit on feeds (default 5)
- Max 2 self-refine rounds (diminishing returns)
- Circuit breaker: pause after N consecutive API failures
- AI_MODE=testing during development ($6-11/mo vs $90-230/mo)

**Warning signs:** Daily spend exceeds 2x average, feed poll processing more items than usual, self-refine running 3+ rounds.

**Phase to address:** Phase 1 (daily spend tracker), Phase 6 (feed limits)

---

### Pitfall 4: Platform Shadowban from Bot-like Behavior

**What goes wrong:** Social media accounts get shadowbanned or restricted, posts stop reaching audience.

**Why it happens:** Posting too frequently, same posting times every day, identical formatting patterns, no human engagement on the account.

**How to avoid:**
- Per-platform daily caps (X: 3-5, Instagram: 1-3, LinkedIn: 1-2)
- Timing jitter (±15 min)
- Minimum 1 hour between posts on same platform
- Warmup period for new accounts (Week 1: 1/day, Week 2: 2/day)
- Content variety enforcement (hook types, formats)
- No cross-brand engagement (coordinated inauthentic behavior detection)
- Stagger cross-platform posting (30-60 min apart)

**Warning signs:** Sudden drop in impressions/reach, platform notifications about suspicious activity, engagement rate drops to near-zero.

**Phase to address:** Phase 6 (Content Automation Pipeline — spam prevention)

---

### Pitfall 5: RSS Injection / Prompt Injection via Feed Content

**What goes wrong:** Malicious RSS feed content manipulates AI generation, producing spam, links to malicious sites, or off-brand content.

**Why it happens:** Feed content treated as trusted input and injected into system prompts. Attacker crafts RSS entry with prompt injection text.

**How to avoid:**
- Extracted content always goes in USER message, never SYSTEM prompt
- Sanitize HTML and strip invisible text from feed content
- Quality gate catches anomalous output
- Validate feed URLs return valid RSS before adding
- Block internal IPs (SSRF prevention)

**Warning signs:** Generated posts contain unexpected links, off-brand content, or instructions ("ignore previous instructions...").

**Phase to address:** Phase 1 (input sanitization), Phase 2A (prompt structure)

---

### Pitfall 6: Goodhart's Law — Optimizing for Wrong Metrics

**What goes wrong:** Self-improvement loop overfits to engagement metrics, producing clickbait that damages brand credibility.

**Why it happens:** AI learns that provocative hooks get more engagement and doubles down, abandoning brand voice constraints.

**How to avoid:**
- Brand voice/dos/donts are in SYSTEM prompt (fixed, AI can't override)
- Hard diversity enforcement: if any hook_type exceeds 60% of recent posts, force different category
- Quality gate includes voice match and uniqueness dimensions
- Golden examples anchor the style
- Monthly human review of learnings

**Warning signs:** Posts trending toward sensationalist hooks, brand voice score declining, all posts using same hook type.

**Phase to address:** Phase 8 (Self-Improvement Loop — M2)

---

### Pitfall 7: better-sqlite3 Native Module Build Failures

**What goes wrong:** `better-sqlite3` fails to compile native bindings on Railway's build environment.

**Why it happens:** Missing build tools, Python, or incompatible Node.js version on the deployment target.

**How to avoid:**
- Verify build works on Railway in Phase 0 spike
- Pin Node.js version in `package.json` engines field
- Consider prebuild binaries via `@mapbox/node-pre-gyp`

**Warning signs:** Build fails with `node-gyp` errors, missing `python` or `make`.

**Phase to address:** Phase 0 (Infrastructure Validation Spike)

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Raw SQL instead of drizzle | Faster initial development | No type safety, migration pain | Never — drizzle is lightweight enough |
| Skip quality gate during dev | Faster iteration | Bad content habits, missed bugs in gate logic | Only in AI_MODE=testing |
| Hardcoded posting times | Quick scheduling | Can't optimize timing per brand/platform | MVP only, replace with slot config in Phase 5 |
| Single cron for all brands | Simple implementation | Blocks if one brand's API calls are slow | Acceptable for 3-5 brands, batch if scaling |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Upload-Post | Not distinguishing auth errors from transient failures | Classify errors: auth (stop retrying) vs transient (retry with backoff) |
| Claude API | Not using prompt caching | Cache system prompt per brand (~3,500 tokens, 90% discount on cache hits) |
| Cloudflare R2 | Using AWS S3 endpoint URLs | Use R2 endpoint URL format: `https://<account-id>.r2.cloudflarestorage.com` |
| YouTube transcripts | Assuming all videos have captions | Check availability first, fall back to description/title |
| RSS feeds | Not handling feed format variations | rss-parser handles Atom/RSS2/RSS1; still validate before adding |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Synchronous AI calls in cron | Cron job takes 30+ min, blocks next run | Mutex guard + batch limits per run | > 20 feeds or > 50 posts/day |
| Loading all posts for analytics | Slow dashboard, high memory | Paginate queries, aggregate in SQL | > 10,000 posts |
| Generating thumbnails on-demand | Slow media library, repeated work | Generate thumbnails at upload time, store in R2 | > 500 images |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| API keys in code or database | Key exposure if code/DB is leaked | `.env` only, Railway encrypted env vars |
| Feed content in system prompt | Prompt injection | Always in USER message, sanitize HTML |
| No auth on API routes | Anyone can trigger generation | Session cookie check on all routes |
| Internal IP in feed URLs | SSRF attacks | Validate and block private IP ranges |

## "Looks Done But Isn't" Checklist

- [ ] **Scheduling:** Often missing timezone conversion — verify UTC storage + local display
- [ ] **Auto-publish:** Often missing retry logic — verify 3 retries with 5 min backoff
- [ ] **Feed polling:** Often missing dedup — verify UNIQUE(feed_id, entry_url) constraint
- [ ] **Quality gate:** Often missing the "improve" path — verify re-refine on score 5-7
- [ ] **Analytics:** Often missing div-by-zero guard — verify impressions=0 → score=0
- [ ] **Cron init:** Often starts multiple times on hot reload — verify singleton guard
- [ ] **DB backup:** Often doesn't verify backup integrity — verify backup file is valid SQLite

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| SQLite corruption | Phase 0 | WAL mode active, integrity check on startup |
| Duplicate publishes | Phase 1 | `publishing` intermediate state exists |
| Cost explosion | Phase 1 + Phase 6 | Spend limit enforced, batch limits on feeds |
| Shadowban | Phase 6 | Rate limits, jitter, warmup all active |
| Prompt injection | Phase 1 + Phase 2A | Feed content in USER message only |
| Goodhart's Law | Phase 8 (M2) | Diversity enforcement code-level, not just prompt |
| Native module build | Phase 0 | Successful Railway deploy with better-sqlite3 |

---
*Pitfalls research for: AI-powered social media content automation*
*Researched: 2026-03-15*
