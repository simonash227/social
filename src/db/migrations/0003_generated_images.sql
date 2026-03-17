CREATE TABLE `generated_images` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `brand_id` integer NOT NULL REFERENCES `brands`(`id`),
  `post_id` integer REFERENCES `posts`(`id`),
  `prompt` text NOT NULL,
  `full_key` text NOT NULL,
  `thumb_key` text NOT NULL,
  `r2_bucket` text NOT NULL,
  `cost_usd` text NOT NULL,
  `type` text NOT NULL DEFAULT 'generated',
  `created_at` text NOT NULL
);
