/**
 * Sincroniza imágenes de productos desde PosVeci → Vercel Blob → product_images
 * 
 * Requisitos:
 *   - BLOB_READ_WRITE_TOKEN en .env.local
 *   - POS config en DB (api_url, api_key)
 *   - Productos ya sincronizados (por SKU)
 *
 * Uso: npx tsx scripts/sync-images.mts
 *       npx tsx scripts/sync-images.mts --dry-run     (solo cuenta, no sube)
 *       npx tsx scripts/sync-images.mts --limit 50    (solo los primeros N)
 */
import { createClient } from "@libsql/client";
import { put } from "@vercel/blob";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const isDryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.indexOf("--limit");
const limitValue = limitArg >= 0 ? parseInt(process.argv[limitArg + 1]) : Infinity;

const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
});

function base64ToBuffer(dataUri: string): { buffer: Buffer; contentType: string; ext: string } {
    // data:image/png;base64,iVBOR...
    const match = dataUri.match(/^data:(image\/(\w+));base64,(.+)$/);
    if (!match) throw new Error("Invalid data URI");
    const contentType = match[1]; // image/png
    let ext = match[2]; // png
    if (ext === "jpeg") ext = "jpg";
    const buffer = Buffer.from(match[3], "base64");
    return { buffer, contentType, ext };
}

async function run() {
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken && !isDryRun) {
        console.error("❌ BLOB_READ_WRITE_TOKEN no está configurado en .env.local");
        console.error("   1. Ve a tu proyecto en vercel.com → Storage → Create Blob Store");
        console.error("   2. Copia el BLOB_READ_WRITE_TOKEN");
        console.error("   3. Agrega a .env.local: BLOB_READ_WRITE_TOKEN=vercel_blob_...");
        process.exit(1);
    }

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
    console.log("📡 Descargando productos desde POS...");
    const res = await fetch(`${apiUrl}/api/external/products`, {
        headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
        console.error(`❌ POS API error: ${res.status} ${res.statusText}`);
        process.exit(1);
    }

    const posData = await res.json();
    const posProducts: any[] = posData.products || [];
    console.log(`✅ ${posProducts.length} productos recibidos del POS`);

    // 3. Filter products with images
    const withImages = posProducts.filter(
        (p: any) => p.image_url && typeof p.image_url === "string" && p.image_url.startsWith("data:")
    );
    console.log(`🖼️  ${withImages.length} productos tienen imagen base64`);

    if (withImages.length === 0) {
        console.log("ℹ️  No hay imágenes para sincronizar.");
        process.exit(0);
    }

    // 4. Load existing products from DB (by SKU) to match
    const existingProducts = await client.execute("SELECT id, sku, name FROM products");
    const skuMap = new Map<string, { id: string; name: string }>();
    for (const p of existingProducts.rows) {
        skuMap.set(p.sku as string, { id: p.id as string, name: p.name as string });
    }

    // 5. Load existing product_images to avoid duplicates
    const existingImages = await client.execute("SELECT product_id FROM product_images");
    const hasImage = new Set<string>();
    for (const img of existingImages.rows) {
        hasImage.add(img.product_id as string);
    }
    console.log(`📸 Productos que ya tienen imagen: ${hasImage.size}`);

    // 6. Process images
    const toProcess = withImages.slice(0, limitValue);
    let uploaded = 0;
    let skipped = 0;
    let errors = 0;
    let notFound = 0;
    const errorDetails: string[] = [];

    console.log(`\n🚀 Procesando ${toProcess.length} imágenes${isDryRun ? " (DRY RUN)" : ""}...\n`);

    for (let i = 0; i < toProcess.length; i++) {
        const posProd = toProcess[i];
        const sku = String(posProd.sku).trim();

        try {
            // Find matching product in DB
            const dbProduct = skuMap.get(sku);
            if (!dbProduct) {
                notFound++;
                continue;
            }

            // Skip if product already has an image
            if (hasImage.has(dbProduct.id)) {
                skipped++;
                continue;
            }

            if (isDryRun) {
                uploaded++;
                if ((i + 1) % 100 === 0) {
                    console.log(`  ⏳ ${i + 1}/${toProcess.length} revisados...`);
                }
                continue;
            }

            // Parse base64
            const { buffer, contentType, ext } = base64ToBuffer(posProd.image_url);

            // Upload to Vercel Blob
            const fileName = `products/${sku.replace(/[^a-zA-Z0-9-_]/g, "_")}.${ext}`;
            const blob = await put(fileName, buffer, {
                access: "public",
                contentType,
                addRandomSuffix: false, // Use deterministic names so re-runs don't duplicate
            });

            // Save in product_images table
            const imageId = crypto.randomUUID();
            await client.execute({
                sql: "INSERT INTO product_images (id, product_id, url, alt_text, sort_order, is_primary) VALUES (?, ?, ?, ?, 0, 1)",
                args: [imageId, dbProduct.id, blob.url, dbProduct.name],
            });

            hasImage.add(dbProduct.id); // Prevent duplicates within same run
            uploaded++;

            if ((i + 1) % 50 === 0) {
                console.log(`  ⏳ ${i + 1}/${toProcess.length} — ${uploaded} subidas, ${skipped} omitidas, ${errors} errores`);
            }
        } catch (err: any) {
            errors++;
            errorDetails.push(`SKU ${sku}: ${err.message}`);
            if (errors <= 5) {
                console.error(`  ❌ Error SKU ${sku}: ${err.message}`);
            }
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n${"=".repeat(50)}`);
    console.log(`📊 Resumen${isDryRun ? " (DRY RUN)" : ""}:`);
    console.log(`   ✅ Imágenes subidas:    ${uploaded}`);
    console.log(`   ⏭️  Ya tenían imagen:    ${skipped}`);
    console.log(`   🔍 SKU no encontrado:   ${notFound}`);
    console.log(`   ❌ Errores:             ${errors}`);
    console.log(`   ⏱️  Tiempo:              ${elapsed}s`);
    console.log(`${"=".repeat(50)}`);

    if (errorDetails.length > 0) {
        console.log(`\nPrimeros errores:`);
        errorDetails.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
    }

    // Update sync_images flag
    if (!isDryRun && uploaded > 0) {
        await client.execute("UPDATE pos_config SET sync_images = 1 WHERE id = 'main'");
        console.log("\n✅ sync_images activado en pos_config");
    }

    process.exit(0);
}

run();
