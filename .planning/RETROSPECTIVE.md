# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — Working Engine

**Shipped:** 2026-03-18
**Phases:** 9 | **Plans:** 28 | **Timeline:** 4 days (estimated 16.5)

### What Was Built
- Full autonomous content pipeline: RSS discovery → Haiku filtering → content extraction → Claude generation → self-refine → quality gate → slot scheduling → Upload-Post publishing
- Brand management with voice profiles, visual styles, social account connection
- Content generation UI with preview, editing, image generation, carousel templates
- Calendar with week/month views, drag-and-drop rescheduling, auto-publish with retry logic
- Spam prevention: rate limits, warmup periods, cross-platform staggering, dedup
- Analytics collection with engagement scoring, percentile classification, monitoring dashboard
- Infrastructure: SQLite + WAL, daily R2 backup, circuit breaker, AI spend tracking

### What Worked
- **Validation spike (Phase 0)** caught all infrastructure risks early — every assumption was confirmed before building
- **GSD workflow** kept phases focused and prevented scope creep — 67 requirements mapped cleanly to 9 phases
- **Server component / client component split pattern** established in Phase 1 carried through all UI phases consistently
- **Module-level AI client singletons** (Anthropic, OpenAI) worked well — one instantiation per process
- **Human verification plans** (Phases 2A-03, 05-03, 06-04, 07-03) caught real issues before moving on

### What Was Inefficient
- **drizzle-kit snapshot lineage** broke multiple times (Phases 4, 6) requiring manual repair — fragile tooling
- **shadcn v4 + base-ui API** caused friction — asChild vs render prop differences, Trigger component behavior inconsistencies
- **openai SDK v6 regression** forced downgrade to v4 — wasted time debugging gpt-image-1 b64_json extraction
- **ROADMAP.md plan checkboxes** fell out of sync with actual completion state in later phases — manual tracking gap

### Patterns Established
- Server page.tsx + client section.tsx component split for interactive features
- Cron init via health endpoint (not instrumentation.ts) for Next.js standalone mode
- Activity log table for observability without external logging infrastructure
- `serverExternalPackages` in next.config.ts for all Node.js-only packages (better-sqlite3, node-cron, rss-parser, openai)
- Satori object-vnode style (not JSX) for carousel templates
- UTC-based slot matching with jitter for scheduling
- globalThis mutex for cron overlap prevention

### Key Lessons
1. **Validate infrastructure before building** — the Phase 0 spike prevented at least 3 deal-breaker surprises (font format, SDK compatibility, standalone mode limitations)
2. **drizzle-kit snapshot lineage is fragile** — always verify migration chain after schema changes; keep manual repair steps documented
3. **Pin SDK versions aggressively** — openai v6 and @aws-sdk checksum changes both caused production-blocking regressions
4. **Next.js standalone mode has sharp edges** — instrumentation.ts doesn't work, many packages need explicit externalization
5. **Quality pipeline conditional skip saves cost** — posts scoring >= 8 skip self-refine, avoiding unnecessary API calls

### Cost Observations
- Model mix: primarily sonnet-based (GSD balanced profile)
- AI_MODE=testing used throughout development to minimize API costs
- Notable: 4-day completion vs 16.5-day estimate — GSD workflow + parallel agent execution dramatically compressed timeline

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Timeline | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | 4 days | 9 | First milestone — established patterns |

### Cumulative Quality

| Milestone | LOC | Files | Requirements |
|-----------|-----|-------|-------------|
| v1.0 | 13,213 | 215 | 67/67 |

### Top Lessons (Verified Across Milestones)

1. Infrastructure validation spikes prevent expensive late-stage surprises
2. Pin SDK versions — minor bumps can break production flows
