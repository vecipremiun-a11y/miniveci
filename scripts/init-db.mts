import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) throw new Error("Missing env vars");

    const client = createClient({ url, authToken });

    const sqlFile = path.join(process.cwd(), "drizzle", "0000_tiresome_joseph.sql");
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');

    // Split by statement breakpoints
    const statements = sqlContent.split("--> statement-breakpoint").map(s => s.trim()).filter(s => s.length > 0);

    for (const stmt of statements) {
        // Safeify statements
        let safeStmt = stmt;
        if (safeStmt.startsWith("CREATE TABLE")) safeStmt = safeStmt.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS");
        if (safeStmt.startsWith("CREATE UNIQUE INDEX")) safeStmt = safeStmt.replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS");
        if (safeStmt.startsWith("CREATE INDEX")) safeStmt = safeStmt.replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS");

        try {
            await client.execute(safeStmt);
            console.log("SUCCESS:", safeStmt.substring(0, 50).replace(/\n/g, ' '));
        } catch (e: any) {
            console.log("SKIPPED:", e.message);
        }
    }

    console.log("Full DB schema sync applied.");
    process.exit(0);
}
main();
