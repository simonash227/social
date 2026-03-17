ALTER TABLE `feed_sources` ADD COLUMN `consecutive_failures` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `feed_sources` ADD COLUMN `enabled` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `brands` ADD COLUMN `automation_level` text DEFAULT 'manual';
--> statement-breakpoint
ALTER TABLE `posts` ADD COLUMN `feed_entry_id` integer REFERENCES feed_entries(id);
