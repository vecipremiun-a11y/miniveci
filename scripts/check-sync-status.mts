import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function run() {
    const p = await client.execute("SELECT COUNT(*) as cnt FROM products");
    const cat = await client.execute("SELECT COUNT(*) as cnt FROM categories");
    const logs = await client.execute("SELECT * FROM pos_sync_logs ORDER BY created_at DESC LIMIT 1");
    console.log("Products:", p.rows[0].cnt);
    console.log("Categories:", cat.rows[0].cnt);
    if (logs.rows.length > 0) {
        const l = logs.rows[0];
        console.log("Last sync log:", JSON.stringify(l, null, 2));
    } else {
        console.log("No sync logs found");
    }
    process.exit(0);
}

run();
