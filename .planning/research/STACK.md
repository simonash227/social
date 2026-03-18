# Stack Research

**Domain:** Intelligence layer for AI-powered social media content engine (v2.0 milestone)
**Researched:** 2026-03-19
**Confidence:** HIGH

## Context: New Additions Only

This document covers ONLY what is NEW for v2.0. The existing v1.0 stack (Next.js 15, SQLite + drizzle-orm, node-cron, @anthropic-ai/sdk, OpenAI, Satori + sharp, Cloudflare R2, Tailwind v4 + shadcn/ui v4) is validated and unchanged.

---

## Recommended Stack

### Core Technologies (NEW)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| recharts | 2.15.4 | Analytics charts (line, bar, area, pie) | shadcn/ui chart component is built on recharts v2. Recharts v3 breaks shadcn chart.tsx (confirmed bug March 2026, PR #8486 not merged). Pin to v2 to stay compatible with `npx shadcn add chart`. |
| simple-statistics | 7.8.9 | Percentile ranking for golden examples | Pure JS, no deps, tree-shakeable. Provides `quantile()` and `mean()` — exactly what's needed to find 90th-percentile posts. No other library needed for the statistics used here. |

### Supporting Libraries (NEW)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @anthropic-ai/sdk | 0.80.0 | Structured outputs via `output_config.format` | Upgrade from 0.79.0. Enables GA structured outputs (no beta header needed). Use for self-improvement analysis where schema-guaranteed JSON is critical — learnings, variant scoring, prompt suggestions. |

### Development Tools (NO CHANGE)

No new dev tools required. All intelligence features are:
- Data stored in SQLite via existing drizzle-orm schema (new tables, not new libraries)
- AI calls via existing @anthropic-ai/sdk (upgraded version)
- Cron jobs via existing node-cron
- UI via existing shadcn/ui components + recharts (new addition)

---

## Installation

