# Feature Research

**Domain:** AI-powered social media content automation — Intelligence Layer (v2.0)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Context

This covers the v2.0 Intelligence Layer milestone only. v1.0 is fully shipped and operational — brand management, AI generation, quality pipeline, RSS automation, scheduling, publishing, analytics collection, and dashboard are all table stakes that already exist.

The question here is: **what does a self-improving content engine look like, and which v2 features are table stakes vs differentiators vs anti-features?**

---

## Feature Landscape

### Table Stakes for a Self-Improving Engine

Features that any "learning" content system is expected to have. Missing these makes the intelligence layer feel shallow.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Performance visibility (charts) | Can't improve what you can't see — users need trends, not just numbers | LOW | Time-series engagement charts per brand and platform. Existing percentile classification is building block |
| Posting-time heatmap | Every major tool (Hootsuite, Buffer, Sprout) shows when-to-post grids | MEDIUM | 7×24 grid, color by engagement. Needs ≥ 4 weeks of data to be meaningful per-brand |
| Multi-variant generation | Expected from any AI content tool in 2026 — generate 3 variants, pick best | MEDIUM | Quality gate already scores; generate 3, gate picks winner. AI cost is 3× per post — use Haiku for variants, Sonnet only for gate |
| Platform comparison | Users need to know which platforms perform best for each brand | LOW | Cross-platform engagement bar charts. Data already collected |
| Evergreen recycling | SmarterQueue, RecurPost, SocialBu, Buffer all have this — it's expected | MEDIUM | Query top-N posts by engagement score, schedule fresh variants. Needs time-since-last-post check to avoid repetition |

### Differentiators (True Intelligence Layer Advantage)

Features that set this system apart. Not expected by convention, but high value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Self-improvement loop | Engine learns from what worked — content quality compounds over time without manual tuning | HIGH | Weekly cron: analyze top/bottom performers → Claude summarizes patterns → store as learnings → inject into generation prompts. Competitors don't do this at all |
| Golden examples (auto-curated) | 15-40% quality improvement from few-shot prompting with high-quality examples vs random examples | MEDIUM | Auto-query 90th percentile posts by engagement. Store as few-shot examples per brand. Inject alongside learnings at generation time |
| Learning validation (A/B) | Prevents bad learnings from compounding — deactivate anything that doesn't lift quality | HIGH | Tag posts generated with vs without learning. After N posts, compare engagement percentiles. Deactivate learnings below threshold. GrowthBook-style feature flagging pattern |
| Prompt evolution | Monthly AI-suggested template improvements — prompts get better without manual prompt engineering | HIGH | Monthly cron: feed Claude current template + top/bottom examples → get suggested rewrite → A/B test old vs new over 30 days → auto-promote winner |
| Content repurposing chains | One source → spread across multiple days and platforms automatically | MEDIUM | Source parsed once; AI generates platform-specific variants (LinkedIn long-form, X thread, Instagram caption) and schedules them staggered across 3-7 days |
| Engagement helper | Closes the engagement gap — surfaces comments needing a reply and drafts suggested responses | LOW | Query Upload-Post for unresponded comments. Claude generates 3 reply variants per comment in brand voice. User picks and posts manually |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-reply to comments | "Full automation" feels better | Platforms detect bot reply patterns and penalize accounts. PROJECT.md explicitly calls this out-of-scope | Engagement helper: suggest replies, human posts them |
| Real-time analytics sync | "I want live metrics" | Engagement data is not stable for 48h+; real-time reads waste API quota on meaningless numbers | Existing 6-hour polling is correct — surface the data better with charts |
| Train on AI-generated content | Seems like a way to accelerate learning | Model collapse: re-training on AI outputs narrows variance, strips rare patterns, outputs become generic. 2025 research confirms this compounds with each cycle | Only use actual engagement metrics (real human signals) as the feedback signal — never feed AI output back as training data |
| Fully automated learning application | "Just apply learnings automatically" | Without validation, a single bad analysis corrupts all future posts. Need a staged gate | Validate learnings with A/B split before promoting to production prompts |
| Aggressive evergreen recycling | "Post my best stuff every week" | Audiences notice repetition; platforms may reduce reach for duplicate-adjacent content | 90-day minimum cooldown between recycles, always generate a fresh angle rather than re-posting verbatim |
| Per-post prompt evolution | "Evolve the prompt after every post" | Noise-to-signal ratio is too low for single-post signals; overfitting to outliers | Batch analysis only (weekly minimum, monthly for prompt rewrites) — requires statistical significance |

