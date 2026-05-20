// Migración idempotente: agrega guest_address y receipt_number a raffle_entries
// Uso: node scripts/add-raffle-entry-fields.mjs
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
    if (!(await columnExists("raffle_entries", "guest_address"))) {
        await client.execute(`ALTER TABLE raffle_entries ADD COLUMN guest_address TEXT`);
        console.log("✓ raffle_entries.guest_address agregada");
    } else {
        console.log("· raffle_entries.guest_address ya existía");
    }

    if (!(await columnExists("raffle_entries", "receipt_number"))) {
        await client.execute(`ALTER TABLE raffle_entries ADD COLUMN receipt_number TEXT`);
        console.log("✓ raffle_entries.receipt_number agregada");
    } else {
        console.log("· raffle_entries.receipt_number ya existía");
    }

    await client.execute(
        `CREATE INDEX IF NOT EXISTS raffle_entries_receipt_idx ON raffle_entries(raffle_id, receipt_number)`,
    );
    console.log("✓ índice raffle_entries_receipt_idx listo");

    console.log("\nListo.");
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
