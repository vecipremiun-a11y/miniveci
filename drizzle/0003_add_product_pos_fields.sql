--> statement-breakpoint
ALTER TABLE products ADD COLUMN offer_price integer;
--> statement-breakpoint
ALTER TABLE products ADD COLUMN is_offer integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE products ADD COLUMN unit text DEFAULT 'Und';
--> statement-breakpoint
ALTER TABLE products ADD COLUMN tax_rate real;
