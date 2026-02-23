import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function run() {
    try {
        await client.execute("ALTER TABLE products ADD COLUMN cost_price INTEGER");
        console.log("✅ cost_price added");
    } catch (e: any) {
        console.log("cost_price:", e.message);
    }
    try {
        await client.execute("ALTER TABLE products ADD COLUMN profit_margin REAL");
        console.log("✅ profit_margin added");
    } catch (e: any) {
        console.log("profit_margin:", e.message);
    }
    process.exit(0);
}

run();
