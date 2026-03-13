import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function run() {
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS banners (
        id TEXT PRIMARY KEY,
        title TEXT,
        image_url TEXT NOT NULL,
        link_url TEXT,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("banners table created successfully");
  } catch (e: any) {
    console.log("error:", e.message);
  }
}

run();
