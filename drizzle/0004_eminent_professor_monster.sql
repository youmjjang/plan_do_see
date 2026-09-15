CREATE TABLE `profile_photos` (
	`user_id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`mime` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON UPDATE no action ON DELETE no action
);
