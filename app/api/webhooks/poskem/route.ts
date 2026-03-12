import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiCredentials, products, productImages, categories } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { emitProductChange } from "@/lib/product-live-updates";
import { createHmac, timingSafeEqual } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// --- HMAC Signature Verification ---

async function getWebhookSecret(): Promise<string> {
    const creds = await db.query.apiCredentials.findFirst({
        where: eq(apiCredentials.id, "main"),
        columns: { webhookSecret: true },
    });
    return creds?.webhookSecret || "";
}

function verifySignature(secret: string, timestamp: string, rawBody: string, signature: string): boolean {
    if (!secret || !signature) return false;
    const expected = createHmac("sha256", secret)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");
    try {
        return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
    } catch {
        return false;
    }
}

// --- Helpers ---

/** Normaliza stock: negativos → 0, unidades enteras → floor, kg/lt → 3 decimales */
function normalizeStock(stock: number | undefined, unit?: string): number | undefined {
    if (stock === undefined) return undefined;
    if (stock < 0) stock = 0;
    const u = (unit ?? "un").toLowerCase();
    if (u === "kg" || u === "lt") {
        return Math.round(stock * 1000) / 1000;
    }
    return Math.floor(stock);
}

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}

async function resolveCategory(categoryName: string): Promise<string | null> {
    const slug = generateSlug(categoryName);
    if (!slug) return null;

    const existing = await db.query.categories.findFirst({
        where: eq(categories.slug, slug),
        columns: { id: true },
    });
    if (existing) return existing.id;

    const id = crypto.randomUUID();
    await db.insert(categories).values({ id, name: categoryName, slug });
    return id;
}

// --- Event Handlers ---

async function handleProductCreatedOrUpdated(payload: Record<string, unknown>) {
    const sku = String(payload.sku ?? "").trim().toUpperCase();
    if (!sku) return { error: "Missing sku in payload" };

    const name = payload.name ? String(payload.name) : undefined;
    const category = payload.category ? String(payload.category) : undefined;
    const stock = typeof payload.stock === "number" ? payload.stock : undefined;
    // Aceptar snake_case y camelCase (POSKEM envía camelCase)
    const rawSalePrice = payload.sale_price ?? payload.price;
    const salePrice = typeof rawSalePrice === "number" ? Math.round(rawSalePrice) : undefined;
    const rawOfferPrice = payload.offer_price ?? payload.offerPrice;
    const offerPrice = typeof rawOfferPrice === "number" ? Math.round(rawOfferPrice) : (rawOfferPrice === null ? null : undefined);
    const isOffer = typeof payload.is_offer === "boolean" ? payload.is_offer : (typeof payload.isOffer === "boolean" ? payload.isOffer : undefined);
    const unit = payload.unit ? String(payload.unit) : undefined;
    const rawTaxRate = payload.tax_rate ?? payload.taxRate;
    const taxRate = typeof rawTaxRate === "number" ? rawTaxRate : undefined;
    const imageUrl = (payload.image_url ?? payload.imageUrl) ? String(payload.image_url ?? payload.imageUrl) : undefined;

    // Normalizar stock según unidad
    const normalizedStock = normalizeStock(stock, unit);

    let categoryId: string | null = null;
    if (category) categoryId = await resolveCategory(category);

    const existing = await db
        .select({ id: products.id, sku: products.sku, slug: products.slug })
        .from(products)
        .where(sql`UPPER(TRIM(${products.sku})) = ${sku}`)
        .limit(1);

    const now = new Date().toISOString();
    let productId: string;
    let productSlug: string;
    let action: "created" | "updated";

    if (existing[0]) {
        productId = existing[0].id;
        productSlug = existing[0].slug ?? "";

        const updateFields: Record<string, unknown> = { updatedAt: now };
        if (name !== undefined) updateFields.name = name;
        if (categoryId !== null) updateFields.categoryId = categoryId;
        if (stock !== undefined) updateFields.webStock = normalizedStock;
        if (salePrice !== undefined) updateFields.webPrice = salePrice;
        if (offerPrice !== undefined) updateFields.offerPrice = offerPrice;
        if (isOffer !== undefined) updateFields.isOffer = isOffer;
        if (unit !== undefined) updateFields.unit = unit;
        if (taxRate !== undefined) updateFields.taxRate = taxRate;

        await db.update(products).set(updateFields).where(eq(products.id, productId));
        action = "updated";
    } else {
        const productName = name || `Producto ${sku}`;
        let slug = generateSlug(productName);
        const slugExists = await db.query.products.findFirst({
            where: eq(products.slug, slug),
            columns: { id: true },
        });
        if (slugExists) slug = `${slug}-${Date.now()}`;

        productId = crypto.randomUUID();
        productSlug = slug;

        await db.insert(products).values({
            id: productId,
            sku,
            name: productName,
            slug,
            categoryId,
            webPrice: salePrice ?? 0,
            webStock: normalizedStock ?? 0,
            offerPrice: offerPrice ?? null,
            isOffer: isOffer ?? false,
            unit: unit ?? "Und",
            taxRate: taxRate ?? null,
            isPublished: false,
            createdAt: now,
            updatedAt: now,
        });
        action = "created";
    }

    // Handle image if provided
    if (imageUrl) {
        const existingImg = await db.query.productImages.findFirst({
            where: eq(productImages.productId, productId),
            columns: { id: true },
        });
        if (existingImg) {
            await db.update(productImages).set({ url: imageUrl, isPrimary: true }).where(eq(productImages.id, existingImg.id));
        } else {
            await db.insert(productImages).values({
                id: crypto.randomUUID(),
                productId,
                url: imageUrl,
                isPrimary: true,
                sortOrder: 0,
            });
        }
    }

    await emitProductChange(productId, {
        slug: productSlug,
        reason: `webhook:product.${action}`,
        changedFields: ["name", "price", "stock", "category", "images"],
    });

    return { action, productId, sku };
}

