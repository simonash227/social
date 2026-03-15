# Feature Research

**Domain:** AI-powered social media content automation (personal tool)
**Researched:** 2026-03-15
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Brand management (CRUD) | Core entity — everything hangs off brands | LOW | Voice, audience, goals, topics, dos/donts |
| Social account connection | Can't publish without connected accounts | MEDIUM | Via Upload-Post API, sync status |
| Manual post creation | Basic content workflow | MEDIUM | Source input → generate → preview → edit → publish |
| Content calendar | Every scheduling tool has one | MEDIUM | Week/month view, drag-and-drop |
| Post scheduling | Core automation feature | MEDIUM | Slot-based with timezone support |
| Publishing to platforms | The whole point | MEDIUM | Via Upload-Post, retry on failure |
| Activity log | Need to know what the system is doing | LOW | Filterable by brand, type, level |
| Simple auth | Protect the dashboard | LOW | Password + session cookie |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI content generation (Claude) | Brand-aware, platform-optimized content | HIGH | Multi-model strategy: Haiku filter, Sonnet critique, Opus generate |
| Title/hook optimization | Single biggest engagement lever | MEDIUM | Generate 5-10 variants, AI self-scores, pick best |
| Self-refine loop | 5-40% quality improvement per post | MEDIUM | Generate → critique → rewrite (conditional) |
| Quality gate | Catches 10-15% below-standard posts | LOW | Sonnet scores 1-10, reject/improve/pass |
| RSS feed automation | Hands-off content discovery | HIGH | Poll → filter → extract → generate → publish pipeline |
| AI image generation | Visual content without designers | MEDIUM | OpenAI GPT Image + brand watermark |
| Carousel generation | High-engagement format, automated | HIGH | Satori + sharp templates with brand styling |
| Automation levels | Gradual trust building | MEDIUM | Manual → semi → mostly → full auto per brand |
| Self-improvement loop (M2) | Content gets better over time | HIGH | Weekly analysis, learnings, prompt evolution |
| Engagement score tracking | Data-driven optimization | MEDIUM | Normalized score across platforms |
| Spam prevention | Account safety | MEDIUM | Staggered posting, jitter, warmup, rate limits |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-reply to comments | "Full automation" | Platforms detect and penalize bot replies, risks account ban | Engagement helper: suggest replies + direct links, human posts them |
| Real-time analytics | "I want to see metrics now" | Engagement data isn't meaningful until 48h+, wastes API calls | Collect every 6 hours, skip posts < 48h old |
| Cross-brand engagement | "My brands should follow each other" | Platforms detect "coordinated inauthentic behavior" networks | Strict isolation between brands |
| Unlimited posting volume | "More posts = more reach" | Platforms throttle/shadowban high-volume accounts | Per-platform daily caps, warmup period |

## Feature Dependencies

```
Brand Management
    └──requires──> Database + Auth

Social Account Connection
    └──requires──> Brand Management
    └──requires──> Upload-Post Client

Content Generation (AI)
    └──requires──> Brand Management (voice, context)
    └──requires──> Claude API Client

Quality Pipeline (refine + gate)
    └──requires──> Content Generation

Content Extraction
    └──requires──> Source libraries (youtube-transcript, article-extractor, pdf-parse)

Image Generation
    └──requires──> OpenAI Client + R2 Storage

Carousel Generation
    └──requires──> Satori + Sharp + R2 Storage
    └──requires──> Brand (colors, logo)

RSS Feed Automation
    └──requires──> Content Generation
    └──requires──> Content Extraction
    └──requires──> Quality Pipeline
    └──requires──> Scheduling

Calendar + Scheduling
    └──requires──> Brand Management
    └──requires──> Auto-publish Cron

Auto-publish
    └──requires──> Upload-Post Client
    └──requires──> Scheduling

Analytics Collection
    └──requires──> Published Posts
    └──requires──> Upload-Post Analytics API

Self-Improvement (M2)
    └──requires──> Analytics Collection (2-4 weeks of data)
    └──requires──> AI Learnings System
```

## MVP Definition

### Launch With (M1)

- [ ] Brand CRUD with full profile (voice, audience, goals, visual style)
- [ ] Upload-Post account connection + publishing
- [ ] Manual post creation (source → generate → preview → publish)
- [ ] AI text generation with brand context + title optimization
- [ ] Self-refine + quality gate
- [ ] Content extraction (YouTube, articles, PDFs)
- [ ] AI image generation with brand watermark
- [ ] Carousel generation (3-5 templates)
- [ ] Content calendar with scheduling
- [ ] RSS feed automation pipeline (discover → filter → generate → publish)
- [ ] Analytics collection (engagement scores)
- [ ] Dashboard (overview, brand home, activity log)
- [ ] Spam prevention (rate limits, jitter, warmup)
- [ ] DB backup to R2

### Add After Validation (M2)

- [ ] Self-improvement loop (weekly analysis → learnings → prompt injection)
- [ ] Multi-variant generation (3 variants, pick best)
- [ ] Prompt evolution (monthly A/B test)
- [ ] Evergreen content recycling
- [ ] Content repurposing chains
- [ ] Engagement helper (comment suggestions + direct links)
- [ ] Bulk pipeline (batch URL processing)
- [ ] Advanced analytics charts

### Future Consideration (v2+)

- [ ] Video generation (Remotion + TTS)
- [ ] Audio transcription (Whisper)
- [ ] Voice cloning (ElevenLabs)
- [ ] Multi-user / SaaS

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Brand management | HIGH | LOW | P1 |
| AI text generation | HIGH | HIGH | P1 |
| RSS feed automation | HIGH | HIGH | P1 |
| Quality pipeline | HIGH | MEDIUM | P1 |
| Auto-publish | HIGH | MEDIUM | P1 |
| Calendar + scheduling | HIGH | MEDIUM | P1 |
| Analytics collection | MEDIUM | MEDIUM | P1 |
| AI images | MEDIUM | MEDIUM | P1 |
| Carousels | MEDIUM | HIGH | P1 |
| Self-improvement | HIGH | HIGH | P2 |
| Multi-variant | MEDIUM | MEDIUM | P2 |
| Engagement helper | MEDIUM | LOW | P2 |
| Video generation | LOW | HIGH | P3 |

## Competitor Feature Analysis

| Feature | Buffer/Hootsuite | Typefully | Our Approach |
|---------|-----------------|-----------|--------------|
| AI generation | Basic suggestions | Thread optimization | Full brand-aware generation with quality pipeline |
| Multi-platform | Yes (manual) | X/LinkedIn only | Automated via Upload-Post (11 platforms) |
| RSS automation | No | No | Full pipeline: discover → filter → generate → publish |
| Self-improvement | No | No | Weekly analysis, learnings injection, prompt evolution |
| Carousels | Manual upload | Template builder | AI-generated from source content |
| Pricing | $15-99/mo | $15-39/mo | Self-hosted, ~$74-131/mo total (including AI costs) |

---
*Feature research for: AI-powered social media content automation*
*Researched: 2026-03-15*
