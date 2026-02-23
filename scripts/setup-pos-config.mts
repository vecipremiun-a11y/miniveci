import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function run() {
    const rows = await client.execute("SELECT id FROM pos_config WHERE id = 'main'");
    if (rows.rows.length === 0) {
        await client.execute({
            sql: "INSERT INTO pos_config (id, api_url, api_key, company_id, is_connected, sync_prices, sync_stock, sync_name, sync_images) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            args: ["main", "https://app.posveci.com", "posveci_ext_kP9xR2mT7wQ4vL8nJ3bF6yH1dE5sA0", "default", 0, 1, 1, 0, 0],
        });
        console.log("✅ POS config created");
    } else {
        await client.execute({
            sql: "UPDATE pos_config SET api_url = ?, api_key = ?, company_id = ?, sync_prices = 1, sync_stock = 1 WHERE id = 'main'",
            args: ["https://app.posveci.com", "posveci_ext_kP9xR2mT7wQ4vL8nJ3bF6yH1dE5sA0", "default"],
        });
        console.log("✅ POS config updated");
    }
    process.exit(0);
}

run();
