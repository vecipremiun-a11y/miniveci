CREATE TABLE `customers` (
    `id` text PRIMARY KEY NOT NULL,
    `email` text NOT NULL,
    `password_hash` text NOT NULL,
    `first_name` text NOT NULL,
    `last_name` text NOT NULL,
    `phone` text NOT NULL,
    `rut` text,
    `address` text,
    `comuna` text,
    `city` text DEFAULT 'Santiago',
    `address_notes` text,
    `active` integer DEFAULT true,
    `created_at` text DEFAULT CURRENT_TIMESTAMP,
    `updated_at` text DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX `customers_email_unique` ON `customers` (`email`);
CREATE INDEX `customer_email_idx_unique` ON `customers` (`email`);

-- Add customer_id column to orders table
ALTER TABLE `orders` ADD COLUMN `customer_id` text REFERENCES `customers`(`id`);
