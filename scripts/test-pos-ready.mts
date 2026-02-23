import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function run() {
    // 1. Verify POS config
    const config = await client.execute("SELECT * FROM pos_config WHERE id = 'main'");
    console.log("POS Config:", JSON.stringify(config.rows[0], null, 2));

    // 2. Test POS API connectivity
    const apiUrl = config.rows[0].api_url as string;
    const apiKey = config.rows[0].api_key as string;

    console.log("\nTesting POS API...");
    const pingRes = await fetch(`${apiUrl}/api/external/ping`, {
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    const pingData = await pingRes.json();
    console.log("Ping:", JSON.stringify(pingData));

    // 3. Count existing products
    const products = await client.execute("SELECT COUNT(*) as cnt FROM products");
    console.log(`\nExisting products in DB: ${products.rows[0].cnt}`);

    // 4. Count existing categories
    const cats = await client.execute("SELECT COUNT(*) as cnt FROM categories");
    console.log(`Existing categories in DB: ${cats.rows[0].cnt}`);

    console.log("\n✅ Everything is ready for sync. Use the admin panel to run sync.");
    process.exit(0);
}

run();