```bash
# Charts (pin to v2 — v3 breaks shadcn chart component as of March 2026)
npm install recharts@2.15.4

# Add shadcn chart component (generates src/components/ui/chart.tsx, wraps recharts)
npx shadcn add chart

# Statistics (percentile ranking for golden examples curation)
npm install simple-statistics

# Upgrade Anthropic SDK for GA structured outputs
npm install @anthropic-ai/sdk@latest
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| recharts v2 + shadcn chart | recharts v3 directly | When shadcn chart.tsx is updated to support v3 (watch issue #7669). Not yet — v3 breaks TooltipProps type API used by shadcn. |
| recharts v2 + shadcn chart | Tremor | If you want a full dashboard component suite with zero chart wiring. Overkill here — shadcn/recharts is already 80% done for this use case. |
| recharts v2 + shadcn chart | Chart.js + react-chartjs-2 | If you need canvas-based rendering (e.g., for export). SVG-based recharts is better for React integration. |
| simple-statistics | Native Array math (sort + index) | For the percentile math here (single field, <10K rows), inline math is equally fine. simple-statistics reduces bugs for non-trivial statistical work like Pearson correlation if needed later. |
| @uiw/react-heat-map | Custom CSS grid heatmap | The posting time heatmap (7 days × 24 hours) is a 168-cell grid, trivially built with a CSS grid + Tailwind color classes. No external library needed. See "What NOT to Use" below. |
| Existing @anthropic-ai/sdk (upgraded) | Vercel AI SDK | If you need streaming UI, useChat hooks. Not needed here — all AI calls are server-side background jobs. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| recharts@^3 | shadcn chart.tsx uses TooltipProps<ValueType, NameType> which was renamed in v3 (TooltipContentProps). Bug confirmed March 8, 2026. Will cause type errors and runtime issues. | recharts@2.15.4 — pin the major version |
| @uiw/react-heat-map | React 19 compatibility unconfirmed. The posting-time heatmap (7×24 day/hour grid) doesn't match its calendar format (GitHub contribution graph style). Adds 50KB+ for a trivial grid. | Tailwind CSS grid with Recharts-matched color tokens — 20 lines of JSX |
| react-calendar-heatmap | Last published 1+ year ago, unmaintained, React 16 era. Same React 19 uncertainty. | Same as above — CSS grid |
| External A/B testing libraries (GrowthBook, Statsig, Optimizely) | SaaS cost, external dependency, massive overkill for a single-user tool. A/B testing learnings here is: track_learning_active boolean + weekly cron comparison, not statistical significance testing. | SQLite schema: `learnings` table with `is_active` + `applied_count` + `avg_engagement_delta` columns |
| Vector databases (pgvector, Pinecone, Chroma) | Not needed for this intelligence layer. Golden examples are stored as text in SQLite. Semantic search is not required — rank by engagement score and recency. | SQLite `ORDER BY engagement_score DESC LIMIT N` |
| LangChain / LangGraph | Heavy abstraction over Claude API that the project already uses directly. Intelligence loop is a set of cron jobs with prompt templates, not an agent graph. | Direct @anthropic-ai/sdk with structured outputs |

---

## Stack Patterns by Feature

**Self-improvement loop (weekly analysis):**
- node-cron job (weekly) calls Claude with recent post data as JSON
- Use `output_config.format` (structured outputs, GA) to get schema-guaranteed JSON learnings
- Store learnings in new `content_learnings` SQLite table
- Inject active learnings into existing generation prompt via string template

**Golden examples curation:**
- simple-statistics `quantile(engagementScores, 0.90)` to find 90th percentile threshold
- Posts above threshold: flag as `is_golden_example = 1` in existing `posts` table (new column)
- Inject top-N golden examples into Claude prompt as few-shot examples

**Multi-variant generation:**
- No new library — call existing `generateContent()` 3× with temperature variation
- Store variants in new `content_variants` SQLite table
- Quality gate picks highest scorer; discard others

**Prompt evolution (monthly):**
- node-cron job (monthly) asks Claude to suggest prompt template improvements based on learnings
- Store versioned templates in new `prompt_templates` SQLite table with `version`, `is_active`, `created_at`
- A/B test: 50% of generations use current template, 50% use candidate template
- After 4 weeks: compare avg engagement, promote winner, retire loser

**Evergreen recycling:**
- Weekly cron: query posts WHERE `is_golden_example = 1` AND last scheduled > 90 days ago
- Generate "fresh angle" variant: pass original content + "write a new take" instruction to Claude
- Schedule as new post with `recycled_from_post_id` FK for lineage tracking

**Engagement helper:**
- Upload-Post API does not document a comments-fetch endpoint (confirmed March 2026)
- Implementation: fetch post URLs from existing analytics data, display direct platform links to comments section
- Suggested replies: send post text + brand voice to Claude → get 3 reply options → user copies and posts manually
- No new library needed — this is a UI component + Claude API call

**Advanced analytics charts:**
- Use `npx shadcn add chart` to scaffold chart.tsx (recharts v2 wrapper)
- Line chart: engagement score over time per brand (recharts `<LineChart>`)
- Bar chart: platform comparison, post type breakdown (recharts `<BarChart>`)
- Area chart: posting volume over time (recharts `<AreaChart>`)
- Posting time heatmap: custom 7×24 CSS grid, colored by avg engagement — no recharts needed

---

## Structured Outputs Upgrade

The project currently uses prompt-based JSON extraction with fallback parsing. The @anthropic-ai/sdk 0.80.0 enables GA structured outputs for analysis-heavy tasks:

```typescript
// Use for weekly self-improvement analysis where malformed JSON = silent failure
const response = await client.messages.create({
  model: 'claude-sonnet-4-5',
  max_tokens: 2048,
  messages: [{ role: 'user', content: analysisPrompt }],
  output_config: {
    format: {
      type: 'json_schema',
      schema: learningSuggestionSchema  // Zod-compatible JSON schema
    }
  }
});
// response.content[0].text is guaranteed valid JSON — no try/catch needed
```

**When to use structured outputs vs. prompt-based JSON:**
- Use `output_config.format` for: weekly analysis, learning suggestions, prompt evolution proposals
- Keep prompt-based JSON for: content generation, hook variants, quality scoring (already working, don't touch)
- Supported models: claude-sonnet-4-5, claude-opus-4-5, claude-haiku-4-5, claude-opus-4-6, claude-sonnet-4-6

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| recharts@2.15.4 | React 19 | Works with `--legacy-peer-deps` flag or `overrides` in package.json. shadcn has documented this workaround. |
| recharts@2.15.4 | shadcn chart component | This is the version shadcn chart.tsx targets. Do not upgrade to v3 until shadcn releases updated chart.tsx. |
| simple-statistics@7.8.9 | Node.js 22, TypeScript 5 | Pure ESM/CJS, no peer deps, typed. Import specific functions to tree-shake. |
| @anthropic-ai/sdk@0.80.0 | Next.js 15, existing prompts | Drop-in upgrade. `output_config.format` is additive — existing calls without it are unchanged. |

**If recharts v2 peer dep warning with React 19:**
```json
// package.json — add this to silence warning without --legacy-peer-deps
{
  "overrides": {
    "react-is": "^19.0.0"
  }
}
```

---

## What Requires NO New Libraries

| Feature | Implementation | Why No Library Needed |
|---------|---------------|----------------------|
| Self-improvement loop | SQLite table + Claude API + node-cron | Already have all three |
| Learning validation (A/B test) | SQLite `is_active` flag + weekly cron comparison | Simple percentage comparison, not statistical hypothesis testing |
| Content recycling | SQLite query + existing Claude generation | Filter by `is_golden_example`, pass to existing `generateContent()` |
| Repurposing chains | SQLite `repurposing_chain_id` FK + existing pipeline | Same generation code, different source metadata |
| Engagement helper replies | Claude API call + UI component | No special library — Claude generates replies from post text |
| Posting time heatmap | CSS grid + Tailwind | 168-cell grid colored by value — pure CSS |
| Percentile calculation | simple-statistics or inline `sort + index` | 5 lines of code either way |

---

## Sources

- [recharts npm](https://www.npmjs.com/package/recharts) — v3.8.0 latest, v2.15.4 last v2 stable (HIGH confidence)
- [shadcn/ui Support Recharts v3 issue #7669](https://github.com/shadcn-ui/ui/issues/7669) — v3 not yet supported in shadcn chart component (HIGH confidence, March 2026)
- [shadcn/ui chart documentation](https://ui.shadcn.com/docs/components/chart) — built on recharts v2, v3 upgrade in progress (HIGH confidence)
- [Anthropic Structured Outputs docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) — GA, no beta header needed, `output_config.format` is current API (HIGH confidence)
- [simple-statistics npm](https://www.npmjs.com/package/simple-statistics) — v7.8.9, no deps (HIGH confidence)
- [@anthropic-ai/sdk npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — v0.80.0 latest (HIGH confidence)
- [Upload-Post API docs](https://docs.upload-post.com/landing/) — no comments-fetch endpoint documented (MEDIUM confidence — landing page only, full API reference not reviewed)
- WebSearch: recharts v3 breaking changes, shadcn compatibility — multiple sources confirm v3 is not yet compatible with shadcn chart.tsx as of March 2026 (HIGH confidence)

---

*Stack research for: v2.0 Intelligence Layer — self-improvement, analytics charts, engagement helper*
*Researched: 2026-03-19*
