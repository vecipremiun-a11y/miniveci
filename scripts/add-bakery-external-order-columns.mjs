/**
 * Agrega columnas para encargos presenciales POSVECI a la tabla bakery_orders.
 *
 * Uso:
 *   npm run db:migrate:bakery-external
 *
 * Idempotente: chequea si las columnas/índices existen antes de crearlos.
 * Aplica el contenido de drizzle/0016_bakery_external_orders.sql.
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

const cols = await client.execute("PRAGMA table_info(bakery_orders)");
const existing = new Set(cols.rows.map((r) => r.name));

// columna -> definición SQL
const columnsToAdd = [
    ["external_order_id", "ALTER TABLE bakery_orders ADD COLUMN external_order_id TEXT"],
    ["source", "ALTER TABLE bakery_orders ADD COLUMN source TEXT NOT NULL DEFAULT 'web'"],
    ["unclaimed", "ALTER TABLE bakery_orders ADD COLUMN unclaimed INTEGER NOT NULL DEFAULT 0"],
    ["guest_rut", "ALTER TABLE bakery_orders ADD COLUMN guest_rut TEXT"],
    ["guest_email", "ALTER TABLE bakery_orders ADD COLUMN guest_email TEXT"],
    ["guest_phone", "ALTER TABLE bakery_orders ADD COLUMN guest_phone TEXT"],
    ["guest_name", "ALTER TABLE bakery_orders ADD COLUMN guest_name TEXT"],
    ["payment_method", "ALTER TABLE bakery_orders ADD COLUMN payment_method TEXT"],
    ["deposit", "ALTER TABLE bakery_orders ADD COLUMN deposit INTEGER NOT NULL DEFAULT 0"],
    ["delivery_detail", "ALTER TABLE bakery_orders ADD COLUMN delivery_detail TEXT"],
];

for (const [name, ddl] of columnsToAdd) {
    if (!existing.has(name)) {
        await client.execute(ddl);
        console.log(`✅ ALTER bakery_orders ADD ${name}`);
    } else {
        console.log(`⏭️  ${name} ya existe`);
    }
}

const indexes = [
    "CREATE UNIQUE INDEX IF NOT EXISTS bakery_orders_external_order_id_unq ON bakery_orders(external_order_id)",
    "CREATE INDEX IF NOT EXISTS bakery_orders_unclaimed_idx ON bakery_orders(unclaimed)",
    "CREATE INDEX IF NOT EXISTS bakery_orders_guest_rut_idx ON bakery_orders(guest_rut)",
    "CREATE INDEX IF NOT EXISTS bakery_orders_guest_email_idx ON bakery_orders(guest_email)",
    "CREATE INDEX IF NOT EXISTS bakery_orders_guest_phone_idx ON bakery_orders(guest_phone)",
];

for (const ddl of indexes) {
    try {
        await client.execute(ddl);
        console.log(`✅ ${ddl.match(/INDEX IF NOT EXISTS (\w+)/)[1]} listo`);
    } catch (e) {
        console.warn("Index:", e.message);
    }
}

console.log("\nMigración completa.");
process.exit(0);