---

## Feature Dependencies

```
[Analytics Collection — already built]
    └──required by──> Self-improvement loop
    └──required by──> Golden examples
    └──required by──> Learning validation
    └──required by──> Posting-time heatmap
    └──required by──> Performance charts
    └──required by──> Platform comparison
    └──required by──> Evergreen recycling (identifies candidates)

[Self-improvement loop]
    └──required by──> Learning validation (needs learnings to validate)
    └──enhances──> Content generation (injects learnings into prompts)

[Golden examples]
    └──enhances──> Content generation (few-shot examples in prompts)
    └──feeds into──> Self-improvement loop (examples inform learning analysis)

[Learning validation]
    └──required by──> Prompt evolution (validates template rewrites too)
    └──requires──> Self-improvement loop (produces learnings to validate)

[Multi-variant generation]
    └──requires──> Quality gate (already built — picks winner from 3)
    └──enhances──> Learning validation (more data points per time period)

[Content repurposing chains]
    └──requires──> Content extraction (already built)
    └──requires──> Content generation (already built)
    └──enhances──> Scheduling calendar (already built)

[Evergreen recycling]
    └──requires──> Analytics collection (to rank by performance)
    └──requires──> Content generation (to write fresh angle)
    └──conflict──> Spam prevention dedup (need to allow recycled posts through dedup)

[Engagement helper]
    └──requires──> Upload-Post comment fetch API (verify availability)
    └──standalone (no dependency on learning system)

[Performance charts]
    └──requires──> Analytics collection (already built)
    └──standalone (pure UI on top of existing data)

[Posting-time heatmap]
    └──requires──> Analytics collection with post timestamps (already built)
    └──requires──> 4+ weeks of data to be meaningful
```

### Key Dependency Notes

- **Analytics collection is the foundation**: every intelligence feature depends on it. The existing system collects every 6 hours. ~2-4 weeks of data should exist before enabling the self-improvement loop.
- **Self-improvement → Learning validation dependency**: do not ship learning validation UI before the improvement loop generates learnings to validate. Ship them together.
- **Evergreen recycling conflicts with dedup**: the dedup system prevents posting the same content twice. Recycling intentionally reposts. The recycling system must flag posts to exempt them from the dedup check, or use a content-hash exemption list.
- **Performance charts are independent**: pure UI feature on top of existing data — can ship in any phase.
- **Engagement helper independence**: does not touch the learning system at all. Fast win.

---

## MVP Definition for v2.0

### Launch With (v2.0 Core)

The minimum viable intelligence layer — must feel like the engine is actually learning.

- [ ] Performance charts (time-series engagement per brand/platform) — validates analytics data is usable
- [ ] Posting-time heatmap — immediate value from existing data
- [ ] Platform comparison view — completes the analytics picture
- [ ] Multi-variant generation (3 variants → quality gate picks best) — fast win, improves every post immediately
- [ ] Golden examples (auto-curate 90th percentile posts as few-shot) — medium effort, 15-40% quality lift
- [ ] Self-improvement loop (weekly analysis → learnings store → prompt injection) — core of the milestone
- [ ] Engagement helper (unresponded comments + suggested replies) — low complexity, high perceived value

### Add After Initial Validation (v2.1)

Ship once the improvement loop has run for 2-4 weeks and produced learnings to validate.

- [ ] Learning validation (A/B test learnings, deactivate underperformers) — requires learnings to exist first
- [ ] Evergreen recycling (resurface top performers with fresh angle) — requires dedup conflict resolution
- [ ] Content repurposing chains (one source → multi-platform, multi-day) — medium complexity

### Defer (v2.2+)

- [ ] Prompt evolution (monthly cron, A/B test templates) — requires learning validation infrastructure first; low urgency since golden examples + learnings already improve prompts
- [ ] Bulk pipeline (batch URL processing) — useful but not core to intelligence layer

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Performance charts | HIGH | LOW | P1 |
| Posting-time heatmap | HIGH | LOW | P1 |
| Platform comparison | MEDIUM | LOW | P1 |
| Multi-variant generation | HIGH | MEDIUM | P1 |
| Golden examples | HIGH | MEDIUM | P1 |
| Self-improvement loop | HIGH | HIGH | P1 |
| Engagement helper | MEDIUM | LOW | P1 |
| Learning validation | HIGH | HIGH | P2 |
| Evergreen recycling | MEDIUM | MEDIUM | P2 |
| Content repurposing chains | MEDIUM | MEDIUM | P2 |
| Prompt evolution | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v2.0 launch
- P2: Add in v2.1 once P1 stable
- P3: Nice to have, defer to v2.2+

