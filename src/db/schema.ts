import {
  integer,
  text,
  sqliteTable,
} from 'drizzle-orm/sqlite-core'

// ─── Sessions ────────────────────────────────────────────────────────────────
export const sessions = sqliteTable('sessions', {
  id:        integer().primaryKey({ autoIncrement: true }),
  token:     text().notNull().unique(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ─── Brands ──────────────────────────────────────────────────────────────────
export const brands = sqliteTable('brands', {
  id:                integer().primaryKey({ autoIncrement: true }),
  name:              text().notNull(),
  niche:             text().notNull(),
  voiceTone:         text('voice_tone').notNull(),
  targetAudience:    text('target_audience'),
  goals:             text(),
  topics:            text({ mode: 'json' }).$type<string[]>(),
  dosList:           text('dos_list', { mode: 'json' }).$type<string[]>(),
  dontsList:         text('donts_list', { mode: 'json' }).$type<string[]>(),
  examplePosts:      text('example_posts', { mode: 'json' }).$type<string[]>(),
  platformNotes:     text('platform_notes', { mode: 'json' }).$type<Record<string, string>>(),
  ctaText:           text('cta_text'),
  bioTemplate:       text('bio_template'),
  bioLink:           text('bio_link'),
  bannedHashtags:    text('banned_hashtags', { mode: 'json' }).$type<string[]>(),
  primaryColor:      text('primary_color'),
  secondaryColor:    text('secondary_color'),
  logoUrl:           text('logo_url'),
  watermarkPosition: text('watermark_position', {
    enum: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
  }),
  watermarkOpacity:  integer('watermark_opacity'),
  warmupDate:        text('warmup_date'),
  createdAt:         text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt:         text('updated_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ─── Social Accounts ─────────────────────────────────────────────────────────
export const socialAccounts = sqliteTable('social_accounts', {
  id:                  integer().primaryKey({ autoIncrement: true }),
  brandId:             integer('brand_id').notNull().references(() => brands.id),
  platform:            text().notNull(),
  username:            text().notNull(),
  status:              text({ enum: ['connected', 'disconnected'] }).notNull().default('connected'),
  failureCount:        integer('failure_count').notNull().default(0),
  uploadPostUsername:  text('upload_post_username'),
  createdAt:           text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ─── Feed Sources ─────────────────────────────────────────────────────────────
export const feedSources = sqliteTable('feed_sources', {
  id:                 integer().primaryKey({ autoIncrement: true }),
  brandId:            integer('brand_id').notNull().references(() => brands.id),
  url:                text().notNull(),
  type:               text({ enum: ['rss', 'youtube', 'reddit', 'google_news'] }).notNull(),
  pollInterval:       integer('poll_interval'),
  relevanceThreshold: integer('relevance_threshold'),
  targetPlatforms:    text('target_platforms', { mode: 'json' }).$type<string[]>(),
  createdAt:          text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ─── Quality Details ──────────────────────────────────────────────────────────
export interface QualityDetails {
  hook:        { score: number; note: string }
  value:       { score: number; note: string }
  voice:       { score: number; note: string }
  uniqueness:  { score: number; note: string }
  platformFit: { score: number; note: string }
}

// ─── Posts ────────────────────────────────────────────────────────────────────
export const posts = sqliteTable('posts', {
  id:           integer().primaryKey({ autoIncrement: true }),
  brandId:      integer('brand_id').notNull().references(() => brands.id),
  sourceUrl:    text('source_url'),
  sourceText:   text('source_text'),
  content:      text().notNull(),
  status:       text({ enum: ['draft', 'scheduled', 'published', 'failed'] }).notNull().default('draft'),
  qualityScore:   integer('quality_score'),
  qualityDetails: text('quality_details', { mode: 'json' }).$type<QualityDetails | null>(),
  requestId:    text('request_id'),
  scheduledAt:  text('scheduled_at'),
  publishedAt:  text('published_at'),
  createdAt:    text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ─── Post Platforms ───────────────────────────────────────────────────────────
export const postPlatforms = sqliteTable('post_platforms', {
  id:           integer().primaryKey({ autoIncrement: true }),
  postId:       integer('post_id').notNull().references(() => posts.id),
  platform:     text().notNull(),
  content:      text(),  // nullable -- platform-specific AI-generated content
  status:       text({ enum: ['pending', 'published', 'failed'] }).notNull().default('pending'),
  failureCount: integer('failure_count').notNull().default(0),
  requestId:    text('request_id'),
})

// ─── Generated Images ─────────────────────────────────────────────────────────
export const generatedImages = sqliteTable('generated_images', {
  id:        integer().primaryKey({ autoIncrement: true }),
  brandId:   integer('brand_id').notNull().references(() => brands.id),
  postId:    integer('post_id').references(() => posts.id), // nullable -- image can exist without a post
  prompt:    text().notNull(),
  fullKey:   text('full_key').notNull(),     // R2 key for full-size image
  thumbKey:  text('thumb_key').notNull(),    // R2 key for 400px thumbnail
  r2Bucket:  text('r2_bucket').notNull(),
  costUsd:   text('cost_usd').notNull(),
  type:      text({ enum: ['generated'] }).notNull().default('generated'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ─── Carousels ────────────────────────────────────────────────────────────────
export const carousels = sqliteTable('carousels', {
  id:         integer().primaryKey({ autoIncrement: true }),
  brandId:    integer('brand_id').notNull().references(() => brands.id),
  postId:     integer('post_id').references(() => posts.id),  // nullable -- association with posts done later
  templateId: text('template_id').notNull(),                   // 'minimal' | 'bold' | 'gradient'
  sourceText: text('source_text'),
  slideCount: integer('slide_count').notNull(),
  status:     text({ enum: ['draft', 'ready'] }).notNull().default('draft'),
  createdAt:  text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

export const carouselSlides = sqliteTable('carousel_slides', {
  id:          integer().primaryKey({ autoIncrement: true }),
  carouselId:  integer('carousel_id').notNull().references(() => carousels.id),
  slideIndex:  integer('slide_index').notNull(),   // 0-based
  title:       text().notNull(),
  body:        text(),
  r2Key:       text('r2_key').notNull(),           // R2 key for slide PNG
  thumbKey:    text('thumb_key'),                   // 400px JPEG thumbnail
  createdAt:   text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ─── Feed Entries ─────────────────────────────────────────────────────────────
export const feedEntries = sqliteTable('feed_entries', {
  id:             integer().primaryKey({ autoIncrement: true }),
  feedSourceId:   integer('feed_source_id').notNull().references(() => feedSources.id),
  url:            text().notNull().unique(),
  title:          text(),
  relevanceScore: integer('relevance_score'),
  processedAt:    text('processed_at'),
  createdAt:      text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ─── Activity Log ─────────────────────────────────────────────────────────────
export const activityLog = sqliteTable('activity_log', {
  id:        integer().primaryKey({ autoIncrement: true }),
  brandId:   integer('brand_id').references(() => brands.id),
  type:      text().notNull(),
  level:     text({ enum: ['info', 'warn', 'error'] }).notNull().default('info'),
  message:   text().notNull(),
  metadata:  text({ mode: 'json' }),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})

// ─── AI Spend Log ─────────────────────────────────────────────────────────────
export const aiSpendLog = sqliteTable('ai_spend_log', {
  id:           integer().primaryKey({ autoIncrement: true }),
  brandId:      integer('brand_id').references(() => brands.id),
  model:        text().notNull(),
  inputTokens:  integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  costUsd:      text('cost_usd').notNull(),
  date:         text().notNull(),
  createdAt:    text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
})
