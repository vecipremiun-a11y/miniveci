/**
 * Audita estado de migraciones contra Turso.
 * Uso: node --env-file=.env.local scripts/inspect-turso-schema.mjs
 */
import { createClient } from "@libsql/client";

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
);
const tableNames = new Set(tables.rows.map((r) => r.name));

console.log(`\n📋 Tablas (${tables.rows.length}):\n`);
for (const row of tables.rows) console.log(`  • ${row.name}`);

// Verificar tablas esperadas
const expected = [
    "users", "sessions", "customers", "customer_addresses", "customer_payment_methods",
    "categories", "products", "product_images", "orders", "order_items", "order_status_history",
    "subscriptions", "api_credentials", "banners",
    "chat_conversations", "chat_messages",
    "bakery_products", "bakery_orders", "bakery_order_items", "bakery_config",
    "refresh_tokens",
    "raffles", "raffle_entries", "raffle_images", "raffle_prizes", "raffle_winners",
    "user_push_tokens", // ← la nueva
];

const missing = expected.filter((t) => !tableNames.has(t));
console.log(`\n🚨 Faltan ${missing.length}:`);
for (const t of missing) console.log(`  ❌ ${t}`);

// Verificar columnas de chat_messages (attachments)
if (tableNames.has("chat_messages")) {
    const cols = await client.execute("PRAGMA table_info(chat_messages)");
    const colNames = cols.rows.map((r) => r.name);
    console.log(`\n📎 chat_messages columnas (${colNames.length}):`);
    console.log(`  ${colNames.join(", ")}`);
    const attachmentCols = ["attachment_url", "attachment_type", "attachment_name", "attachments"];
    const hasAttachments = attachmentCols.some((c) => colNames.includes(c));
    console.log(`  ${hasAttachments ? "✅ Attachments aplicado" : "⚠️  Attachments NO aplicado todavía"}`);
}

console.log("\n");
process.exit(0);
