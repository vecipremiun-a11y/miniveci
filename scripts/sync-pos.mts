/**
 * Test de sincronización POS completa (ejecutado directamente, sin necesidad de auth)
 * Ejecuta la misma lógica que POST /api/admin/pos/sync
 */
import { createClient } from "@libsql/client";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
});

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 200);
}

async function getOrCreateCategory(name: string, cache: Map<string, string>): Promise<string> {
    const key = name.toLowerCase().trim();
    if (cache.has(key)) return cache.get(key)!;

    const existing = await client.execute("SELECT id, name FROM categories");
    for (const cat of existing.rows) {
        cache.set((cat.name as string).toLowerCase().trim(), cat.id as string);
    }
    if (cache.has(key)) return cache.get(key)!;

    const id = crypto.randomUUID();
    const slug = slugify(name) || `cat-${id.slice(0, 8)}`;

    // Ensure unique slug
    const slugCheck = await client.execute({ sql: "SELECT id FROM categories WHERE slug = ?", args: [slug] });
    const finalSlug = slugCheck.rows.length > 0 ? `${slug}-${id.slice(0, 8)}` : slug;

    await client.execute({
        sql: "INSERT INTO categories (id, name, slug, is_active) VALUES (?, ?, ?, 1)",
        args: [id, name.trim(), finalSlug],
    });
    cache.set(key, id);
    console.log(`  📁 Categoría creada: ${name.trim()}`);
    return id;
}

