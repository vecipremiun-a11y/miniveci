/**
 * Agrega columnas para Google Sign-In a la tabla customers.
 *
 * Uso:
 *   npm run db:migrate:google-auth
 *
 * Idempotente: chequea si las columnas existen antes de agregar.
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

// dotenv/config solo lee .env por default — leemos .env.local manualmente porque
// tiene valores JSON que el parser nativo de Node --env-file rompe.
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
        // unquote si está entre comillas
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

const cols = await client.execute("PRAGMA table_info(customers)");
const existing = new Set(cols.rows.map((r) => r.name));

if (!existing.has("google_id")) {
    await client.execute("ALTER TABLE customers ADD COLUMN google_id TEXT");
    console.log("✅ ALTER customers ADD google_id");
} else {
    console.log("⏭️  google_id ya existe");
}

if (!existing.has("email_verified")) {
    await client.execute("ALTER TABLE customers ADD COLUMN email_verified INTEGER DEFAULT 0");
    console.log("✅ ALTER customers ADD email_verified");
} else {
    console.log("⏭️  email_verified ya existe");
}

try {
    await client.execute(`CREATE UNIQUE INDEX IF NOT EXISTS customer_google_id_unique ON customers(google_id) WHERE google_id IS NOT NULL`);
    console.log("✅ Unique index google_id (partial) listo");
} catch (e) {
    console.warn("Index google_id:", e.message);
}

console.log("\nMigración completa.");
process.exit(0);
