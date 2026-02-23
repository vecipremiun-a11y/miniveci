import { createClient } from "@libsql/client";
import bcrypt from "bcryptjs";
// Environment variables loaded via --env-file flag

async function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error("Usage: node scripts/seed-admin.mjs <email> <password> [name]");
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
        const now = Date.now(); // Integer timestamp or ISO string depending on schema preference. 
        // Drizzle defaults to integer for mode: 'timestamp_ms' or similar depending on config.
        // However, usually text ISO strings are safer for SQLite compatibility if not strictly defined.
        // Let's check schema definition if possible, but standard text is safe.
        // Actually, let's use standard integer timestamp for now if unsure, or simple text.
        // Drizzle default for `timestamp` mode 'date' maps to Date object, stored as integer ms usually in SQLite if not specified.
        // Checking previous schema creation... I don't have the schema file open.
        // Safest is to pass values that SQLite accepts.

        // Drop and Recreate table to ensure schema match (Desperate fix for persistent mismatch)
        console.log("Recreating users table...");
        await client.execute("DROP TABLE IF EXISTS users");
        await client.execute(`
            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'owner',
                avatar_url TEXT,
                active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log("Table users recreated.");

        // Check if user exists (after recreation, this will always be empty for the first run)
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
                sql: "INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)",
                args: [id, email, hashedPassword, name, role]
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
