/**
 * Ajusta el horario de retiro de amasandería (open_hour / close_hour).
 * Uso: node --env-file=.env.local scripts/set-bakery-hours.mjs
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

// .env.local tiene BOM → --env-file rompe la 1ª var. Parseo manual.
const env = {};
for (const line of readFileSync(".env.local", "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const client = createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
});

const before = await client.execute(
    "SELECT key, value FROM bakery_config WHERE key IN ('open_hour','close_hour')"
);
console.log("Antes:", Object.fromEntries(before.rows.map((r) => [r.key, r.value])));

for (const [key, value] of [["open_hour", "10"], ["close_hour", "22"]]) {
    await client.execute({
        sql: "INSERT INTO bakery_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        args: [key, value],
    });
}

const after = await client.execute(
    "SELECT key, value FROM bakery_config WHERE key IN ('open_hour','close_hour')"
);
console.log("Despues:", Object.fromEntries(after.rows.map((r) => [r.key, r.value])));
process.exit(0);
