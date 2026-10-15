/**
 * Migración 0026: agrega orders.stock_applied_at y orders.pos_sent_at.
 * Ver drizzle/0026_order_stock_flags.sql y lib/order-stock.ts.
 *
 * Uso:
 *   npm run db:migrate:order-stock-flags
 *
 * Idempotente: solo crea las columnas que faltan, y el relleno de los pedidos
 * anteriores corre solo cuando la columna se crea.
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

const cols = await client.execute("PRAGMA table_info(orders)");
const existing = new Set(cols.rows.map((r) => r.name));

if (!existing.has("stock_applied_at")) {
    await client.execute("ALTER TABLE orders ADD COLUMN stock_applied_at TEXT");
    const r = await client.execute(`UPDATE orders SET stock_applied_at = COALESCE(updated_at, created_at)
        WHERE status IN ('confirmed', 'paid', 'preparing', 'ready', 'shipped', 'delivered')`);
    console.log(`✅ ALTER orders ADD stock_applied_at (${r.rowsAffected} pedidos con stock ya descontado)`);
} else {
    console.log("⏭️  orders.stock_applied_at ya existe");
}

if (!existing.has("pos_sent_at")) {
    await client.execute("ALTER TABLE orders ADD COLUMN pos_sent_at TEXT");
    const r = await client.execute("UPDATE orders SET pos_sent_at = COALESCE(created_at, updated_at)");
    console.log(`✅ ALTER orders ADD pos_sent_at (${r.rowsAffected} pedidos dados por recibidos)`);
} else {
    console.log("⏭️  orders.pos_sent_at ya existe");
}

console.log("\nMigración completa.");
process.exit(0);
