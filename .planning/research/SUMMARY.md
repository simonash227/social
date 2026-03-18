# Project Research Summary

**Project:** Social Content Engine — v2.0 Intelligence Layer
**Domain:** Self-improving AI content automation with analytics and learning feedback loops
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

The v2.0 milestone adds a genuine intelligence layer to a fully operational v1.0 content engine. The strategic bet is that content quality compounds over time when the system learns from real engagement signals — weekly analysis extracts structural patterns from top and bottom performers, those patterns are injected as learnings into future generation prompts, and a validation gate prevents bad learnings from propagating. Research confirms this pattern is novel among competitors (none implement autonomous prompt improvement from engagement data) and is achievable with the existing stack plus three targeted additions: recharts v2 for analytics charts, simple-statistics for percentile ranking, and an upgraded Anthropic SDK for structured outputs in analysis tasks. Everything else — the learning loop, prompt injection, recycling, repurposing chains, variant generation — is implemented using libraries already in the project.

The recommended implementation strategy is strictly phased by dependency order: schema first, then the core learning loop, then multi-variant generation, then recycling and repurposing, then prompt evolution, then analytics UI, and finally engagement helper (blocked on Upload-Post API verification). This order is not arbitrary — the learning engine must produce data before validation can be built, variants need the quality gate already in place, recycling needs an anti-dedup exemption strategy decided before ship, and prompt evolution requires 20+ posts worth of learning attribution data before it can make meaningful suggestions. Jumping ahead on any of these creates rework.

The most important risk is Goodhart's Law: optimizing engagement metrics in a closed loop causes the engine to converge on a narrow, repetitive style that initially improves metrics and then collapses reach as audiences and platform algorithms penalize sameness. Mitigation is non-negotiable: learnings must be advisory (human approval before injection into production prompts), golden examples must enforce hook-type and topic diversity, and the loop must include a hard diversity lock that blocks overused hook categories. All other risks — cost explosion from variants, platform duplicate penalties from recycling, SQLite write contention from new cron jobs — are lower-severity and have clear mechanical fixes documented in PITFALLS.md.

---

## Key Findings

### Recommended Stack

The existing v1.0 stack (Next.js 15, SQLite + drizzle-orm, node-cron, @anthropic-ai/sdk, OpenAI, Satori + sharp, Cloudflare R2, Tailwind v4 + shadcn/ui) requires only three new additions for v2.0. No vector databases, no external A/B testing services, no LangChain abstractions, no separate scheduler — all intelligence features are built on the existing process and libraries.

