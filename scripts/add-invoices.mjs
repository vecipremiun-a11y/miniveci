/**
 * Migración 0028: crea order_invoices (factura de cada pedido) y
 * customer_invoice_data (datos de factura guardados del cliente).
 * Ver drizzle/0028_invoices.sql y lib/validations/invoice.ts.
 *
 * Uso:
 *   npm run db:migrate:invoices
 *
 * Idempotente: solo crea las tablas que faltan.
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

const INVOICE_COLUMNS = `
    rut TEXT NOT NULL,
    razon_social TEXT NOT NULL,
    giro TEXT,
    direccion TEXT,
    comuna TEXT,
    ciudad TEXT,
    email TEXT`;

const TABLES = {
    order_invoices: `CREATE TABLE IF NOT EXISTS order_invoices (
        order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,${INVOICE_COLUMNS},
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    customer_invoice_data: `CREATE TABLE IF NOT EXISTS customer_invoice_data (
        customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,${INVOICE_COLUMNS},
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
};

const existing = await client.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
const names = new Set(existing.rows.map((r) => r.name));

for (const [name, ddl] of Object.entries(TABLES)) {
    if (names.has(name)) {
        console.log(`⏭️  ${name} ya existe`);
        continue;
    }
    await client.execute(ddl);
    console.log(`✅ CREATE TABLE ${name}`);
}

console.log("\nMigración completa.");
process.exit(0);