---

## Complexity Breakdown

### Low Complexity (days, not weeks)

| Feature | Why Low | Notes |
|---------|---------|-------|
| Performance charts | UI-only on existing DB data. shadcn/ui has Recharts wrappers | Pick a chart library (Recharts) and query existing analytics table |
| Posting-time heatmap | SQL GROUP BY hour + day_of_week aggregation → grid render | Same analytics table. Color intensity from engagement score |
| Platform comparison | Grouped bar chart from existing engagement data | Same data, different view |
| Engagement helper | Fetch comments via Upload-Post API, generate replies with Claude | Mostly a new UI page + one API call |

### Medium Complexity (1-2 weeks)

| Feature | Why Medium | Notes |
|---------|------------|-------|
| Multi-variant generation | Need to run generation 3× per post, store variants, gate picks winner | Quality gate already exists. Main work: schema for variants, UI to show which won |
| Golden examples | Query + scoring logic simple; integration into generation prompt requires prompt refactoring | Need to inject examples without blowing context budget |
| Evergreen recycling | Candidate selection is SQL; fresh-angle generation is straightforward. Dedup conflict needs care | Must handle dedup exemption cleanly |
| Content repurposing chains | Platform-specific generation is the hard part; scheduling is already built | Prompt design per platform is the real work |

### High Complexity (2-4 weeks each)

| Feature | Why High | Notes |
|---------|----------|-------|
| Self-improvement loop | Analysis cron + Claude summarization + learnings schema + prompt injection + UI to review learnings | Core loop is straightforward; the difficulty is making learnings actionable and reviewable without becoming a black box |
| Learning validation | A/B split logic on generated posts, statistical significance detection, deactivation workflow | Need careful schema: which posts used which learnings, controlled comparison groups |
| Prompt evolution | A/B test on template level (not just learnings), promotion logic, rollback | Depends on learning validation infrastructure already working |

---

## Sources

- [AI Marketing Automation 2026 Guide](https://neuwark.com/blog/ai-marketing-automation-2026-guide) — self-improvement loop patterns
- [Agentic AI Workflows 2026](https://www.myaiassistant.blog/2026/02/agentic-autonomous-ai-workflows-in-2026.html) — feedback loop architecture
- [Finding Golden Examples: Smarter In-Context Learning](https://towardsdatascience.com/finding-golden-examples-a-smarter-approach-to-in-context-learning/) — golden examples and AuPair framework, 15-40% quality lift from few-shot
- [A/B Testing LLM Prompts](https://www.braintrust.dev/articles/ab-testing-llm-prompts) — learning validation patterns
- [GrowthBook A/B Testing for AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/) — feature-flag deactivation of ineffective learnings
- [SmarterQueue Evergreen Recycling](https://smarterqueue.com/features/evergreen_recycling) — established patterns for evergreen automation
- [RecurPost Evergreen Content](https://recurpost.com/evergreen-content-marketing/) — category queues, cooldown logic
- [Model Collapse Risk 2025](https://www.winssolutions.org/ai-model-collapse-2025-recursive-training/) — anti-feature: training on AI outputs
- [AI Feedback Loop: Model Collapse](https://venturebeat.com/ai/the-ai-feedback-loop-researchers-warn-of-model-collapse-as-ai-trains-on-ai-generated-content/) — validated the anti-feature reasoning
- [Social Media Analytics Best Practices 2025](https://databox.com/social-media-analytics) — heatmap and posting-time patterns
- [Hootsuite Best Time to Publish](https://blog.hootsuite.com/best-time-to-post-on-instagram/) — heatmap as table-stakes feature
- [AI Content Repurposing Trends 2025](https://contentin.io/blog/ai-content-repurposing-trends-for-2025/) — one-source multi-platform pipeline patterns
- [Replient.ai Comment Management](https://replient.ai/en/) — engagement helper pattern: suggest, human posts
- [OpusClip Auto-Reply Tools 2026](https://www.opus.pro/blog/best-auto-reply-tools-comments-dms) — confirmed auto-reply is a known anti-pattern risk

---
*Feature research for: AI-powered social media content automation — v2.0 Intelligence Layer*
*Researched: 2026-03-19*
