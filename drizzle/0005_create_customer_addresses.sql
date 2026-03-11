CREATE TABLE IF NOT EXISTS `customer_addresses` (
    `id` text PRIMARY KEY NOT NULL,
    `customer_id` text NOT NULL REFERENCES `customers`(`id`) ON DELETE CASCADE,
    `label` text NOT NULL DEFAULT 'Casa',
    `address` text NOT NULL,
    `comuna` text NOT NULL,
    `city` text NOT NULL DEFAULT 'Santiago',
    `address_notes` text,
    `is_default` integer DEFAULT false,
    `created_at` text DEFAULT CURRENT_TIMESTAMP,
    `updated_at` text DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS `customer_address_customer_id_idx` ON `customer_addresses` (`customer_id`);
