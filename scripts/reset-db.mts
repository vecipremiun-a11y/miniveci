import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
        console.error("❌ Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN en .env.local");
        process.exit(1);
    }

    console.log("🔌 Conectando a Turso:", url);
    const client = createClient({ url, authToken });

    // ============================================
    // PASO 1: Obtener TODAS las tablas existentes
    // ============================================
    console.log("\n📋 Obteniendo todas las tablas existentes...");
    const tablesResult = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%'"
    );

    const existingTables = tablesResult.rows.map((r) => r.name as string);
    console.log(`   Tablas encontradas (${existingTables.length}):`, existingTables);

    // ============================================
    // PASO 2: Obtener TODOS los índices existentes
    // ============================================
    const indexesResult = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
    );
    const existingIndexes = indexesResult.rows.map((r) => r.name as string);
    console.log(`   Índices encontrados (${existingIndexes.length}):`, existingIndexes);

    // ============================================
    // PASO 3: BORRAR todo (índices y tablas)
    // ============================================
    console.log("\n🗑️  Eliminando todos los índices...");
    for (const idx of existingIndexes) {
        try {
            await client.execute(`DROP INDEX IF EXISTS "${idx}"`);
            console.log(`   ✅ Índice eliminado: ${idx}`);
        } catch (e: any) {
            console.log(`   ⚠️  No se pudo eliminar índice ${idx}: ${e.message}`);
        }
    }

    console.log("\n🗑️  Eliminando todas las tablas...");
    // Desactivar foreign keys para poder borrar en cualquier orden
    await client.execute("PRAGMA foreign_keys = OFF");

    for (const table of existingTables) {
        try {
            await client.execute(`DROP TABLE IF EXISTS "${table}"`);
            console.log(`   ✅ Tabla eliminada: ${table}`);
        } catch (e: any) {
            console.log(`   ❌ Error eliminando ${table}: ${e.message}`);
        }
    }

    await client.execute("PRAGMA foreign_keys = ON");

    // Verificar que no queda nada
    const checkResult = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    if (checkResult.rows.length > 0) {
        console.error("❌ Aún quedan tablas:", checkResult.rows.map((r) => r.name));
        process.exit(1);
    }
    console.log("\n✅ Base de datos completamente limpia.");

    // ============================================
    // PASO 4: CREAR las tablas del schema
    // ============================================
    console.log("\n🏗️  Creando tablas nuevas...\n");

    // --- users ---
    await client.execute(`
        CREATE TABLE "users" (
            "id" text PRIMARY KEY NOT NULL,
            "email" text NOT NULL,
            "password_hash" text NOT NULL,
            "name" text NOT NULL,
            "role" text DEFAULT 'admin' NOT NULL,
            "avatar_url" text,
            "active" integer DEFAULT true,
            "created_at" text DEFAULT CURRENT_TIMESTAMP,
            "updated_at" text DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await client.execute(`CREATE UNIQUE INDEX "users_email_unique" ON "users" ("email")`);
    console.log("   ✅ Tabla: users");

    // --- sessions ---
    await client.execute(`
        CREATE TABLE "sessions" (
            "id" text PRIMARY KEY NOT NULL,
            "user_id" text REFERENCES "users"("id"),
            "expires_at" text NOT NULL,
            "created_at" text
        )
    `);
    console.log("   ✅ Tabla: sessions");

    // --- categories ---
    await client.execute(`
        CREATE TABLE "categories" (
            "id" text PRIMARY KEY NOT NULL,
            "name" text NOT NULL,
            "slug" text NOT NULL,
            "description" text,
            "image_url" text,
            "parent_id" text,
            "sort_order" integer DEFAULT 0,
            "is_active" integer DEFAULT true,
            "sync_price_source" text DEFAULT 'global',
            "sync_stock_source" text DEFAULT 'global',
            "created_at" text DEFAULT CURRENT_TIMESTAMP,
            "updated_at" text DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await client.execute(`CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" ("slug")`);
    console.log("   ✅ Tabla: categories");

    // --- products ---
    await client.execute(`
        CREATE TABLE "products" (
            "id" text PRIMARY KEY NOT NULL,
            "sku" text NOT NULL,
            "name" text NOT NULL,
            "slug" text NOT NULL,
            "description" text,
            "category_id" text REFERENCES "categories"("id"),

            "web_price" integer,
            "web_stock" integer,
            "web_title" text,
            "web_description" text,
            "seo_title" text,
            "seo_description" text,

            "price_source" text DEFAULT 'global',
            "stock_source" text DEFAULT 'global',
            "reserved_qty" integer DEFAULT 0,

            "is_published" integer DEFAULT false,
            "is_featured" integer DEFAULT false,
            "sort_order" integer DEFAULT 0,
            "tags" text,
            "badges" text,

            "created_at" text DEFAULT CURRENT_TIMESTAMP,
            "updated_at" text DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await client.execute(`CREATE UNIQUE INDEX "products_sku_unique" ON "products" ("sku")`);
    await client.execute(`CREATE UNIQUE INDEX "products_slug_unique" ON "products" ("slug")`);
    await client.execute(`CREATE INDEX "slug_idx" ON "products" ("slug")`);
    await client.execute(`CREATE INDEX "sku_idx" ON "products" ("sku")`);
    await client.execute(`CREATE INDEX "category_id_idx" ON "products" ("category_id")`);
    console.log("   ✅ Tabla: products");

    // --- product_images ---
    await client.execute(`
        CREATE TABLE "product_images" (
            "id" text PRIMARY KEY NOT NULL,
            "product_id" text REFERENCES "products"("id") ON DELETE CASCADE,
            "url" text NOT NULL,
            "alt_text" text,
            "sort_order" integer DEFAULT 0,
            "is_primary" integer DEFAULT false
        )
    `);
    console.log("   ✅ Tabla: product_images");

    // --- orders ---
    await client.execute(`
        CREATE TABLE "orders" (
            "id" text PRIMARY KEY NOT NULL,
            "order_number" text NOT NULL,
            "customer_name" text NOT NULL,
            "customer_email" text NOT NULL,
            "customer_phone" text,
            "customer_rut" text,

            "shipping_address" text,
            "shipping_comuna" text,
            "shipping_city" text,
            "shipping_notes" text,

            "delivery_type" text NOT NULL,
            "delivery_date" text,
            "delivery_time_slot" text,

            "status" text DEFAULT 'new',

            "payment_method" text,
            "payment_status" text DEFAULT 'pending',
            "payment_id" text,

            "subtotal" integer NOT NULL,
            "discount" integer DEFAULT 0,
            "shipping_cost" integer DEFAULT 0,
            "total" integer NOT NULL,

            "internal_notes" text,
            "coupon_code" text,

            "created_at" text DEFAULT CURRENT_TIMESTAMP,
            "updated_at" text DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await client.execute(`CREATE UNIQUE INDEX "orders_order_number_unique" ON "orders" ("order_number")`);
    await client.execute(`CREATE INDEX "order_number_idx" ON "orders" ("order_number")`);
    await client.execute(`CREATE INDEX "status_idx" ON "orders" ("status")`);
    await client.execute(`CREATE INDEX "customer_email_idx" ON "orders" ("customer_email")`);
    await client.execute(`CREATE INDEX "created_at_idx" ON "orders" ("created_at")`);
    console.log("   ✅ Tabla: orders");

    // --- order_items ---
    await client.execute(`
        CREATE TABLE "order_items" (
            "id" text PRIMARY KEY NOT NULL,
            "order_id" text REFERENCES "orders"("id") ON DELETE CASCADE,
            "product_id" text REFERENCES "products"("id") ON DELETE SET NULL,
            "product_name" text NOT NULL,
            "product_sku" text NOT NULL,
            "quantity" integer NOT NULL,
            "unit_price" integer NOT NULL,
            "total_price" integer NOT NULL,
            "stock_source" text,
            "created_at" text DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log("   ✅ Tabla: order_items");

    // --- order_status_history ---
    await client.execute(`
        CREATE TABLE "order_status_history" (
            "id" text PRIMARY KEY NOT NULL,
            "order_id" text REFERENCES "orders"("id") ON DELETE CASCADE,
            "status" text NOT NULL,
            "changed_by" text,
            "notes" text,
            "created_at" text DEFAULT CURRENT_TIMESTAMP
        )
    `);
    console.log("   ✅ Tabla: order_status_history");

    // ============================================
    // PASO 5: Verificar resultado final
    // ============================================
    console.log("\n📋 Verificación final...");
    const finalTables = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    console.log(`   Tablas creadas (${finalTables.rows.length}):`);
    for (const row of finalTables.rows) {
        console.log(`     - ${row.name}`);
    }

    const finalIndexes = await client.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    console.log(`   Índices creados (${finalIndexes.rows.length}):`);
    for (const row of finalIndexes.rows) {
        console.log(`     - ${row.name}`);
    }

    console.log("\n🎉 ¡Base de datos reseteada y recreada exitosamente!");
    console.log("💡 Recuerda crear tu usuario admin con:");
    console.log("   npx tsx scripts/seed-admin.mts <email> <password> [nombre]");

    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Error fatal:", err);
    process.exit(1);
});
