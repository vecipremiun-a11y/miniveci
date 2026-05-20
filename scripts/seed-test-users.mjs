// Crea/actualiza un usuario customer y uno admin de prueba para validar
// el flujo de auth móvil desde Flutter.
// Uso: node scripts/seed-test-users.mjs
import { createClient } from "@libsql/client";
import { config } from "dotenv";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

config({ path: ".env.local" });

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url || !authToken) {
    console.error("Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN");
    process.exit(1);
}

const client = createClient({ url, authToken });
const now = new Date().toISOString();

async function hash(pw) {
    return bcrypt.hash(pw, 10);
}

async function upsertCustomer({ email, password, firstName, lastName, phone }) {
    const existing = await client.execute({ sql: "SELECT id FROM customers WHERE email = ?", args: [email] });
    const passwordHash = await hash(password);
    if (existing.rows.length > 0) {
        await client.execute({
            sql: `UPDATE customers SET password_hash = ?, first_name = ?, last_name = ?, phone = ?, active = 1, updated_at = ? WHERE email = ?`,
            args: [passwordHash, firstName, lastName, phone, now, email],
        });
        return existing.rows[0].id;
    }
    const id = randomUUID();
    await client.execute({
        sql: `INSERT INTO customers (id, email, password_hash, first_name, last_name, phone, active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        args: [id, email, passwordHash, firstName, lastName, phone, now, now],
    });
    return id;
}

async function upsertAdmin({ email, password, name, role }) {
    const existing = await client.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] });
    const passwordHash = await hash(password);
    if (existing.rows.length > 0) {
        await client.execute({
            sql: `UPDATE users SET password_hash = ?, name = ?, role = ?, active = 1, updated_at = ? WHERE email = ?`,
            args: [passwordHash, name, role, now, email],
        });
        return existing.rows[0].id;
    }
    const id = randomUUID();
    await client.execute({
        sql: `INSERT INTO users (id, email, password_hash, name, role, active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        args: [id, email, passwordHash, name, role, now, now],
    });
    return id;
}

try {
    const customerId = await upsertCustomer({
        email: "customer.test@miniveci.cl",
        password: "Test1234!",
        firstName: "Cliente",
        lastName: "Prueba",
        phone: "+56912345678",
    });
    console.log(`✓ Customer test  → id=${customerId}`);

    const adminId = await upsertAdmin({
        email: "admin.test@miniveci.cl",
        password: "Admin1234!",
        name: "Admin Prueba",
        role: "owner",
    });
    console.log(`✓ Admin test     → id=${adminId}`);

    console.log("\nCREDENCIALES");
    console.log("============");
    console.log("Customer:");
    console.log("  email:    customer.test@miniveci.cl");
    console.log("  password: Test1234!");
    console.log("\nAdmin (role 'owner'):");
    console.log("  email:    admin.test@miniveci.cl");
    console.log("  password: Admin1234!");
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