async function run() {
    const startTime = Date.now();

    // 1. Load POS config
    const configRows = await client.execute("SELECT * FROM pos_config WHERE id = 'main'");
    const config = configRows.rows[0];
    if (!config?.api_url || !config?.api_key) {
        console.error("❌ No hay configuración POS.");
        process.exit(1);
    }

    const apiUrl = (config.api_url as string).replace(/\/$/, "");
    const apiKey = config.api_key as string;

    // 2. Fetch products from POS
    console.log("📡 Fetching products from POS...");
    const res = await fetch(`${apiUrl}/api/external/products`, {
        headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
        console.error(`❌ POS API error: ${res.status}`);
        process.exit(1);
    }

    const posData = await res.json();
    const posProducts: any[] = posData.products || [];
    console.log(`✅ Received ${posProducts.length} products from POS`);

    // 3. Load existing products by SKU
    const existingProducts = await client.execute("SELECT id, sku, web_price, web_stock, category_id, name FROM products");
    const skuMap = new Map<string, any>();
    for (const p of existingProducts.rows) {
        skuMap.set(p.sku as string, p);
    }
    console.log(`📦 Existing products in DB: ${skuMap.size}`);

    const categoryCache = new Map<string, string>();
    let created = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: string[] = [];

    const syncImages = config.sync_images === 1;
    const syncName = config.sync_name === 1;

    // Process in batches
    for (let i = 0; i < posProducts.length; i++) {
        const posProd = posProducts[i];
        try {
            if (!posProd.sku) {
                errors++;
                continue;
            }

            const sku = String(posProd.sku).trim();
            const categoryId = posProd.category
                ? await getOrCreateCategory(posProd.category, categoryCache)
                : null;

            const existing = skuMap.get(sku);

            const posPrice = posProd.sale_price != null ? Math.round(Number(posProd.sale_price)) : null;
            const posStock = posProd.stock != null ? Math.round(Number(posProd.stock)) : null;
            const costPrice = posProd.cost_price != null ? Math.round(Number(posProd.cost_price)) : null;
            const profitMargin = posProd.profit_margin != null ? Number(posProd.profit_margin) : null;
            const now = new Date().toISOString();

            if (existing) {
                // UPDATE
                let sql = `UPDATE products SET 
                    pos_price = ?, pos_stock = ?, pos_barcode = ?, pos_last_sync = ?,
                    cost_price = ?, profit_margin = ?, pos_name = ?, updated_at = ?`;
                const args: any[] = [
                    posPrice, posStock, posProd.barcode || null, now,
                    costPrice, profitMargin, posProd.name || null, now,
                ];

                if (syncName && posProd.name) {
                    sql += `, name = ?`;
                    args.push(posProd.name);
                }

                if (!existing.category_id && categoryId) {
                    sql += `, category_id = ?`;
                    args.push(categoryId);
                }

                if (existing.web_price == null && posPrice != null) {
                    sql += `, web_price = ?`;
                    args.push(posPrice);
                }
                if (existing.web_stock == null && posStock != null) {
                    sql += `, web_stock = ?`;
                    args.push(posStock);
                }

                sql += ` WHERE id = ?`;
                args.push(existing.id);

                await client.execute({ sql, args });
                updated++;
            } else {
                // CREATE
                const productId = crypto.randomUUID();
                const productName = posProd.name || `Producto ${sku}`;
                let slug = slugify(productName);

                const slugCheck = await client.execute({ sql: "SELECT id FROM products WHERE slug = ?", args: [slug] });
                if (slugCheck.rows.length > 0) {
                    slug = `${slug}-${sku.replace(/[^a-z0-9]/gi, "").slice(-8)}`;
                }
                // Triple check
                const slugCheck2 = await client.execute({ sql: "SELECT id FROM products WHERE slug = ?", args: [slug] });
                if (slugCheck2.rows.length > 0) {
                    slug = `${slug}-${productId.slice(0, 8)}`;
                }
                const slugCheck3 = await client.execute({ sql: "SELECT id FROM products WHERE slug = ?", args: [slug] });
                if (slugCheck3.rows.length > 0) {
                    slug = `${productId}`; // Ultimate fallback: use full UUID as slug
                }

                await client.execute({
                    sql: `INSERT INTO products (id, sku, name, slug, category_id,
                        pos_price, pos_stock, pos_name, pos_sku, pos_barcode, pos_last_sync,
                        web_price, web_stock, cost_price, profit_margin,
                        price_source, stock_source, is_published, is_featured)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'global', 'global', 0, 0)`,
                    args: [
                        productId, sku, productName, slug, categoryId,
                        posPrice, posStock, posProd.name || null, sku, posProd.barcode || null, now,
                        posPrice, posStock, costPrice, profitMargin,
                    ],
                });

                // Save image if available and sync_images enabled
                if (syncImages && posProd.image_url && posProd.image_url.startsWith("data:")) {
                    await client.execute({
                        sql: "INSERT INTO product_images (id, product_id, url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, 0, 1)",
                        args: [crypto.randomUUID(), productId, posProd.image_url, productName],
                    });
                }
                // Add to skuMap so subsequent duplicates get UPDATED instead of INSERT failing
                skuMap.set(sku, { id: productId, sku, web_price: posFields.posPrice, web_stock: posFields.posStock, category_id: categoryId, name: productName });                created++;
            }

            // Progress log
            if ((i + 1) % 500 === 0) {
                console.log(`  ⏳ ${i + 1}/${posProducts.length} procesados (${created} nuevos, ${updated} actualizados)`);
            }
        } catch (prodError: any) {
            errors++;
            errorDetails.push(`SKU ${posProd.sku}: ${prodError.message}`);
            if (errorDetails.length <= 5) console.error(`  ❌ ${posProd.sku}: ${prodError.message}`);
            if (errors === 1) console.error(`  Full error:`, prodError);
            if (errorDetails.length > 100) break;
        }
    }

    const durationMs = Date.now() - startTime;

    // Log sync result
    await client.execute({
        sql: `INSERT INTO pos_sync_logs (id, event_type, status, products_processed, products_created, products_updated, errors_count, error_details, duration_ms, triggered_by)
              VALUES (?, 'sync_total', ?, ?, ?, ?, ?, ?, ?, 'manual_script')`,
        args: [
            crypto.randomUUID(),
            errors > 0 ? "partial" : "success",
            posProducts.length,
            created,
            updated,
            errors,
            errorDetails.length > 0 ? JSON.stringify(errorDetails) : null,
            durationMs,
        ],
    });

    console.log(`\n${"=".repeat(50)}`);
    console.log(`✅ Sincronización completada en ${(durationMs / 1000).toFixed(1)}s`);
    console.log(`   Total procesados: ${posProducts.length}`);
    console.log(`   Creados: ${created}`);
    console.log(`   Actualizados: ${updated}`);
    console.log(`   Errores: ${errors}`);
    if (errorDetails.length > 0) {
        console.log(`   Primeros errores:`);
        errorDetails.slice(0, 5).forEach(e => console.log(`     - ${e}`));
    }

    process.exit(0);
}

run();
