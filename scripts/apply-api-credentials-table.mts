import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN");
  process.exit(1);
}

const client = createClient({ url, authToken });

async function columnExists(table: string, column: string) {
  const rs = await client.execute(`PRAGMA table_info(${table})`);
  return rs.rows.some((r: any) => r.name === column);
}

async function run() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS api_credentials (
      id text PRIMARY KEY NOT NULL DEFAULT 'main',
      client_id text NOT NULL,
      client_secret text NOT NULL,
      pos_webhook_url text NOT NULL,
      webhook_secret text NOT NULL DEFAULT ''
    )
  `);

  if (!(await columnExists("api_credentials", "webhook_secret"))) {
    await client.execute("ALTER TABLE api_credentials ADD COLUMN webhook_secret text NOT NULL DEFAULT ''");
  }

  await client.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS api_credentials_client_id_unique
    ON api_credentials (client_id)
  `);

  console.log("✅ Tabla api_credentials lista en Turso");
}

run().catch((error) => {
  console.error("❌ Error creando api_credentials:", error);
  process.exit(1);
});
