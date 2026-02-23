import * as fs from "fs";
import * as path from "path";

const base = process.cwd();

// ========= 1. CONFIG ROUTE =========
const configRoute = `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
    try {
        const rows = await db.select().from(posConfig).limit(1);
        if (rows.length === 0) {
            const id = "main";
            await db.insert(posConfig).values({ id });
            const created = await db.select().from(posConfig).where(eq(posConfig.id, id));
            return NextResponse.json(created[0]);
        }
        return NextResponse.json(rows[0]);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const id = "main";

        const rows = await db.select().from(posConfig).where(eq(posConfig.id, id));
        if (rows.length === 0) {
            await db.insert(posConfig).values({ id });
        }

        await db.update(posConfig).set({
            apiUrl: body.apiUrl ?? null,
            apiKey: body.apiKey ?? null,
            companyId: body.companyId ?? null,
            syncPrices: body.syncPrices ?? true,
            syncStock: body.syncStock ?? true,
            syncName: body.syncName ?? false,
            syncImages: body.syncImages ?? false,
            updatedAt: new Date().toISOString(),
        }).where(eq(posConfig.id, id));

        const updated = await db.select().from(posConfig).where(eq(posConfig.id, id));
        return NextResponse.json(updated[0]);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
`;

// ========= 2. TEST CONNECTION ROUTE =========
const testConnectionRoute = `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
    try {
        const rows = await db.select().from(posConfig).limit(1);
        const config = rows[0];

        if (!config?.apiUrl || !config?.apiKey) {
            return NextResponse.json({
                success: false,
                message: "Configura primero la URL y API Key del POS.",
            });
        }

        const pingUrl = config.apiUrl.replace(/\\/$/, "") + "/api/external/ping";

        const res = await fetch(pingUrl, {
            headers: { Authorization: \`Bearer \${config.apiKey}\` },
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
            const body = await res.text();
            await db.update(posConfig).set({
                isConnected: false,
                lastConnectionTest: new Date().toISOString(),
            }).where(eq(posConfig.id, config.id));

            return NextResponse.json({
                success: false,
                message: \`Error \${res.status}: \${body.slice(0, 200)}\`,
            });
        }

        const data = await res.json();

        await db.update(posConfig).set({
            isConnected: true,
            lastConnectionTest: new Date().toISOString(),
        }).where(eq(posConfig.id, config.id));

        return NextResponse.json({
            success: true,
            message: \`Conectado a \${data.service || "POS"} v\${data.version || "?"}\`,
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            message: error.message || "Error de conexión desconocido",
        }, { status: 500 });
    }
}
`;

// ========= 3. SYNC ROUTE =========
const syncRoute = `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posConfig, products, categories, posSyncLogs, productImages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function slugify(text: string): string {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\\u0300-\\u036f]/g, "")
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
    const slug = slugify(name) || \`cat-\${id.slice(0, 8)}\`;
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
        const productsUrl = config.apiUrl.replace(/\\/$/, "") + "/api/external/products";
        const res = await fetch(productsUrl, {
            headers: { Authorization: \`Bearer \${config.apiKey}\` },
        });

        if (!res.ok) {
            const errText = await res.text();
            return NextResponse.json({ error: \`POS API respondió \${res.status}: \${errText.slice(0, 300)}\` }, { status: 502 });
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

                    // Handle image sync
                    if (config.syncImages && posProd.image_url && posProd.image_url.startsWith("data:")) {
                        // Check if product has any images
                        const existingImages = await db.select().from(productImages)
                            .where(eq(productImages.productId, existing.id));
                        if (existingImages.length === 0) {
                            await db.insert(productImages).values({
                                id: crypto.randomUUID(),
                                productId: existing.id,
                                url: posProd.image_url,
                                altText: posProd.name || "",
                                sortOrder: 0,
                                isPrimary: true,
                            });
                        }
                    }

                    updated++;
                } else {
                    // CREATE new product
                    const productId = crypto.randomUUID();
                    const productName = posProd.name || \`Producto \${sku}\`;
                    let slug = slugify(productName);

                    // Ensure unique slug
                    const slugCheck = await db.select().from(products).where(eq(products.slug, slug));
                    if (slugCheck.length > 0) {
                        slug = \`\${slug}-\${sku.slice(-6)}\`;
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

                    // Save image if available
                    if (config.syncImages && posProd.image_url && posProd.image_url.startsWith("data:")) {
                        await db.insert(productImages).values({
                            id: crypto.randomUUID(),
                            productId,
                            url: posProd.image_url,
                            altText: productName,
                            sortOrder: 0,
                            isPrimary: true,
                        });
                    }

                    created++;
                }
            } catch (prodError: any) {
                errors++;
                errorDetails.push(\`SKU \${posProd.sku}: \${prodError.message}\`);
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
`;

// ========= 4. LOGS ROUTE =========
const logsRoute = `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posSyncLogs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

        const logs = await db.select().from(posSyncLogs)
            .orderBy(desc(posSyncLogs.createdAt))
            .limit(limit);

        return NextResponse.json({ data: logs });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
`;

// ========= 5. WEBHOOKS ROUTE =========
const webhooksRoute = `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posWebhookEvents } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

        const hooks = await db.select().from(posWebhookEvents)
            .orderBy(desc(posWebhookEvents.createdAt))
            .limit(limit);

        return NextResponse.json({ data: hooks });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const id = crypto.randomUUID();

        await db.insert(posWebhookEvents).values({
            id,
            eventType: body.event_type || "unknown",
            payload: body,
            processed: false,
            retryCount: 0,
        });

        return NextResponse.json({ success: true, id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
`;

// ========= 6. WEBHOOKS REPROCESS ROUTE =========
const reprocessRoute = `import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posWebhookEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const rows = await db.select().from(posWebhookEvents).where(eq(posWebhookEvents.id, id));
        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: "Webhook no encontrado" }, { status: 404 });
        }

        // Mark as reprocessed
        await db.update(posWebhookEvents).set({
            processed: true,
            processedAt: new Date().toISOString(),
            processResult: "Reprocesado manualmente",
        }).where(eq(posWebhookEvents.id, id));

        return NextResponse.json({ success: true, message: "Webhook reprocesado." });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
`;

// Write all files
const files: Record<string, string> = {
    "app/api/admin/pos/config/route.ts": configRoute,
    "app/api/admin/pos/test-connection/route.ts": testConnectionRoute,
    "app/api/admin/pos/sync/route.ts": syncRoute,
    "app/api/admin/pos/logs/route.ts": logsRoute,
    "app/api/admin/pos/webhooks/route.ts": webhooksRoute,
    "app/api/admin/pos/webhooks/[id]/reprocess/route.ts": reprocessRoute,
};

for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(base, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf-8");
    console.log(`✅ ${filePath}`);
}

console.log("\nDone! All POS API routes rewritten.");
