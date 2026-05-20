// Script idempotente para crear las tablas de sorteos en Turso.
// Uso: node scripts/create-raffles-tables.mjs
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
    console.error("Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN");
    process.exit(1);
}

const client = createClient({ url, authToken });

const statements = [
    `CREATE TABLE IF NOT EXISTS raffles (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        price INTEGER,
        audience TEXT NOT NULL DEFAULT 'all',
        total_numbers INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        starts_at TEXT,
        ends_at TEXT,
        draw_at TEXT,
        cover_image TEXT,
        terms TEXT,
        featured INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS raffles_slug_idx ON raffles(slug)`,
    `CREATE INDEX IF NOT EXISTS raffles_status_idx ON raffles(status)`,

    `CREATE TABLE IF NOT EXISTS raffle_images (
        id TEXT PRIMARY KEY,
        raffle_id TEXT NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        position INTEGER DEFAULT 0,
        is_primary INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS raffle_images_raffle_id_idx ON raffle_images(raffle_id)`,

    `CREATE TABLE IF NOT EXISTS raffle_prizes (
        id TEXT PRIMARY KEY,
        raffle_id TEXT NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS raffle_prizes_raffle_id_idx ON raffle_prizes(raffle_id)`,

    `CREATE TABLE IF NOT EXISTS raffle_entries (
        id TEXT PRIMARY KEY,
        raffle_id TEXT NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
        number INTEGER NOT NULL,
        customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
        guest_name TEXT,
        guest_email TEXT,
        guest_phone TEXT,
        status TEXT NOT NULL,
        reserved_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT,
        paid_at TEXT,
        order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS raffle_entries_raffle_number_unq_idx ON raffle_entries(raffle_id, number) WHERE status != 'cancelled'`,
    `CREATE INDEX IF NOT EXISTS raffle_entries_customer_idx ON raffle_entries(customer_id)`,
    `CREATE INDEX IF NOT EXISTS raffle_entries_status_idx ON raffle_entries(status)`,
    `CREATE INDEX IF NOT EXISTS raffle_entries_order_idx ON raffle_entries(order_id)`,

    `CREATE TABLE IF NOT EXISTS raffle_winners (
        id TEXT PRIMARY KEY,
        raffle_id TEXT NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
        prize_id TEXT NOT NULL REFERENCES raffle_prizes(id) ON DELETE CASCADE,
        entry_id TEXT NOT NULL REFERENCES raffle_entries(id) ON DELETE CASCADE,
        drawn_at TEXT DEFAULT CURRENT_TIMESTAMP,
        notified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS raffle_winners_raffle_idx ON raffle_winners(raffle_id)`,
];

try {
    for (const sql of statements) {
        await client.execute(sql);
        console.log("✓", sql.split("\n")[0].slice(0, 80));
    }
    console.log("\nListo. Tablas de sorteos creadas en Turso.");
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
