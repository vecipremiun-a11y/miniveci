// Migración idempotente: tabla refresh_tokens para mobile auth (JWT rotativos).
// Uso: node scripts/create-refresh-tokens-table.mjs
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
    `CREATE TABLE IF NOT EXISTS refresh_tokens (
        jti TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_type TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens(user_id)`,
    `CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx ON refresh_tokens(expires_at)`,
];

try {
    for (const sql of statements) {
        await client.execute(sql);
        console.log("✓", sql.split("\n")[0].slice(0, 80));
    }
    console.log("\nListo.");
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
