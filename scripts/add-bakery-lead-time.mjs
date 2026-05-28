/**
 * Agrega lead_time_hours a bakery_products y baja el mínimo general a 4h.
 *
 * Uso:
 *   npm run db:migrate:bakery-lead-time
 *
 * Idempotente: chequea la columna antes de agregar; upsert de min_hours_ahead=4.
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

const cols = await client.execute("PRAGMA table_info(bakery_products)");
const existing = new Set(cols.rows.map((r) => r.name));

if (!existing.has("lead_time_hours")) {
    await client.execute("ALTER TABLE bakery_products ADD COLUMN lead_time_hours INTEGER");
    console.log("✅ ALTER bakery_products ADD lead_time_hours");
} else {
    console.log("⏭️  lead_time_hours ya existe");
}

await client.execute({
    sql: "INSERT INTO bakery_config (key, value) VALUES ('min_hours_ahead', '4') ON CONFLICT(key) DO UPDATE SET value = '4'",
    args: [],
});
console.log("✅ min_hours_ahead general = 4h");

console.log("\nMigración completa.");
process.exit(0);
