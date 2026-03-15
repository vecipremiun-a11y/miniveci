import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const result = await db.execute(
  "SELECT id, name, is_published, web_stock, web_price, stock_source, reserved_qty, category_id, slug FROM products WHERE name LIKE '%Dog chow%' OR name LIKE '%dog chow%' OR name LIKE '%DOG CHOW%'"
);

console.log("Productos encontrados:", result.rows.length);
for (const row of result.rows) {
  console.log(JSON.stringify(row, null, 2));
}