**Core technologies (NEW for v2.0):**
- **recharts@2.15.4**: Analytics charts (line, bar, area) — pin to v2, recharts v3 breaks shadcn chart.tsx as of March 2026 (confirmed bug, PR #8486 not merged)
- **simple-statistics@7.8.9**: Percentile ranking for golden examples curation — pure JS, no deps, provides `quantile()` for 90th-percentile threshold calculation
- **@anthropic-ai/sdk@0.80.0**: Upgrade from 0.79.0 — enables GA structured outputs via `output_config.format` for schema-guaranteed JSON in analysis tasks; additive upgrade, existing calls unaffected

**What requires no new libraries:** self-improvement loop, learning A/B validation, evergreen recycling, repurposing chains, engagement helper replies, posting time heatmap (CSS grid + Tailwind is 20 lines of JSX), multi-variant generation. The posting-time heatmap in particular does not need recharts — it is a 7x24 CSS grid colored by engagement value.

**Critical version constraint:** Do not upgrade recharts beyond v2.15.4 until shadcn releases an updated chart.tsx. The v3 API renamed `TooltipProps<ValueType, NameType>` to `TooltipContentProps`, breaking shadcn's chart wrapper. This is a confirmed live bug as of March 2026.

### Expected Features

Research distinguishes clearly between table stakes (expected by any user of a 2026 content tool) and true differentiators (what makes this system uniquely valuable).

**Must have — table stakes for v2.0:**
- Performance charts (time-series engagement per brand/platform) — every major tool has these; absence makes the analytics section feel incomplete
- Posting-time heatmap (7x24 day/hour grid colored by engagement) — Hootsuite, Buffer, Sprout all ship this as a standard feature
- Platform comparison view — users need to know which platforms deliver for each brand; data already collected
- Multi-variant generation (3 variants, quality gate picks best) — expected from any AI content tool in 2026
- Evergreen recycling (resurface top performers with fresh angle, 90-day cooldown) — SmarterQueue, RecurPost, SocialBu all have this

**Should have — differentiators that justify "intelligence layer":**
- Self-improvement loop (weekly analysis → structured learnings → prompt injection) — competitors do not do this
- Golden examples auto-curation (90th-percentile posts as few-shot examples; 15-40% quality lift documented in research)
- Learning validation via A/B split — prevents bad learnings from compounding; required for the loop to be trustworthy
- Content repurposing chains (one source → multi-platform, multi-day scheduled spread)
- Engagement helper (unresponded comment surfacing + AI-drafted replies, advisory/display only)

**Defer to v2.2+:**
- Prompt evolution (monthly AI-suggested template rewrites + A/B testing) — requires learning validation infrastructure; high complexity; golden examples + learnings injection already improve prompts substantially without it
- Bulk pipeline (batch URL processing) — useful but not core to intelligence story

**Anti-features to explicitly avoid:**
- Auto-reply to comments — platform detection risk; out-of-scope per PROJECT.md
- Training on AI-generated content — model collapse; feed only real engagement signals as feedback
- Fully automated learning application without human review — Goodhart's Law risk; learnings must be advisory
- Aggressive recycling without 90-day cooldown — platform duplicate penalties; account-level shadowbanning is the outcome

### Architecture Approach

v2.0 extends the existing single-process Railway architecture by adding new lib modules, new cron registrations, new schema tables, and modifying the generation pipeline to accept optional learnings. All changes are additive or backward-compatible via optional parameters and feature flags. Three architectural patterns carry the entire v2.0 build: threshold-gated analysis chaining (learning triggers only when enough new data exists, not on every analytics cycle, preventing noise-driven analysis), optional-parameter backward-compatible prompt augmentation (`buildSystemPrompt(brand, learnings?)` where absent learnings preserves v1.0 behavior exactly), and feature flags on brand records (`enableVariants`, `learningInjection` both default to 0) so new generation behavior is opt-in per brand after verification.

**Major components (new or modified):**
1. `learning-engine.ts` (NEW) — weekly analysis via Claude Sonnet, writes `brandLearnings` rows with type, description, confidence, supporting post IDs
2. `prompt-injector.ts` (NEW) — loads filtered active learnings per brand+platform, formats for prompt injection (max 5, confidence high/medium only, platform-matched, ordered by validation recency)
3. `content-recycler.ts` (NEW) — weekly cron finds 90-day-old top performers, generates fresh-angle variants via Claude Haiku, inserts with `recycledFromPostId` FK for lineage tracking
4. `repurpose-chain.ts` (NEW) — takes one source, generates platform-specific variants, reserves scheduling slots atomically as a unit before creating any post records
5. `analytics-charts.tsx` (NEW) — client component wrapping recharts v2 for engagement time-series, platform comparison, posting-time heatmap as CSS grid
6. `generate.ts` (MODIFIED) — gains `generateVariants()` function (3 calls at varying temperature 0.7/0.85/1.0, quality gate picks winner, losers saved with `variantOf` FK and hidden from post lists)
7. `schema.ts` (MODIFIED) — 3 new tables (`brandLearnings`, `promptTemplates`, `commentSuggestions`) + new columns on `posts`, `brands`, `postAnalytics`

**New schema tables:** `brandLearnings` (learnings per brand/platform with isActive, A/B group, validation date, supporting post IDs), `promptTemplates` (versioned template history with isActive and performance score — enables one-click rollback), `commentSuggestions` (AI reply drafts with status pending/used/dismissed — conditional on Upload-Post API verification).

### Critical Pitfalls

1. **Goodhart's Law / feedback loop collapse** — optimization target becomes engagement proxy, content converges to repetitive sensationalist hooks and reach collapses over weeks. Prevention: brand voice lives in system prompt (not modifiable by the self-improvement loop), learnings are advisory with human approval gate before production injection, hook-type diversity lock blocks categories exceeding 60% of recent posts, golden example pool enforces diversity across hook types and topic areas.

2. **Data starvation — learning on noise** — self-improvement runs with fewer than 30 posts per cohort produces coincidence-driven learnings that degrade prompt quality with no visible indicator. Prevention: hard minimum of 30 published posts with engagement data before analysis runs; "not enough data yet" indicator in UI; log data volume with every learning extraction for auditability; A/B validation requires minimum 10 posts per variant before declaring winner or loser.

3. **Multi-variant cost explosion** — 3 variants x 3 platforms x full quality gate = up to 9x token usage vs single-variant; daily spend limit calibrated for v1.0 single-variant gets exhausted by midday, silently blocking afternoon automation runs. Prevention: Haiku for all 3 variant generation calls, Sonnet only for the winner's final quality gate; prompt caching on shared brand system prompt (90% discount on cache hits with Anthropic); recalibrate `MAX_DAILY_AI_SPEND` before enabling variants per brand.

4. **Content recycling triggering platform duplicate penalties** — platform duplicate detection in 2025 uses perceptual hashing, deep learning pixel analysis, C2PA metadata tracking, and behavioral pattern analysis; rephrased versions of original posts are flagged; account-level shadowbanning is the outcome. Prevention: recycle the angle and insight from a top performer, apply it to new source material — never rewrite original content; enforce 90-day gap; never recycle image carousels (image fingerprinting is the most reliable detection vector); do not reuse same `source_url` on same platform within 120 days.

5. **SQLite write contention from new intelligence crons** — per-job mutex guards don't protect against two different jobs writing simultaneously; better-sqlite3 synchronous mode blocks the Node.js thread on locked writes. Prevention: `PRAGMA busy_timeout = 5000` on connection startup, confirm WAL mode active, stagger all new cron schedules explicitly away from existing jobs (self-improvement Sunday 2am, prompt evolution 1st of month 4am, recycling at 6:15am offset from analytics at 6:00am).

---

## Implications for Roadmap

Research drives a clear 7-phase build order based on dependency chains. Phases cannot be reordered without creating rework or missing guard conditions that protect production quality.

### Phase 1: Schema Foundation

**Rationale:** Every v2.0 feature depends on the new tables and columns. No other phase can begin until migrations land and existing cron jobs still pass after migration. This is pure risk reduction — schema changes are safest when the rest of v2.0 code is not yet present to interact with them.
**Delivers:** `brandLearnings`, `promptTemplates`, `commentSuggestions` tables; new columns on `posts` (recycledFromPostId, variantGroup, variantOf, repurposeChainId), `brands` (enableVariants, learningInjection, lastLearningRunAt), `postAnalytics` (promptTemplateId, activeLearningIds). All new columns are nullable or have defaults so existing rows remain valid.
**Avoids:** Migration-caused regressions to the working v1.0 automation pipeline.
**Research flag:** Standard patterns — Drizzle ORM migrations are well-documented; no per-phase research needed.

### Phase 2: Learning Engine (Core Intelligence Loop)

**Rationale:** This is the centerpiece of the v2.0 milestone. Learning validation (v2.1), prompt evolution (v2.2), and analytics enhancements all depend on learnings existing in the database. Building this second maximizes the time the engine has to accumulate learnings before downstream validation features are needed. The diversity lock and human approval gate must be built before the loop is enabled — not retrofitted.
**Delivers:** `learning-engine.ts`, `prompt-injector.ts`, modified `buildSystemPrompt()` and `generateContent()`, threshold-gated learning trigger in `collectAnalytics()` (5+ new top/under posts AND max once per 7 days per brand), weekly learning cron (Sunday 2am), `src/app/actions/learnings.ts` server actions, learnings management UI page at `/brands/[id]/learnings`.
**Addresses:** Self-improvement loop (P1), golden examples curation (P1).
**Avoids:** Goodhart's Law (diversity lock and human approval gate built before loop enabled); data starvation (30-post minimum guard is a prerequisite check, not optional); SQLite contention (schedule offset from analytics cron, threshold gate prevents 4x/day Sonnet calls).
**Research flag:** No additional research needed — ARCHITECTURE.md provides complete data flow diagrams, schema, and code patterns.

### Phase 3: Multi-Variant Generation

**Rationale:** Independent of Phase 2 but benefits from it (learnings are injected into all 3 variants, improving quality across the board). Quality gate already exists from v1.0. Main work is the `generateVariants()` function and brand-level feature flag. Ships a visible quality improvement on every auto-generated post when enabled.
**Delivers:** `generateVariants()` in `generate.ts`, `autoGenerate()` modified to call variants when `brand.enableVariants = 1`, brand settings toggle, variant winner/loser tracking in `posts` table.
**Addresses:** Multi-variant generation (P1 table stakes).
**Uses:** Haiku for generation calls, Sonnet for winner's final quality gate; prompt caching on brand system prompt.
**Avoids:** Cost explosion — document expected cost increase per brand before enabling; recalibrate `MAX_DAILY_AI_SPEND`; tag `ai_spend_log` rows with `feature: 'multi_variant'` for spend breakdown visibility.
**Research flag:** No additional research needed — cost model and API patterns fully documented in STACK.md and PITFALLS.md.

### Phase 4: Content Recycling and Repurposing Chains

**Rationale:** Depends only on Phase 1 (schema) and the existing generation pipeline. Can be built in parallel with Phase 3 if needed. Addresses the evergreen recycling table-stakes expectation. The dedup exemption conflict must be resolved before ship — recycled posts must be flagged to bypass the spam guard's duplicate content check.
**Delivers:** `content-recycler.ts` (weekly cron, Sunday 2am), `repurpose-chain.ts`, `generateRepurposeChain()` server action, "Repurpose as Chain" UI trigger on brand generate page, recycled post lineage tracking via `recycledFromPostId`.
**Addresses:** Evergreen recycling (P2), content repurposing chains (P2).
**Avoids:** Platform duplicate penalties (recycle angle/insight, require new source material, 90-day gap, no image carousels); scheduling collisions (atomic chain slot reservation before any post record is created, max 1 active chain per brand); dedup conflict (presence of `recycledFromPostId` exempts post from spam guard duplicate check).
**Research flag:** Verify Upload-Post `source_url` field behavior on recycled posts during implementation to ensure original post analytics are not mixed with recycled post analytics on the platform side.

### Phase 5: Prompt Evolution

**Rationale:** Explicitly deferred — requires Phase 2 learnings and `postAnalytics.activeLearningIds` tracking to have accumulated 20+ posts worth of attribution data, and requires learning validation infrastructure to have been in place long enough to trust template comparisons. High complexity, lower urgency because golden examples + learnings injection already significantly improve prompts without template evolution.
**Delivers:** `prompt-evolution.ts`, monthly cron (1st of month 4am), 50/50 A/B template routing via `promptTemplateId`, prompt template version history UI on learnings page.
**Addresses:** Prompt evolution (P3 — deferred to v2.2+).
**Avoids:** Prompt regression (shadow mode required before activation, human approval gates every deployment, every template change is a new versioned DB row, previous version reactivatable in one click).
**Research flag:** No additional research needed — ARCHITECTURE.md provides full A/B routing pattern and data flow for prompt evolution.

### Phase 6: Advanced Analytics

**Rationale:** Pure UI feature on existing data — can be moved earlier if chart visibility is wanted sooner. Builds logically after Phase 2 because the learnings panel on the analytics page requires learnings to display. Analytics charts add no write paths and carry no production risk.
**Delivers:** `analytics-charts.tsx` client component (engagement time-series line chart, platform comparison bar chart, posting-time heatmap as CSS grid), extended analytics server page with SQL-aggregated chart data and learnings panel.
**Addresses:** Performance charts (P1), posting-time heatmap (P1), platform comparison (P1).
**Uses:** `recharts@2.15.4` via `npx shadcn add chart` (generates `chart.tsx` wrapper); CSS grid + Tailwind for heatmap (no recharts needed for 7x24 grid). React 19 peer dep fix: add `overrides: { "react-is": "^19.0.0" }` to package.json.
**Avoids:** Client-side data loading trap — SQL aggregation happens server-side before data reaches client; only chart-ready data structures are passed to the client component.
**Research flag:** Standard patterns — recharts + shadcn chart integration is well-documented; no research needed.

### Phase 7: Engagement Helper

**Rationale:** Build last — blocked on external API verification. Upload-Post comment fetch endpoint availability is unconfirmed (only landing page reviewed). All other phases are independent of this feature entirely.
**Delivers:** `engagement-helper.ts`, `commentSuggestions` table writes, "Action Items" card on brand home page, 4-hour polling cadence aligned with existing analytics cron.
**Addresses:** Engagement helper (P1 — low complexity, high perceived value if API is available).
**Avoids:** Reply spam risk (display-only with copy-to-clipboard only, no send automation, max 5 comments surfaced per brand at once, suggested replies include "why this angle" context note for operator evaluation).
**Research flag:** VERIFY FIRST — confirm Upload-Post API comment endpoint returns individual comment text (not just aggregate counts) before writing any implementation code. If the endpoint is unavailable, this phase is removed from scope entirely.

### Phase Ordering Rationale

- Schema first because all new tables must exist before any feature writes to them, and migrations are safest when v2.0 code is not yet present to interact with them.
- Learning engine second because it is the centerpiece and downstream features (validation, prompt evolution) need the learning data it produces.
- Multi-variant third (or in parallel with Phase 4) because it is independent but benefits from learnings being active.
- Recycling and repurposing fourth because they need the dedup exemption decision made explicitly before ship, and can be built independently of the learning loop.
- Prompt evolution fifth because it strictly requires Phase 2 data with attribution and is explicitly lower priority than the core loop.
- Analytics sixth because it is the safest to move — no write paths, only reads, no production risk. Move earlier if chart visibility is wanted sooner.
- Engagement helper last because it is the only phase with a binary external blocker.

### Research Flags

**Phases requiring verification before implementation:**
- **Phase 7 (Engagement Helper):** Verify Upload-Post API comment endpoint returns individual comment text before writing any code. Binary go/no-go decision, not an architecture question. If unavailable, remove from scope.
- **Phase 4 (Recycling):** Verify Upload-Post `source_url` behavior for recycled posts during implementation to confirm analytics isolation.

**Phases with standard patterns (no additional research needed):**
- **Phase 1 (Schema):** Drizzle ORM additive migrations are well-documented and safe.
- **Phase 2 (Learning Engine):** ARCHITECTURE.md provides complete data flows, schema, and code patterns. Build directly from that.
- **Phase 3 (Multi-Variant):** Cost model and API patterns fully documented in STACK.md and PITFALLS.md.
- **Phase 5 (Prompt Evolution):** Full A/B routing pattern documented in ARCHITECTURE.md.
- **Phase 6 (Analytics):** recharts + shadcn chart integration is well-documented with established patterns.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All library decisions verified against official sources and confirmed compatibility. recharts v3 incompatibility with shadcn confirmed via GitHub issue tracking (March 2026). SDK structured outputs GA confirmed via Anthropic docs. recharts React 19 peer dep workaround documented. |
| Features | HIGH | Feature landscape sourced from established tools (Hootsuite, Buffer, SmarterQueue, RecurPost), academic research on few-shot prompting quality lift (15-40% from curated golden examples), direct competitor review, and 2025 platform policy documents. Anti-features validated with model collapse and platform penalty research. |
| Architecture | HIGH | Based on direct codebase inspection of the v1.0 implementation. Integration points, data flows, and component boundaries are derived from actual code in the repository, not inference. All modified files identified with specific change descriptions. |
| Pitfalls | HIGH | Goodhart's Law and feedback loop collapse are well-documented in ML engineering literature. Platform duplicate detection policies sourced from July 2025 TikTok update and Meta 2025 SSCD model documentation. SQLite contention mechanics from better-sqlite3 docs and WAL documentation. A/B testing confounder analysis from social media statistics research. |

**Overall confidence:** HIGH

### Gaps to Address

- **Upload-Post comment API:** Only the landing page was reviewed; full API reference was not accessible. Comment fetch endpoint availability is unconfirmed. Treat Phase 7 as blocked until verified at the start of that phase's implementation.
- **Learning validation thresholds:** Research recommends 10 posts per variant as a minimum for A/B decisions and 30 posts per cohort for learning extraction. These thresholds may need calibration after the first 4-8 weeks of real learning data accumulates. Budget for threshold adjustment during the learning validation phase.
- **recharts peer dependency:** Requires either `--legacy-peer-deps` flag or `overrides: { "react-is": "^19.0.0" }` in package.json. Documented fix exists; apply during Phase 6 setup.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `src/db/schema.ts`, `src/lib/auto-generate.ts`, `src/lib/collect-analytics.ts`, `src/lib/cron.ts`, `src/lib/ai.ts`, `src/app/actions/generate.ts`, `src/app/(dashboard)/brands/[id]/analytics/page.tsx`
- [Anthropic Structured Outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — GA status confirmed, `output_config.format` current API
- [shadcn/ui chart documentation](https://ui.shadcn.com/docs/components/chart) — recharts v2 requirement confirmed
- [shadcn/ui recharts v3 support issue #7669](https://github.com/shadcn-ui/ui/issues/7669) — v3 incompatibility confirmed, PR #8486 not merged as of March 2026
- [recharts npm](https://www.npmjs.com/package/recharts) — version history and v2.15.4 as last stable v2
- [simple-statistics npm](https://www.npmjs.com/package/simple-statistics) — v7.8.9, no deps, typed
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — v0.80.0 current
- better-sqlite3 documentation, SQLite WAL documentation — write contention mechanics

### Secondary (MEDIUM confidence)

- [Finding Golden Examples: Smarter In-Context Learning (Towards Data Science)](https://towardsdatascience.com/finding-golden-examples-a-smarter-approach-to-in-context-learning/) — 15-40% quality lift from curated few-shot examples vs. random
- [A/B Testing LLM Prompts (Braintrust)](https://www.braintrust.dev/articles/ab-testing-llm-prompts) — learning validation patterns for LLM systems
- TikTok July 2025 duplicate content penalty update (Napolify, House of Marketers) — platform recycling risk validation
- Meta/Instagram duplicate detection (SSCD model, perceptual hashing) — MetaGhost 2025
- [SmarterQueue Evergreen Recycling](https://smarterqueue.com/features/evergreen_recycling) — table-stakes confirmation for recycling feature and 90-day cooldown pattern
- [AI Marketing Automation 2026 Guide](https://neuwark.com/blog/ai-marketing-automation-2026-guide) — self-improvement loop patterns in production systems
- [Model Collapse Risk 2025](https://www.winssolutions.org/ai-model-collapse-2025-recursive-training/) — validated anti-feature reasoning for training on AI outputs
- LLM cost optimization (prompt caching, model routing) — SparkCo, UnifiedAIHub 2025

### Tertiary (LOW confidence)

- [Upload-Post API docs](https://docs.upload-post.com/landing/) — landing page only; full API reference for comment fetch endpoint not confirmed. Phase 7 is blocked until this is verified.

---

*Research completed: 2026-03-19*
*Ready for roadmap: yes*
