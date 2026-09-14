CREATE TABLE `completions` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`cycle` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `completion_task_cycle` ON `completions` (`task_id`,`cycle`);--> statement-breakpoint
CREATE TABLE `executions` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`minutes` integer NOT NULL,
	`blocked` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`completion_key` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `executions_task` ON `executions` (`task_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `execution_completion_key` ON `executions` (`completion_key`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`priority` integer NOT NULL,
	`success` text NOT NULL,
	`estimate` integer NOT NULL,
	`improvement` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`improvement` text NOT NULL,
	`next_plan_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`next_plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `plan_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `revision_plan_version` ON `plan_revisions` (`plan_id`,`version`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text NOT NULL,
	`priority` integer NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`estimate` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`cycle` integer DEFAULT 0 NOT NULL,
	`deleted_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `tasks_plan_due` ON `tasks` (`plan_id`,`due_date`);