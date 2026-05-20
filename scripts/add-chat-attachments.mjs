// Script idempotente para añadir columnas de adjuntos a chat_messages.
// Uso: node scripts/add-chat-attachments.mjs
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

async function addColumnIfMissing(table, column, ddl) {
    if (await columnExists(table, column)) {
        console.log(`✓ ${table}.${column} ya existe`);
        return;
    }
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
    console.log(`+ ${table}.${column} agregado`);
}

try {
    await addColumnIfMissing("chat_messages", "message_type", "message_type TEXT NOT NULL DEFAULT 'text'");
    await addColumnIfMissing("chat_messages", "attachment_url", "attachment_url TEXT");
    await addColumnIfMissing("chat_messages", "attachment_name", "attachment_name TEXT");
    await addColumnIfMissing("chat_messages", "attachment_size", "attachment_size INTEGER");
    await addColumnIfMissing("chat_messages", "mime_type", "mime_type TEXT");

    await client.execute(
        `CREATE INDEX IF NOT EXISTS chat_msg_message_type_idx ON chat_messages(message_type)`,
    );
    console.log("✓ índice chat_msg_message_type_idx listo");

    console.log("\nListo. Tabla chat_messages actualizada en Turso.");
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
