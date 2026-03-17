CREATE TABLE `scheduling_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`platform` text NOT NULL,
	`hour` integer NOT NULL,
	`minute` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `post_platforms` ADD COLUMN `retry_at` TEXT;
