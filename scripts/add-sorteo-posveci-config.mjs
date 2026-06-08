// Migración idempotente: agrega las columnas de integración POSVECI al sorteo de temporada.
// raffles.sorteo_token, raffles.boleta_min_amount, raffles.boleta_from_date.
// Uso: node scripts/add-sorteo-posveci-config.mjs
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
    console.error("Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN");
    process.exit(1);
}

const client = createClient({ url, authToken });

async function columnExists(table, column) {
    const res = await client.execute(`PRAGMA table_info(${table})`);
    return res.rows.some((r) => r.name === column);
}

const columns = [
    { name: "sorteo_token", ddl: "TEXT" },
    { name: "boleta_min_amount", ddl: "INTEGER" },
    { name: "boleta_from_date", ddl: "TEXT" },
];

try {
    for (const col of columns) {
        if (!(await columnExists("raffles", col.name))) {
            await client.execute(`ALTER TABLE raffles ADD COLUMN ${col.name} ${col.ddl}`);
            console.log(`✓ raffles.${col.name} agregada`);
        } else {
            console.log(`· raffles.${col.name} ya existía`);
        }
    }
    console.log("\nListo.");
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
