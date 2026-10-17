/**
 * Migración 0029: unidades de medida (Caja, Bandeja, Pack…).
 * Crea product_presentations y agrega a order_items la foto de la presentación
 * vendida. Ver drizzle/0029_product_presentations.sql y lib/product-presentations.ts.
 *
 * Uso:
 *   npm run db:migrate:presentations
 *
 * Idempotente y aditiva: solo crea lo que falta. El código en producción que no
 * conoce estas columnas sigue funcionando igual.
 */
import { createClient } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

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

const tables = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
if (tables.rows.some((r) => r.name === "product_presentations")) {
    console.log("⏭️  product_presentations ya existe");
} else {
    await client.execute(`CREATE TABLE product_presentations (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        source TEXT NOT NULL DEFAULT 'store',
        pos_presentation_id TEXT,
        name TEXT NOT NULL,
        units INTEGER NOT NULL,
        price INTEGER NOT NULL,
        barcode TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        hidden_in_store INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log("✅ CREATE TABLE product_presentations");
}

for (const ddl of [
    "CREATE INDEX IF NOT EXISTS product_presentations_product_idx ON product_presentations (product_id)",
    "CREATE UNIQUE INDEX IF NOT EXISTS product_presentations_pos_unq ON product_presentations (product_id, pos_presentation_id) WHERE pos_presentation_id IS NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS product_presentations_barcode_unq ON product_presentations (barcode) WHERE barcode IS NOT NULL",
]) {
    await client.execute(ddl);
}
console.log("✅ índices de product_presentations");

const ORDER_ITEM_COLUMNS = {
    presentation_id: "TEXT",
    presentation_pos_id: "TEXT",
    presentation_name: "TEXT",
    presentation_units: "INTEGER",
    presentation_qty: "INTEGER",
    presentation_price: "INTEGER",
};

const cols = await client.execute("PRAGMA table_info(order_items)");
const existing = new Set(cols.rows.map((r) => r.name));
for (const [name, type] of Object.entries(ORDER_ITEM_COLUMNS)) {
    if (existing.has(name)) {
        console.log(`⏭️  order_items.${name} ya existe`);
        continue;
    }
    await client.execute(`ALTER TABLE order_items ADD COLUMN ${name} ${type}`);
    console.log(`✅ ALTER order_items ADD ${name}`);
}

console.log("\nMigración completa.");
process.exit(0);
