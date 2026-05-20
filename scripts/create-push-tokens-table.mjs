/**
 * Crea la tabla `user_push_tokens` en Turso.
 *
 * Uso:
 *   node --env-file=.env.local scripts/create-push-tokens-table.mjs
 *
 * Idempotente: usa CREATE TABLE IF NOT EXISTS. Seguro re-ejecutar.
 */
import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
    console.error("❌ Falta TURSO_DATABASE_URL o TURSO_AUTH_TOKEN en el entorno.");
    console.error("   Corré con: node --env-file=.env.local scripts/create-push-tokens-table.mjs");
    process.exit(1);
}

const client = createClient({ url, authToken });

const statements = [
    `CREATE TABLE IF NOT EXISTS user_push_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        platform TEXT NOT NULL DEFAULT 'android',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS user_push_tokens_user_token_idx
        ON user_push_tokens (user_id, token)`,
    `CREATE INDEX IF NOT EXISTS user_push_tokens_user_idx
        ON user_push_tokens (user_id)`,
];

for (const sql of statements) {
    await client.execute(sql);
}

console.log("✅ Tabla user_push_tokens lista (con índices user+token único y user).");
process.exit(0);
