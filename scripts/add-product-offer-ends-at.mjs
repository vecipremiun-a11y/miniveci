/**
 * Migración 0024: agrega products.offer_ends_at (fin programado de la oferta).
 * Fecha y hora (ISO UTC) en que la oferta se apaga sola; NULL = sin vencimiento.
 *
 * Uso:
 *   npm run db:migrate:offer-ends-at
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

if (!existing.has("offer_ends_at")) {
    await client.execute("ALTER TABLE products ADD COLUMN offer_ends_at TEXT");
    console.log("✅ ALTER products ADD offer_ends_at");
} else {
    console.log("⏭️  products.offer_ends_at ya existe");
}

console.log("\nMigración completa.");
process.exit(0);
