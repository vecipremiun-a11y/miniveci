// Migración idempotente: tablas de Amasandería + seeds de config y productos.
// Uso: node scripts/create-bakery-tables.mjs
import { createClient } from "@libsql/client";
import { config } from "dotenv";
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

const tables = [
    `CREATE TABLE IF NOT EXISTS bakery_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        image_url TEXT,
        category TEXT NOT NULL,
        pricing_mode TEXT NOT NULL,
        price INTEGER NOT NULL,
        grams_per_unit INTEGER,
        allows_notes INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS bakery_products_active_idx ON bakery_products(active)`,
    `CREATE INDEX IF NOT EXISTS bakery_products_category_idx ON bakery_products(category)`,

    `CREATE TABLE IF NOT EXISTS bakery_orders (
        id TEXT PRIMARY KEY,
        public_code TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        scheduled_for TEXT NOT NULL,
        method TEXT NOT NULL,
        address TEXT,
        general_notes TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        subtotal INTEGER NOT NULL,
        delivery_fee INTEGER NOT NULL DEFAULT 0,
        total INTEGER NOT NULL,
        contact_phone TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS bakery_orders_user_created_idx ON bakery_orders(user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS bakery_orders_status_scheduled_idx ON bakery_orders(status, scheduled_for)`,
    `CREATE INDEX IF NOT EXISTS bakery_orders_scheduled_idx ON bakery_orders(scheduled_for)`,

    `CREATE TABLE IF NOT EXISTS bakery_order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL REFERENCES bakery_orders(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        pricing_mode TEXT NOT NULL,
        unit_price INTEGER NOT NULL,
        grams_per_unit INTEGER,
        quantity INTEGER NOT NULL,
        notes TEXT,
        subtotal INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS bakery_order_items_order_idx ON bakery_order_items(order_id)`,

    `CREATE TABLE IF NOT EXISTS bakery_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )`,
];

const defaultConfig = {
    min_hours_ahead: "12",
    max_days_ahead: "14",
    closed_weekdays: "[]",      // JSON array. 1=lunes ... 7=domingo
    open_hour: "7",
    close_hour: "20",
    slot_minutes: "30",
    offers_delivery: "true",
    delivery_fee: "1500",
};

const sampleProducts = [
    { name: "Pan amasado", description: "Pan amasado del día, suave y esponjoso.", category: "pan", pricingMode: "kg", price: 2500, gramsPerUnit: 90, allowsNotes: false, sortOrder: 1 },
    { name: "Pan de completo", description: "Pan especial para completos.", category: "pan", pricingMode: "kg", price: 2800, gramsPerUnit: 110, allowsNotes: false, sortOrder: 2 },
    { name: "Hallulla", description: "Hallulla casera crocante.", category: "pan", pricingMode: "kg", price: 2500, gramsPerUnit: 80, allowsNotes: false, sortOrder: 3 },
    { name: "Marraqueta", description: "Marraqueta crujiente.", category: "pan", pricingMode: "kg", price: 2600, gramsPerUnit: 100, allowsNotes: false, sortOrder: 4 },
    { name: "Completo Italiano", description: "Vienesa, palta, tomate, mayo.", category: "sandwich", pricingMode: "unit", price: 2500, gramsPerUnit: null, allowsNotes: true, sortOrder: 10 },
    { name: "Churrasco italiano", description: "Carne mechada, palta, tomate, mayo.", category: "sandwich", pricingMode: "unit", price: 3800, gramsPerUnit: null, allowsNotes: true, sortOrder: 11 },
    { name: "Hamburguesa completa", description: "Hamburguesa casera con toppings.", category: "hamburguesa", pricingMode: "unit", price: 4500, gramsPerUnit: null, allowsNotes: true, sortOrder: 20 },
    { name: "Empanada de pino", description: "Empanada horneada de pino tradicional.", category: "sandwich", pricingMode: "unit", price: 1800, gramsPerUnit: null, allowsNotes: false, sortOrder: 30 },
    { name: "Bandeja de canapés (12u)", description: "Selección variada de 12 canapés.", category: "canape", pricingMode: "unit", price: 8500, gramsPerUnit: null, allowsNotes: true, sortOrder: 40 },
    { name: "Berlín", description: "Berlín relleno con crema pastelera.", category: "dulce", pricingMode: "unit", price: 1500, gramsPerUnit: null, allowsNotes: false, sortOrder: 50 },
];

try {
    for (const sql of tables) {
        await client.execute(sql);
        console.log("✓", sql.split("\n")[0].slice(0, 80));
    }

    // Seed config (solo si no existe la key)
    for (const [key, value] of Object.entries(defaultConfig)) {
        await client.execute({
            sql: "INSERT INTO bakery_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
            args: [key, value],
        });
    }
    console.log("✓ bakery_config seed listo");

    // Seed productos: solo si la tabla está vacía
    const existing = await client.execute("SELECT COUNT(*) as count FROM bakery_products");
    if (Number(existing.rows[0].count) === 0) {
        for (const p of sampleProducts) {
            await client.execute({
                sql: `INSERT INTO bakery_products (id, name, description, image_url, category, pricing_mode, price, grams_per_unit, allows_notes, active, sort_order, created_at, updated_at)
                      VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
                args: [randomUUID(), p.name, p.description, p.category, p.pricingMode, p.price, p.gramsPerUnit, p.allowsNotes ? 1 : 0, p.sortOrder, now, now],
            });
        }
        console.log(`✓ ${sampleProducts.length} productos de ejemplo insertados`);
    } else {
        console.log("· bakery_products ya tenía datos, no se insertan ejemplos");
    }

    console.log("\nListo.");
} catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
}
