# Roadmap: Personal Content Engine

## Milestones

- ✅ **v1.0 Working Engine** — Phases 0-7 (shipped 2026-03-18) — [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v2.0 Intelligence Layer** — Phases 8-14 (in progress)

## Phases

<details>
<summary>✅ v1.0 Working Engine (Phases 0-7) — SHIPPED 2026-03-18</summary>

- [x] Phase 0: Infrastructure Validation (2/2 plans) — completed 2026-03-16
- [x] Phase 1: Scaffolding + Database + Auth (5/5 plans) — completed 2026-03-16
- [x] Phase 2A: Brand Profiles + AI Generation (3/3 plans) — completed 2026-03-17
- [x] Phase 2B: Quality Pipeline (2/2 plans) — completed 2026-03-17
- [x] Phase 3: Content Extraction + Images (4/4 plans) — completed 2026-03-17
- [x] Phase 4: Carousel Generation (2/2 plans) — completed 2026-03-17
- [x] Phase 5: Calendar + Scheduling (3/3 plans) — completed 2026-03-18
- [x] Phase 6: Content Automation Pipeline (4/4 plans) — completed 2026-03-18
- [x] Phase 7: Analytics + Dashboard + Polish (3/3 plans) — completed 2026-03-18

</details>

### v2.0 Intelligence Layer

**Milestone Goal:** Make the engine self-improving — analyze what works, learn from it, and generate better content over time. Add multi-variant generation, content recycling, and advanced analytics.

**Phases:**

- [ ] **Phase 8: Schema Foundation** — New tables and columns enabling all v2.0 features, zero regressions to v1.0 pipeline
- [ ] **Phase 9: Learning Engine + Golden Examples** — Weekly self-improvement loop that extracts structured learnings from top/bottom performers and injects them into generation prompts alongside auto-curated golden examples
- [ ] **Phase 10: Learning Validation** — A/B attribution and effectiveness tracking that auto-deactivates learnings that fail to lift engagement
- [ ] **Phase 11: Multi-Variant Generation** — Per-brand 3-variant generation with quality gate winner selection and cost guardrails
- [ ] **Phase 12: Advanced Analytics** — Time-series charts, posting-time heatmap, platform comparison, and learning impact visualization
- [ ] **Phase 13: Content Recycling + Repurposing** — Evergreen recycling of top performers with fresh angles and multi-platform repurposing chains
- [ ] **Phase 14: Engagement Helper** — Surface unresponded comments with AI-drafted reply suggestions in brand voice

## Phase Details

### Phase 8: Schema Foundation
**Goal**: All v2.0 database tables and columns exist; existing v1.0 automation pipeline operates without regression after migrations land
**Depends on**: Phase 7 (v1.0 complete)
**Requirements**: (none — schema is enabling infrastructure; all 26 v2.0 requirements depend on it but none describe it as a user-visible feature)
**Success Criteria** (what must be TRUE):
  1. `brandLearnings`, `promptTemplates`, and `commentSuggestions` tables exist with correct schema
  2. New columns on `posts` (recycledFromPostId, variantGroup, variantOf, repurposeChainId), `brands` (enableVariants, learningInjection, lastLearningRunAt), and `postAnalytics` (promptTemplateId, activeLearningIds) are present with nullable/default values so no existing rows break
  3. Existing automation pipeline (RSS → generate → schedule → publish) completes a full cycle without errors after migrations
  4. Drizzle studio shows all new tables and columns; schema.ts matches actual DB state
**Plans**: TBD

Plans:
- [ ] 08-01: Schema migrations — new tables and columns

### Phase 9: Learning Engine + Golden Examples
**Goal**: The engine analyzes top and bottom performers weekly, extracts structured learnings, and automatically injects them (along with golden example posts) into future generation prompts — completing the self-improvement loop
**Depends on**: Phase 8
**Requirements**: LEARN-01, LEARN-02, LEARN-03, LEARN-04, LEARN-05, LEARN-06, LEARN-07, GOLD-01, GOLD-02, GOLD-03
**Success Criteria** (what must be TRUE):
  1. Weekly cron (Sunday 2am) runs analysis per brand per platform and writes `brandLearnings` rows only when 30+ posts exist in the cohort; brands below threshold show a "not enough data yet" indicator
  2. Generated learnings appear on the learnings dashboard with their type (hook/format/tone/topic/timing/media/cta/length), confidence score, and supporting post count; new learnings start as "pending" until approved
  3. After approval, learnings are injected into generation prompts (max 5, confidence-ordered, platform-matched); generated content visibly reflects injected context
  4. Failure post-mortems produce "avoid" learnings that appear alongside positive learnings on the dashboard with distinct labeling
  5. Golden examples page per brand shows 90th-percentile posts; top 5 pinned examples appear in generation prompts as few-shot context; user can pin or unpin any example
**Plans**: TBD

Plans:
- [ ] 09-01: Learning engine cron + analysis logic + brandLearnings writes
- [ ] 09-02: Prompt injector + modified generation pipeline + golden examples curation
- [ ] 09-03: Learnings dashboard UI + golden examples page

### Phase 10: Learning Validation
**Goal**: Each generated post records which learnings were active during its creation; A/B comparison reveals whether learnings actually lift engagement; ineffective learnings are automatically deactivated
**Depends on**: Phase 9
**Requirements**: VALID-01, VALID-02, VALID-03, VALID-04
**Success Criteria** (what must be TRUE):
  1. Every generated post stores the IDs of active learnings used during generation in `postAnalytics.activeLearningIds`; this data is visible on the post detail page
  2. Learning effectiveness dashboard shows per-learning A/B comparison: engagement averages for posts with vs without each learning, with post counts for each group
  3. A learning with no measurable engagement lift after N posts (configurable threshold, default 20) is automatically marked inactive with an "auto-deactivated" reason on the dashboard
  4. Each learning displays a confidence indicator (high/medium/low) derived from its supporting post count and engagement delta magnitude
**Plans**: TBD

Plans:
- [ ] 10-01: Learning attribution tagging on post generation + A/B comparison queries + auto-deactivation cron
- [ ] 10-02: Learning effectiveness UI — dashboard panel with confidence indicators

### Phase 11: Multi-Variant Generation
**Goal**: Brands with multi-variant enabled generate 3 content variants per post; the quality gate scores all three and picks the winner; cost is bounded by the daily AI spend limit
**Depends on**: Phase 8
**Requirements**: MVAR-01, MVAR-02, MVAR-03, MVAR-04
**Success Criteria** (what must be TRUE):
  1. When `enableVariants` is on for a brand, auto-generation produces 3 variants (Haiku at temperatures 0.7/0.85/1.0); Sonnet scores all three and the highest-scoring variant becomes the scheduled post
  2. Brand settings page shows a multi-variant toggle (default off); enabling it displays an estimated cost-per-post increase before confirming
  3. Post detail page shows the winning variant's score alongside collapsed runner-up variants with their scores
  4. Multi-variant generation counts its full token cost against `MAX_DAILY_AI_SPEND`; when the limit is reached, generation falls back to single-variant rather than failing silently
**Plans**: TBD

Plans:
- [ ] 11-01: generateVariants() function + brand toggle + cost tracking + fallback logic
- [ ] 11-02: Variant winner/loser UI on post detail + brand settings toggle

### Phase 12: Advanced Analytics
**Goal**: The analytics section shows time-series engagement charts, a posting-time heatmap, platform comparison, and learning impact trends; all views show "not enough data" guards when fewer than 30 posts exist
**Depends on**: Phase 9 (for learning impact chart data)
**Requirements**: CHART-01, CHART-02, CHART-03, CHART-04, CHART-05
**Success Criteria** (what must be TRUE):
  1. Brand analytics page shows a time-series line/bar chart of engagement over time, filterable by platform
  2. A 7x24 heatmap grid (day vs hour) is colored by average engagement score for that slot; empty slots show a neutral color
  3. Platform comparison bar chart shows average engagement per platform for the brand side by side
  4. A learning impact chart shows engagement trend before and after a learning was activated, with the activation date marked
  5. Any chart view with fewer than 30 posts in scope displays a "not enough data" message instead of a misleading chart
**Plans**: TBD

Plans:
- [ ] 12-01: Install recharts@2.15.4 + shadcn chart + SQL aggregation queries for all chart data
- [ ] 12-02: Analytics page UI — time-series, heatmap, platform comparison, learning impact, data guards

### Phase 13: Content Recycling + Repurposing
**Goal**: Top-performing posts are automatically resurfaced with fresh angles after a 90-day cooldown; one source can be scheduled across multiple platforms and days as a repurposing chain
**Depends on**: Phase 8
**Requirements**: STRAT-01, STRAT-02
**Success Criteria** (what must be TRUE):
  1. Weekly recycling cron identifies posts 90+ days old in the top engagement percentile and generates fresh-angle variants via Haiku; recycled posts appear in the calendar with a "recycled" label and link back to their source post
  2. No recycled content reuses the same image carousel or source URL on the same platform within 120 days; the recycler skips flagged posts silently with a log entry
  3. "Repurpose as Chain" action on the generate page takes one source and creates platform-specific variants scheduled across configurable days; the full chain appears as a group in the calendar
  4. Chain scheduling is atomic — all slots are reserved before any post records are created, preventing partial chains
**Plans**: TBD

Plans:
- [ ] 13-01: content-recycler.ts — weekly cron, 90-day gate, fresh-angle generation, dedup exemption
- [ ] 13-02: repurpose-chain.ts — chain generation, atomic slot reservation, calendar grouping UI

### Phase 14: Engagement Helper
**Goal**: Posts with unresponded comments are surfaced on the brand home page with AI-drafted reply suggestions in brand voice, making it easy to spot and respond to engagement
**Depends on**: Phase 8
**Requirements**: ENGAGE-01, ENGAGE-02, ENGAGE-03
**Success Criteria** (what must be TRUE):
  1. Brand home page shows an "Action Items" card listing up to 5 posts with unresponded comments, refreshed every 4 hours via the existing analytics cron cadence
  2. Each comment shows 3 AI-drafted reply suggestions in brand voice with a brief note on the angle chosen; suggestions are display-only (copy-to-clipboard, no auto-send)
  3. Each listed post includes a direct link to that post on its platform so the user can navigate there to reply manually
**Plans**: TBD

Plans:
- [ ] 14-01: engagement-helper.ts — Upload-Post comment fetch + AI reply generation + commentSuggestions writes
- [ ] 14-02: Action Items UI — brand home card, reply suggestions display, platform links

**Note:** Phase 14 has a binary external blocker. Verify Upload-Post API returns individual comment text (not just aggregate counts) before writing any implementation code. If the endpoint is unavailable, this phase is removed from scope.

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 0. Infrastructure Validation | v1.0 | 2/2 | Complete | 2026-03-16 |
| 1. Scaffolding + Database + Auth | v1.0 | 5/5 | Complete | 2026-03-16 |
| 2A. Brand Profiles + AI Generation | v1.0 | 3/3 | Complete | 2026-03-17 |
| 2B. Quality Pipeline | v1.0 | 2/2 | Complete | 2026-03-17 |
| 3. Content Extraction + Images | v1.0 | 4/4 | Complete | 2026-03-17 |
| 4. Carousel Generation | v1.0 | 2/2 | Complete | 2026-03-17 |
| 5. Calendar + Scheduling | v1.0 | 3/3 | Complete | 2026-03-18 |
| 6. Content Automation Pipeline | v1.0 | 4/4 | Complete | 2026-03-18 |
| 7. Analytics + Dashboard + Polish | v1.0 | 3/3 | Complete | 2026-03-18 |
| 8. Schema Foundation | v2.0 | 0/1 | Not started | - |
| 9. Learning Engine + Golden Examples | v2.0 | 0/3 | Not started | - |
| 10. Learning Validation | v2.0 | 0/2 | Not started | - |
| 11. Multi-Variant Generation | v2.0 | 0/2 | Not started | - |
| 12. Advanced Analytics | v2.0 | 0/2 | Not started | - |
| 13. Content Recycling + Repurposing | v2.0 | 0/2 | Not started | - |
| 14. Engagement Helper | v2.0 | 0/2 | Not started | - |

---
*Roadmap created: 2026-03-15*
*Last updated: 2026-03-19 after v2.0 roadmap creation*
