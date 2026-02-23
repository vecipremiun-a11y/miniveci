import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";
import path from "path";
// Load environment variables
dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error("Usage: npx tsx scripts/seed-admin.ts <email> <password> [name]");
        process.exit(1);
    }

    const [email, password, name = "Admin"] = args;

    console.log(`Seeding admin user: ${email}`);

    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
        console.error("Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables.");
        process.exit(1);
    }

    const client = createClient({
        url,
        authToken,
    });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const id = crypto.randomUUID();
        const role = "owner";
        const active = 1; // SQLite uses 0/1 for boolean

        // Check if user exists
        const rs = await client.execute({
            sql: "SELECT * FROM users WHERE email = ?",
            args: [email]
        });

        if (rs.rows.length > 0) {
            console.log("User already exists. Updating password...");
            await client.execute({
                sql: "UPDATE users SET password_hash = ?, name = ?, role = ? WHERE email = ?",
                args: [hashedPassword, name, role, email]
            });
            console.log("User updated successfully.");
        } else {
            console.log("Creating new user...");
            await client.execute({
                sql: "INSERT INTO users (id, email, password_hash, name, role, active) VALUES (?, ?, ?, ?, ?, ?)",
                args: [id, email, hashedPassword, name, role, active]
            });
            console.log("User created successfully.");
        }

    } catch (error) {
        console.error("Error seeding user:", error);
        process.exit(1);
    }

    process.exit(0);
}

main();
