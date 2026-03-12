import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const kgProducts = await client.execute(
  "SELECT sku, name, unit, web_stock, is_published FROM products WHERE LOWER(unit) IN ('kg', 'lt') LIMIT 20"
);
console.log("Productos kg/lt:", kgProducts.rows.length);
for (const r of kgProducts.rows) {
  console.log(`  ${r.sku} | ${r.name} | unit=${r.unit} | stock=${r.web_stock} | published=${r.is_published}`);
}

const published = await client.execute(
  "SELECT count(*) as cnt FROM products WHERE is_published = 1 AND COALESCE(web_stock, 0) > 0"
);
console.log("\nTotal publicados con stock > 0:", published.rows[0]?.cnt);

const kgPub = await client.execute(
  "SELECT count(*) as cnt FROM products WHERE is_published = 1 AND COALESCE(web_stock, 0) > 0 AND LOWER(unit) IN ('kg', 'lt')"
);
console.log("Kg/Lt publicados con stock > 0:", kgPub.rows[0]?.cnt);

const kgZero = await client.execute(
  "SELECT count(*) as cnt FROM products WHERE LOWER(unit) IN ('kg', 'lt') AND (web_stock IS NULL OR web_stock = 0)"
);
console.log("Kg/Lt con stock 0 o null:", kgZero.rows[0]?.cnt);

process.exit(0);
