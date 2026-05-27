/**
 * Crea la tabla bakery_categories y siembra las 5 categorías originales.
 *
 * Uso:
 *   npm run db:migrate:bakery-categories
 *
 * Idempotente: CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE por slug.
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;
    const content = fs.readFileSync(envPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eqIdx = line.indexOf("=");
        if (eqIdx < 0) continue;
        const key = line.substring(0, eqIdx).trim();
        let val = line.substring(eqIdx + 1);
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.substring(1, val.length - 1);
        }
        if (!process.env[key]) process.env[key] = val;
    }
}

loadEnvLocal();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
    console.error("Falta TURSO_DATABASE_URL o TURSO_AUTH_TOKEN.");
    process.exit(1);
}

const client = createClient({ url, authToken });

await client.execute(`CREATE TABLE IF NOT EXISTS bakery_categories (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
)`);
console.log("✅ tabla bakery_categories lista");

await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS bakery_categories_slug_idx ON bakery_categories(slug)");
await client.execute("CREATE INDEX IF NOT EXISTS bakery_categories_active_idx ON bakery_categories(active)");

const now = "2026-05-26T00:00:00.000Z";
const seed = [
    ["bcat_pan", "pan", "Pan", 0],
    ["bcat_sandwich", "sandwich", "Sándwich", 1],
    ["bcat_hamburguesa", "hamburguesa", "Hamburguesa", 2],
    ["bcat_canape", "canape", "Canapé", 3],
    ["bcat_dulce", "dulce", "Dulce", 4],
];
for (const [id, slug, label, sortOrder] of seed) {
    await client.execute({
        sql: "INSERT OR IGNORE INTO bakery_categories (id, slug, label, sort_order, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
        args: [id, slug, label, sortOrder, now],
    });
}
console.log("✅ categorías semilla sembradas (pan, sandwich, hamburguesa, canape, dulce)");

console.log("\nMigración completa.");
process.exit(0);
