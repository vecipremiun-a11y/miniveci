CREATE TABLE IF NOT EXISTS `customer_payment_methods` (
    `id` text PRIMARY KEY NOT NULL,
    `customer_id` text NOT NULL REFERENCES `customers`(`id`) ON DELETE CASCADE,
    `mp_customer_id` text,
    `mp_card_id` text,
    `brand` text,
    `last_four_digits` text,
    `expiration_month` integer,
    `expiration_year` integer,
    `cardholder_name` text,
    `is_default` integer DEFAULT 0,
    `created_at` text DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS `cpm_customer_id_idx` ON `customer_payment_methods` (`customer_id`);
