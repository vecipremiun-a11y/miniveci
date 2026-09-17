/**
 * Agrega users.customer_id: la cuenta de cliente de un admin/owner, para que
 * pueda comprar en la tienda con el mismo login que usa para el panel.
 *
 * Uso:
 *   npm run db:migrate:user-customer-link
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

const cols = await client.execute("PRAGMA table_info(users)");
const existing = new Set(cols.rows.map((r) => r.name));

if (!existing.has("customer_id")) {
    await client.execute("ALTER TABLE users ADD COLUMN customer_id TEXT REFERENCES customers(id)");
    console.log("✅ ALTER users ADD customer_id");
} else {
    console.log("⏭️  users.customer_id ya existe");
}

console.log("\nMigración completa.");
process.exit(0);
