// Migración idempotente: agrega raffles.entry_fields y raffle_entries.guest_rut.
// Soporta la configuración de campos de inscripción del sorteo de temporada.
// Uso: node scripts/add-raffle-entry-config.mjs
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

try {
    if (!(await columnExists("raffles", "entry_fields"))) {
        await client.execute(`ALTER TABLE raffles ADD COLUMN entry_fields TEXT`);
        console.log("✓ raffles.entry_fields agregada");
    } else {
        console.log("· raffles.entry_fields ya existía");
    }

    if (!(await columnExists("raffle_entries", "guest_rut"))) {
        await client.execute(`ALTER TABLE raffle_entries ADD COLUMN guest_rut TEXT`);
        console.log("✓ raffle_entries.guest_rut agregada");
    } else {
        console.log("· raffle_entries.guest_rut ya existía");
    }

    console.log("\nListo.");
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
