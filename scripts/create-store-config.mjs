// Script idempotente para crear store_config con sus valores por defecto.
// Uso: node scripts/create-store-config.mjs
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
    `CREATE TABLE IF NOT EXISTS store_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT
    )`,
    `INSERT INTO store_config (key, value) VALUES ('delivery_fee', '1990')
        ON CONFLICT(key) DO NOTHING`,
    `INSERT INTO store_config (key, value) VALUES ('free_delivery_threshold', '0')
        ON CONFLICT(key) DO NOTHING`,
];

try {
    for (const sql of statements) {
        await client.execute(sql);
        console.log("✓", sql.split("\n")[0].slice(0, 80));
    }
    const rows = await client.execute("SELECT key, value FROM store_config");
    console.log("\nConfiguración actual:");
    for (const r of rows.rows) console.log(`  ${r.key} = ${r.value}`);
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
