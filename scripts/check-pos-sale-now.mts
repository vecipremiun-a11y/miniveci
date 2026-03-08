import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const sku = process.argv[2] || "65432656";

async function run() {
  const product = await client.execute({
    sql: "SELECT id, sku, name, web_stock, updated_at FROM products WHERE sku = ? LIMIT 1",
    args: [sku],
  });

  const recent = await client.execute(
    "SELECT sku, name, web_stock, updated_at FROM products ORDER BY updated_at DESC LIMIT 10"
  );

  console.log(JSON.stringify({
    skuChecked: sku,
    product: product.rows[0] ?? null,
    recentUpdatedProducts: recent.rows,
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
