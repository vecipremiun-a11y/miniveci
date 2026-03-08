CREATE TABLE `api_credentials` (
	`id` text PRIMARY KEY DEFAULT 'main' NOT NULL,
	`client_id` text NOT NULL,
	`client_secret` text NOT NULL,
	`pos_webhook_url` text NOT NULL,
	`webhook_secret` text NOT NULL DEFAULT ''
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_credentials_client_id_unique` ON `api_credentials` (`client_id`);
