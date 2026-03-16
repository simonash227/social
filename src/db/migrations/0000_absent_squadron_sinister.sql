CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer,
	`type` text NOT NULL,
	`level` text DEFAULT 'info' NOT NULL,
	`message` text NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ai_spend_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer,
	`model` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cost_usd` text NOT NULL,
	`date` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `brands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`niche` text NOT NULL,
	`voice_tone` text NOT NULL,
	`target_audience` text,
	`goals` text,
	`topics` text,
	`dos_list` text,
	`donts_list` text,
	`example_posts` text,
	`platform_notes` text,
	`cta_text` text,
	`bio_template` text,
	`bio_link` text,
	`banned_hashtags` text,
	`primary_color` text,
	`secondary_color` text,
	`logo_url` text,
	`watermark_position` text,
	`watermark_opacity` integer,
	`warmup_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feed_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`feed_source_id` integer NOT NULL,
	`url` text NOT NULL,
	`title` text,
	`relevance_score` integer,
	`processed_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`feed_source_id`) REFERENCES `feed_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feed_entries_url_unique` ON `feed_entries` (`url`);--> statement-breakpoint
CREATE TABLE `feed_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`url` text NOT NULL,
	`type` text NOT NULL,
	`poll_interval` integer,
	`relevance_threshold` integer,
	`target_platforms` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `post_platforms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`platform` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`request_id` text,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`source_url` text,
	`source_text` text,
	`content` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`quality_score` integer,
	`request_id` text,
	`scheduled_at` text,
	`published_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `social_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`platform` text NOT NULL,
	`username` text NOT NULL,
	`status` text DEFAULT 'connected' NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`upload_post_username` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
