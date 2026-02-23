import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) throw new Error("Missing env vars");

    const client = createClient({ url, authToken });

    const queries = [
        `CREATE TABLE IF NOT EXISTS categories (
            id text PRIMARY KEY NOT NULL, name text NOT NULL, slug text NOT NULL, description text, image_url text, parent_id text, sort_order integer DEFAULT 0, is_active integer DEFAULT true, sync_price_source text DEFAULT 'global', sync_stock_source text DEFAULT 'global', created_at text DEFAULT CURRENT_TIMESTAMP, updated_at text DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS order_items (
            id text PRIMARY KEY NOT NULL, order_id text, product_id text, product_name text NOT NULL, product_sku text NOT NULL, quantity integer NOT NULL, unit_price integer NOT NULL, total_price integer NOT NULL, stock_source text, created_at text DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (order_id) REFERENCES orders(id) ON UPDATE no action ON DELETE cascade, FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE no action ON DELETE no action
        )`,
        `ALTER TABLE categories ADD COLUMN sync_price_source text DEFAULT 'global'`,
        `ALTER TABLE categories ADD COLUMN sync_stock_source text DEFAULT 'global'`,
        `ALTER TABLE products ADD COLUMN price_source text DEFAULT 'global'`,
        `ALTER TABLE products ADD COLUMN stock_source text DEFAULT 'global'`,
        `CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_unique ON categories (slug)`
    ];

    for (const q of queries) {
        try {
            await client.execute(q);
            console.log("SUCCESS:", q.substring(0, 50));
        } catch (e: any) {
            console.log("SKIPPED (likely exists):", e.message);
        }
    }

    console.log("Database schema fix applied.");
    process.exit(0);
}
main();
