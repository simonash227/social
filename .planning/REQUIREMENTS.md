# Requirements: Personal Content Engine

**Defined:** 2026-03-19
**Core Value:** Set up a brand once, then only check in weekly. Everything else runs autonomously.

## v2.0 Requirements (Intelligence Layer)

### Self-Improvement

- [ ] **LEARN-01**: Weekly analysis cron identifies patterns in top/bottom performers per brand per platform
- [ ] **LEARN-02**: AI generates structured learnings (hook, format, tone, topic, timing, media, cta, length dimensions)
- [ ] **LEARN-03**: Learnings injected into generation prompts sorted by confidence score
- [ ] **LEARN-04**: Learnings dashboard: view active/inactive learnings per brand with performance data
- [ ] **LEARN-05**: Post-mortem on failures: underperformers generate "avoid" learnings
- [ ] **LEARN-06**: Statistical minimum gate: analysis requires 30+ posts per cohort before generating learnings
- [ ] **LEARN-07**: Human approval gate: new learnings start as "pending" until approved on dashboard

### Golden Examples

- [ ] **GOLD-01**: Auto-curate 90th percentile posts as golden examples per brand per platform
- [ ] **GOLD-02**: Dynamic few-shot: inject top 5 recent golden examples into generation prompts
- [ ] **GOLD-03**: Golden examples page: view, pin, unpin examples per brand

### Learning Validation

- [ ] **VALID-01**: Tag each generated post with which learnings were active during generation
- [ ] **VALID-02**: A/B comparison: posts with learning vs posts without, per learning
- [ ] **VALID-03**: Auto-deactivate learnings that show no engagement lift after N posts (configurable threshold)
- [ ] **VALID-04**: Learning effectiveness summary on dashboard with confidence indicators

### Multi-Variant Generation

- [ ] **MVAR-01**: Generate 3 content variants per post using Haiku, quality gate (Sonnet) picks winner
- [ ] **MVAR-02**: Per-brand toggle: enable/disable multi-variant generation (default off to control costs)
- [ ] **MVAR-03**: Store all variants with scores; show winning variant and runner-ups on post detail
- [ ] **MVAR-04**: Cost guard: multi-variant respects daily AI spend limit (3x cost per post)

### Advanced Analytics

- [ ] **CHART-01**: Time-series engagement charts per brand and per platform (line/bar)
- [ ] **CHART-02**: Posting-time heatmap: 7x24 grid colored by engagement score
- [ ] **CHART-03**: Platform comparison: cross-platform engagement bar charts per brand
- [ ] **CHART-04**: Learning impact chart: engagement trend before/after learnings activated
- [ ] **CHART-05**: "Not enough data" indicators when fewer than 30 posts exist for a view

### Engagement Helper

- [ ] **ENGAGE-01**: Surface posts with unresponded comments via Upload-Post API
- [ ] **ENGAGE-02**: AI generates 3 reply suggestions per comment in brand voice
- [ ] **ENGAGE-03**: Direct links to each post on its platform for manual reply posting

## Future Requirements (v2.1+)

### Content Strategy

- **STRAT-01**: Evergreen recycling: resurface top performers with fresh angle (90-day cooldown)
- **STRAT-02**: Content repurposing chains: one source → multi-platform, multi-day stagger
- **STRAT-03**: "Plan My Week" AI strategist

### Prompt Evolution

- **PEVO-01**: Monthly cron suggests improved prompt templates based on learning data
- **PEVO-02**: A/B test old vs new template over 30 days, auto-promote winner
- **PEVO-03**: Cross-brand insights page showing universal patterns

### Engagement & Polish

- **ENG-01**: Bulk pipeline: paste multiple URLs, batch generate, review queue
- **ENG-02**: Pinterest pin template

## Out of Scope

| Feature | Reason |
|---------|--------|
| Auto-reply to comments | Platform detection risk — penalizes accounts |
| Train on AI-generated content | Model collapse: re-training on AI outputs narrows variance |
| Fully automated learning application | Without validation, bad analysis corrupts future posts |
| Real-time analytics | Engagement data needs 48h+ to stabilize |
| Per-post prompt evolution | Noise-to-signal too low; batch analysis only |
| Aggressive evergreen recycling (< 90 days) | Platforms detect recycled content with 90%+ accuracy |

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated by roadmapper) | | |

**Coverage:**
- v2.0 requirements: 24 total
- Mapped to phases: 0
- Unmapped: 24

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after initial definition*
