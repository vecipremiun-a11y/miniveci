/**
 * Migración 0025: agrega products.offer_stock (oferta por stock).
 * Unidades (kg en los de peso) que quedan a precio oferta; en 0 la oferta se
 * acaba sola. NULL = sin límite de stock.
 *
 * Uso:
 *   npm run db:migrate:offer-stock
 *
 * Idempotente: chequea si la columna existe antes de crearla.
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;
    // `replace(/^﻿/, "")`: .env.local está guardado con BOM UTF-8. Sin esto
    // la primera clave se lee como "﻿TURSO_DATABASE_URL" y el script muere
    // diciendo que falta una variable que sí está en el archivo.
    const content = fs.readFileSync(envPath, "utf8").replace(/^﻿/, "");
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

if (!existing.has("offer_stock")) {
    await client.execute("ALTER TABLE products ADD COLUMN offer_stock REAL");
    console.log("✅ ALTER products ADD offer_stock");
} else {
    console.log("⏭️  products.offer_stock ya existe");
}

console.log("\nMigración completa.");
process.exit(0);