async function handleProductDeactivated(payload: Record<string, unknown>) {
    const sku = String(payload.sku ?? "").trim().toUpperCase();
    if (!sku) return { error: "Missing sku in payload" };

    const existing = await db
        .select({ id: products.id, slug: products.slug })
        .from(products)
        .where(sql`UPPER(TRIM(${products.sku})) = ${sku}`)
        .limit(1);

    if (!existing[0]) return { skipped: true, reason: "product-not-found" };

    await db.update(products).set({
        isPublished: false,
        updatedAt: new Date().toISOString(),
    }).where(eq(products.id, existing[0].id));

    await emitProductChange(existing[0].id, {
        slug: existing[0].slug,
        reason: "webhook:product.deactivated",
        changedFields: ["status"],
    });

    return { action: "deactivated", productId: existing[0].id };
}

async function handleProductDeleted(payload: Record<string, unknown>) {
    const sku = String(payload.sku ?? "").trim().toUpperCase();
    if (!sku) return { error: "Missing sku in payload" };

    const existing = await db
        .select({ id: products.id, slug: products.slug })
        .from(products)
        .where(sql`UPPER(TRIM(${products.sku})) = ${sku}`)
        .limit(1);

    if (!existing[0]) return { skipped: true, reason: "product-not-found" };

    // Soft-delete: unpublish and set stock to 0
    await db.update(products).set({
        isPublished: false,
        webStock: 0,
        updatedAt: new Date().toISOString(),
    }).where(eq(products.id, existing[0].id));

    await emitProductChange(existing[0].id, {
        slug: existing[0].slug,
        reason: "webhook:product.deleted",
        changedFields: ["status", "stock"],
    });

    return { action: "soft-deleted", productId: existing[0].id };
}

// --- Main Route ---

export async function POST(req: NextRequest) {
    const eventType = req.headers.get("x-poskem-event") || "";
    const timestamp = req.headers.get("x-poskem-timestamp") || "";
    const signature = req.headers.get("x-poskem-signature") || "";

    let rawBody: string;
    try {
        rawBody = await req.text();
    } catch {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    // Verify HMAC signature
    const secret = await getWebhookSecret();
    if (secret) {
        if (!signature || !timestamp) {
            console.warn("[POSKEM_WEBHOOK] Missing signature or timestamp");
            return NextResponse.json({ error: "Missing signature" }, { status: 401 });
        }
        if (!verifySignature(secret, timestamp, rawBody, signature)) {
            console.warn("[POSKEM_WEBHOOK] Invalid signature for event:", eventType);
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
    }

    let payload: Record<string, unknown>;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    console.log(`[POSKEM_WEBHOOK] Event: ${eventType}`, JSON.stringify(payload).slice(0, 500));

    try {
        let result: Record<string, unknown>;

        switch (eventType) {
            case "product.created":
            case "product.updated":
                result = await handleProductCreatedOrUpdated(payload);
                break;
            case "product.deactivated":
                result = await handleProductDeactivated(payload);
                break;
            case "product.deleted":
                result = await handleProductDeleted(payload);
                break;
            case "order.created":
            case "order.status_updated":
                // Log for now — order webhook handling can be expanded later
                console.log(`[POSKEM_WEBHOOK] Order event received: ${eventType}`, payload);
                result = { received: true, event: eventType };
                break;
            default:
                console.log(`[POSKEM_WEBHOOK] Unknown event: ${eventType}`);
                result = { received: true, event: eventType, note: "unhandled event type" };
        }

        return NextResponse.json({ success: true, event: eventType, ...result });
    } catch (error: unknown) {
        console.error(`[POSKEM_WEBHOOK] Error processing ${eventType}:`, error);
        return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
    }
}
