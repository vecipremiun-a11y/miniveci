import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load environment variables manually since we are not in Next.js context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env.local");

// Simple dotenv parser fallback if dotenv module issue persists
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse ? dotenv.config({ path: envPath }) : null;
    if (!envConfig || !process.env.TURSO_DATABASE_URL) {
        // Manual parsing if dotenv fails or just to be safe in this mixed env
        const envFile = fs.readFileSync(envPath, "utf8");
        envFile.split("\n").forEach(line => {
            const [key, val] = line.split("=");
            if (key && val) process.env[key.trim()] = val.trim().replace(/"/g, "");
        });
    }
}

async function main() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
        console.error("Missing credentials");
        process.exit(1);
    }

    const client = createClient({ url, authToken });

    try {
        console.log("Inspecting 'users' table...");
        const rs = await client.execute("PRAGMA table_info(users)");
        console.table(rs.rows);
    } catch (e) {
        console.error(e);
    }
}

main();
