import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posConfig, products, categories, posSyncLogs, productImages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";

function base64ToBuffer(dataUri: string): { buffer: Buffer; contentType: string; ext: string } | null {
    const match = dataUri.match(/^data:(image\/(\w+));base64,(.+)$/);
    if (!match) return null;
    let ext = match[2];
    if (ext === "jpeg") ext = "jpg";
    return { buffer: Buffer.from(match[3], "base64"), contentType: match[1], ext };
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 200);
}

async function getOrCreateCategory(name: string, categoryCache: Map<string, string>): Promise<string> {
    const key = name.toLowerCase().trim();
    if (categoryCache.has(key)) return categoryCache.get(key)!;

    const existing = await db.select().from(categories).limit(500);
    for (const cat of existing) {
        categoryCache.set(cat.name.toLowerCase().trim(), cat.id);
    }
    if (categoryCache.has(key)) return categoryCache.get(key)!;

    const id = crypto.randomUUID();
    const slug = slugify(name) || `cat-${id.slice(0, 8)}`;
    await db.insert(categories).values({
        id,
        name: name.trim(),
        slug,
        isActive: true,
    });
    categoryCache.set(key, id);
    return id;
}

export async function POST(req: Request) {
    const startTime = Date.now();
    try {
        const body = await req.json();
        const syncType = body.type || "total";

        // Load POS config
        const configRows = await db.select().from(posConfig).limit(1);
        const config = configRows[0];

        if (!config?.apiUrl || !config?.apiKey) {
            return NextResponse.json({ error: "Configura primero la URL y API Key del POS." }, { status: 400 });
        }

        // Fetch products from POS
        const productsUrl = config.apiUrl.replace(/\/$/, "") + "/api/external/products";
        const res = await fetch(productsUrl, {
            headers: { Authorization: `Bearer ${config.apiKey}` },
        });

        if (!res.ok) {
            const errText = await res.text();
            return NextResponse.json({ error: `POS API respondió ${res.status}: ${errText.slice(0, 300)}` }, { status: 502 });
        }

        const posData = await res.json();
        const posProducts: any[] = posData.products || [];

        if (posProducts.length === 0) {
            return NextResponse.json({ error: "La API del POS no devolvió productos." }, { status: 400 });
        }

        // Load existing products by SKU
        const existingProducts = await db.select().from(products);
        const skuMap = new Map<string, typeof existingProducts[0]>();
        for (const p of existingProducts) {
            skuMap.set(p.sku, p);
        }

        const categoryCache = new Map<string, string>();
        let created = 0;
        let updated = 0;
        let errors = 0;
        const errorDetails: string[] = [];

        for (const posProd of posProducts) {
            try {
                if (!posProd.sku) {
                    errors++;
                    errorDetails.push("Producto sin SKU encontrado, saltando.");
                    continue;
                }

                const sku = String(posProd.sku).trim();
                const categoryId = posProd.category
                    ? await getOrCreateCategory(posProd.category, categoryCache)
                    : null;

                const existing = skuMap.get(sku);

                // Build POS fields to update
                const posFields: Record<string, any> = {
                    posPrice: posProd.sale_price != null ? Math.round(Number(posProd.sale_price)) : null,
                    posStock: posProd.stock != null ? Math.round(Number(posProd.stock)) : null,
                    posBarcode: posProd.barcode || null,
                    posLastSync: new Date().toISOString(),
                    costPrice: posProd.cost_price != null ? Math.round(Number(posProd.cost_price)) : null,
                    profitMargin: posProd.profit_margin != null ? Number(posProd.profit_margin) : null,
                };

                if (existing) {
                    // UPDATE existing product
                    const updateData: Record<string, any> = { ...posFields, updatedAt: new Date().toISOString() };

                    // Conditionally sync name
                    if (config.syncName && posProd.name) {
                        updateData.name = posProd.name;
                        updateData.posName = posProd.name;
                    } else {
                        updateData.posName = posProd.name || null;
                    }

                    // Sync category if product doesn't have one yet
                    if (!existing.categoryId && categoryId) {
                        updateData.categoryId = categoryId;
                    }

                    // Sync prices automatically to web if product has no webPrice
                    if (existing.webPrice == null && posFields.posPrice != null) {
                        updateData.webPrice = posFields.posPrice;
                    }
                    if (existing.webStock == null && posFields.posStock != null) {
                        updateData.webStock = posFields.posStock;
                    }

                    await db.update(products).set(updateData).where(eq(products.id, existing.id));

                    // Handle image sync (upload to Vercel Blob)
                    if (config.syncImages && posProd.image_url && posProd.image_url.startsWith("data:")) {
                        const existingImages = await db.select().from(productImages)
                            .where(eq(productImages.productId, existing.id));
                        if (existingImages.length === 0) {
                            const parsed = base64ToBuffer(posProd.image_url);
                            if (parsed) {
                                try {
                                    const fileName = `products/${sku.replace(/[^a-zA-Z0-9-_]/g, "_")}.${parsed.ext}`;
                                    const blob = await put(fileName, parsed.buffer, {
                                        access: "public",
                                        contentType: parsed.contentType,
                                        addRandomSuffix: false,
                                    });
                                    await db.insert(productImages).values({
                                        id: crypto.randomUUID(),
                                        productId: existing.id,
                                        url: blob.url,
                                        altText: posProd.name || "",
                                        sortOrder: 0,
                                        isPrimary: true,
                                    });
                                } catch (_imgErr) { /* silently skip image errors */ }
                            }
                        }
                    }

                    updated++;
                } else {
                    // CREATE new product
                    const productId = crypto.randomUUID();
                    const productName = posProd.name || `Producto ${sku}`;
                    let slug = slugify(productName);

                    // Ensure unique slug
                    const slugCheck = await db.select().from(products).where(eq(products.slug, slug));
                    if (slugCheck.length > 0) {
                        slug = `${slug}-${sku.slice(-6)}`;
                    }

                    await db.insert(products).values({
                        id: productId,
                        sku,
                        name: productName,
                        slug,
                        categoryId,
                        posPrice: posFields.posPrice,
                        posStock: posFields.posStock,
                        posName: posProd.name || null,
                        posSku: sku,
                        posBarcode: posFields.posBarcode,
                        posLastSync: posFields.posLastSync,
                        webPrice: posFields.posPrice, // init web price from POS
                        webStock: posFields.posStock,  // init web stock from POS
                        costPrice: posFields.costPrice,
                        profitMargin: posFields.profitMargin,
                        priceSource: "global",
                        stockSource: "global",
                        isPublished: false,
                        isFeatured: false,
                    });

                    // Save image if available (upload to Vercel Blob)
                    if (config.syncImages && posProd.image_url && posProd.image_url.startsWith("data:")) {
                        const parsed = base64ToBuffer(posProd.image_url);
                        if (parsed) {
                            try {
                                const fileName = `products/${sku.replace(/[^a-zA-Z0-9-_]/g, "_")}.${parsed.ext}`;
                                const blob = await put(fileName, parsed.buffer, {
                                    access: "public",
                                    contentType: parsed.contentType,
                                    addRandomSuffix: false,
                                });
                                await db.insert(productImages).values({
                                    id: crypto.randomUUID(),
                                    productId,
                                    url: blob.url,
                                    altText: productName,
                                    sortOrder: 0,
                                    isPrimary: true,
                                });
                            } catch (_imgErr) { /* silently skip image errors */ }
                        }
                    }

                    created++;
                }
            } catch (prodError: any) {
                errors++;
                errorDetails.push(`SKU ${posProd.sku}: ${prodError.message}`);
                if (errorDetails.length > 50) break; // Cap error details
            }
        }

        // Log sync result
        const durationMs = Date.now() - startTime;
        await db.insert(posSyncLogs).values({
            id: crypto.randomUUID(),
            eventType: syncType === "total" ? "sync_total" : "sync_incremental",
            status: errors > 0 ? "partial" : "success",
            productsProcessed: posProducts.length,
            productsCreated: created,
            productsUpdated: updated,
            errorsCount: errors,
            errorDetails: errorDetails.length > 0 ? errorDetails : null,
            durationMs,
            triggeredBy: "manual",
        });

        return NextResponse.json({
            success: true,
            processed: posProducts.length,
            created,
            updated,
            errors,
            durationMs,
        });
    } catch (error: any) {
        // Log error
        const durationMs = Date.now() - startTime;
        try {
            await db.insert(posSyncLogs).values({
                id: crypto.randomUUID(),
                eventType: "sync_total",
                status: "error",
                productsProcessed: 0,
                productsCreated: 0,
                productsUpdated: 0,
                errorsCount: 1,
                errorDetails: [error.message],
                durationMs,
                triggeredBy: "manual",
            });
        } catch (_) {}

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
