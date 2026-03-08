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

async function tableExists(table: string) {
  const rs = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
    args: [table],
  });
  return rs.rows.length > 0;
}

async function run() {
  console.log("🧹 Limpiando integración POS en Turso...");

  const productColumns = [
    "pos_id",
    "pos_price",
    "pos_stock",
    "pos_name",
    "pos_sku",
    "pos_barcode",
    "pos_last_sync",
  ];

  const orderColumns = ["pos_synced", "pos_order_id", "pos_sync_error"];

  try {
    await client.execute("DROP INDEX IF EXISTS pos_id_idx");
    await client.execute("DROP INDEX IF EXISTS products_pos_id_unique");
  } catch (error) {
    console.warn("⚠️ No se pudieron borrar índices POS:", error);
  }

  for (const column of productColumns) {
    if (await columnExists("products", column)) {
      await client.execute(`ALTER TABLE products DROP COLUMN ${column}`);
      console.log(`   ✅ products.${column} eliminado`);
    }
  }

  for (const column of orderColumns) {
    if (await columnExists("orders", column)) {
      await client.execute(`ALTER TABLE orders DROP COLUMN ${column}`);
      console.log(`   ✅ orders.${column} eliminado`);
    }
  }

  const tables = ["pos_webhook_events", "pos_sync_logs", "pos_config"];
  for (const table of tables) {
    if (await tableExists(table)) {
      await client.execute(`DROP TABLE ${table}`);
      console.log(`   ✅ tabla ${table} eliminada`);
    }
  }

  console.log("🎉 Limpieza POS completada.");
}

run().catch((error) => {
  console.error("❌ Error limpiando esquema POS:", error);
  process.exit(1);
});
