// Script idempotente para crear la tabla de presencia de visitantes en Turso.
// Uso: node scripts/create-visitor-sessions.mjs
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
    `CREATE TABLE IF NOT EXISTS chat_visitor_sessions (
        id TEXT PRIMARY KEY,
        guest_id TEXT NOT NULL,
        customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        page_views INTEGER NOT NULL DEFAULT 1,
        current_path TEXT,
        page_title TEXT,
        landing_path TEXT,
        referrer TEXT,
        ip TEXT,
        country TEXT,
        country_region TEXT,
        city TEXT,
        timezone TEXT,
        latitude REAL,
        longitude REAL,
        user_agent TEXT,
        device TEXT,
        browser TEXT,
        os TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS visitor_sessions_guest_id_idx ON chat_visitor_sessions(guest_id)`,
    `CREATE INDEX IF NOT EXISTS visitor_sessions_last_seen_idx ON chat_visitor_sessions(last_seen_at)`,
    `CREATE INDEX IF NOT EXISTS visitor_sessions_customer_idx ON chat_visitor_sessions(customer_id)`,
];

try {
    for (const sql of statements) {
        await client.execute(sql);
        console.log("✓", sql.split("\n")[0].slice(0, 80));
    }
    console.log("\nListo. Tabla chat_visitor_sessions creada en Turso.");
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
