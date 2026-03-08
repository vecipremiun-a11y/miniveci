import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  const statements = [
    "ALTER TABLE products ADD COLUMN offer_price integer",
    "ALTER TABLE products ADD COLUMN is_offer integer DEFAULT 0",
    "ALTER TABLE products ADD COLUMN unit text DEFAULT 'Und'",
    "ALTER TABLE products ADD COLUMN tax_rate real",
  ];

  for (const sql of statements) {
    try {
      await client.execute(sql);
      console.log(`✅ ${sql}`);
    } catch (e: any) {
      if (e.message?.includes("duplicate column")) {
        console.log(`⏭️ Ya existe: ${sql}`);
      } else {
        console.error(`❌ Error: ${sql}`, e.message);
      }
    }
  }

  console.log("\n🎉 Migración completada");
}

migrate();
