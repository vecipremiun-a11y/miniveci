/**
 * Migración 0027: agrega products.subscription_margin (utilidad del precio
 * suscriptor por producto; NULL = la de todos, 5%).
 *
 * Uso:
 *   npm run db:migrate:subscription-margin                 → solo la columna
 *   npm run db:migrate:subscription-margin -- --recalcular → además recalcula
 *       el precio suscriptor de TODOS los productos con costo:
 *       (costo + IVA) × (1 + utilidad). Cambia precios en vivo.
 *
 * Idempotente. La fórmula es la misma que subscriptionPriceSql
 * (lib/subscription-price.ts).
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_SUBSCRIPTION_MARGIN = 5; // = lib/product-price.ts

function loadEnvLocal() {
    const envPath = path.resolve(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return;
    // .env.local está guardado con BOM UTF-8: sin quitarlo la primera clave no se lee.
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

if (!existing.has("subscription_margin")) {
    await client.execute("ALTER TABLE products ADD COLUMN subscription_margin REAL");
    console.log("✅ ALTER products ADD subscription_margin");
} else {
    console.log("⏭️  products.subscription_margin ya existe");
}

if (process.argv.includes("--recalcular")) {
    const r = await client.execute(`UPDATE products SET subscription_price =
        CAST(ROUND(ROUND(cost_price * (1 + CASE WHEN tax_rate > 0 THEN tax_rate ELSE 0 END / 100.0))
            * (1 + COALESCE(subscription_margin, ${DEFAULT_SUBSCRIPTION_MARGIN}) / 100.0)) AS INTEGER)
        WHERE cost_price > 0`);
    console.log(`✅ Precio suscriptor recalculado en ${r.rowsAffected} productos`);
}

console.log("\nMigración completa.");
process.exit(0);
