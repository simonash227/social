CREATE TABLE `carousels` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_id` integer NOT NULL,
	`post_id` integer,
	`template_id` text NOT NULL,
	`source_text` text,
	`slide_count` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `carousel_slides` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`carousel_id` integer NOT NULL,
	`slide_index` integer NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`r2_key` text NOT NULL,
	`thumb_key` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`carousel_id`) REFERENCES `carousels`(`id`) ON UPDATE no action ON DELETE no action
);
