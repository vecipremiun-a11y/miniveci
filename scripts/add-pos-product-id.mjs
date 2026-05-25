/**
 * Agrega la columna pos_product_id (ID maestro del producto en POSVECI) a products.
 *
 * Uso:
 *   npm run db:migrate:pos-product-id
 *
 * Idempotente: chequea si la columna/índice existen antes de crearlos.
 * Aplica drizzle/0017_add_pos_product_id.sql.
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

const cols = await client.execute("PRAGMA table_info(products)");
const existing = new Set(cols.rows.map((r) => r.name));

if (!existing.has("pos_product_id")) {
    await client.execute("ALTER TABLE products ADD COLUMN pos_product_id TEXT");
    console.log("✅ ALTER products ADD pos_product_id");
} else {
    console.log("⏭️  pos_product_id ya existe");
}

try {
    await client.execute("CREATE INDEX IF NOT EXISTS products_pos_product_id_idx ON products(pos_product_id)");
    console.log("✅ products_pos_product_id_idx listo");
} catch (e) {
    console.warn("Index:", e.message);
}

console.log("\nMigración completa.");
process.exit(0);
