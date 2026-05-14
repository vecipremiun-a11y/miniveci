// Script idempotente para crear solo las tablas de chat en Turso.
// Uso: node scripts/create-chat-tables.mjs
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

const statements = [
    `CREATE TABLE IF NOT EXISTS chat_conversations (
        id TEXT PRIMARY KEY,
        customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
        guest_id TEXT,
        guest_name TEXT,
        guest_email TEXT,
        assigned_operator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'open',
        last_message_at TEXT,
        last_message_preview TEXT,
        unread_customer INTEGER DEFAULT 0,
        unread_agent INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS chat_customer_id_idx ON chat_conversations(customer_id)`,
    `CREATE INDEX IF NOT EXISTS chat_guest_id_idx ON chat_conversations(guest_id)`,
    `CREATE INDEX IF NOT EXISTS chat_status_idx ON chat_conversations(status)`,
    `CREATE INDEX IF NOT EXISTS chat_last_message_at_idx ON chat_conversations(last_message_at)`,
    `CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
        sender_type TEXT NOT NULL,
        sender_id TEXT,
        sender_name TEXT,
        body TEXT NOT NULL,
        read_by_customer INTEGER DEFAULT 0,
        read_by_agent INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS chat_msg_conversation_id_idx ON chat_messages(conversation_id)`,
    `CREATE INDEX IF NOT EXISTS chat_msg_created_at_idx ON chat_messages(created_at)`,
];

try {
    for (const sql of statements) {
        await client.execute(sql);
        console.log("✓", sql.split("\n")[0].slice(0, 80));
    }
    console.log("\nListo. Tablas de chat creadas en Turso.");
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
