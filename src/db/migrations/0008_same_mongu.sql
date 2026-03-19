CREATE TABLE `brand_learnings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`platform` text,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`confidence` text NOT NULL,
	`supporting_post_ids` text,
	`is_active` integer DEFAULT 1 NOT NULL,
	`ab_test_group` text,
	`validated_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `comment_suggestions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`platform` text NOT NULL,
	`post_id` integer NOT NULL,
	`comment_text` text NOT NULL,
	`suggested_reply` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prompt_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`platform` text,
	`template_text` text NOT NULL,
	`version` integer NOT NULL,
	`is_active` integer DEFAULT 0 NOT NULL,
	`suggested_by_model` text NOT NULL,
	`performance_score` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `brands` ADD `enable_variants` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `brands` ADD `learning_injection` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `brands` ADD `last_learning_run_at` text;--> statement-breakpoint
ALTER TABLE `post_analytics` ADD `prompt_template_id` integer REFERENCES prompt_templates(id);--> statement-breakpoint
ALTER TABLE `post_analytics` ADD `active_learning_ids` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `recycled_from_post_id` integer REFERENCES posts(id);--> statement-breakpoint
ALTER TABLE `posts` ADD `variant_of` integer REFERENCES posts(id);--> statement-breakpoint
ALTER TABLE `posts` ADD `variant_group` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `repurpose_chain_id` text;