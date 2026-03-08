import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiCredentials, products } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { emitProductChange } from "@/lib/product-live-updates";

export const dynamic = "force-dynamic";

const syncStockSchema = z.object({
    sku: z.string().min(1).optional(),
    product_id: z.string().min(1).optional(),
    stock: z.number().int().min(0, "Stock inválido").optional(),
    cantidad_vendida: z.number().int().positive("cantidad_vendida inválida").optional(),
}).refine((payload) => Boolean(payload.sku || payload.product_id), {
    message: "Debe enviar sku o product_id",
}).refine((payload) => payload.stock !== undefined || payload.cantidad_vendida !== undefined, {
    message: "Debe enviar stock o cantidad_vendida",
});

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "PUT,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-api-key, x-api-secret, api_key, api_secret, api-key, api-secret",
};

function withCors(response: NextResponse) {
    Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        response.headers.set(key, value);
    });
    return response;
}

function extractCredentials(req: NextRequest) {
    const apiKey =
        req.headers.get("x-api-key") ||
        req.headers.get("api_key") ||
        req.headers.get("api-key");

    const apiSecret =
        req.headers.get("x-api-secret") ||
        req.headers.get("api_secret") ||
        req.headers.get("api-secret");

    return { apiKey, apiSecret };
}

export async function OPTIONS() {
    return withCors(new NextResponse(null, { status: 204 }));
}

async function handleStockSync(req: NextRequest) {
    try {
        const { apiKey, apiSecret } = extractCredentials(req);

        if (!apiKey || !apiSecret) {
            return withCors(NextResponse.json({ error: "Missing api_key or api_secret" }, { status: 401 }));
        }

        const credentials = await db.query.apiCredentials.findFirst({
            where: eq(apiCredentials.id, "main"),
        });

        if (!credentials) {
            return withCors(NextResponse.json({ error: "API credentials not configured" }, { status: 503 }));
        }

        if (credentials.clientId !== apiKey || credentials.clientSecret !== apiSecret) {
            return withCors(NextResponse.json({ error: "Invalid api_key or api_secret" }, { status: 401 }));
        }

        const body = await req.json();
        const { sku, product_id, stock, cantidad_vendida } = syncStockSchema.parse(body);

        let targetProduct = null as null | { id: string; sku: string; slug: string | null };

        if (sku) {
            const bySku = await db.query.products.findFirst({
                where: eq(products.sku, sku),
                columns: { id: true, sku: true, slug: true },
            });
            if (bySku) targetProduct = bySku;
        }

        if (!targetProduct && product_id) {
            const byId = await db.query.products.findFirst({
                where: eq(products.id, product_id),
                columns: { id: true, sku: true, slug: true },
            });
            if (byId) targetProduct = byId;
        }

        if (!targetProduct) {
            return withCors(NextResponse.json({ error: "Product not found" }, { status: 404 }));
        }

        const updated = stock !== undefined
            ? await db
                .update(products)
                .set({
                    webStock: stock,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(products.id, targetProduct.id))
                .returning({
                    id: products.id,
                    sku: products.sku,
                    slug: products.slug,
                    webStock: products.webStock,
                })
            : await db
                .update(products)
                .set({
                    webStock: sql`MAX(${products.webStock} - ${cantidad_vendida ?? 0}, 0)`,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(products.id, targetProduct.id))
                .returning({
                    id: products.id,
                    sku: products.sku,
                    slug: products.slug,
                    webStock: products.webStock,
                });

        if (updated.length === 0) {
            return withCors(NextResponse.json({ error: "Product not found" }, { status: 404 }));
        }

        await emitProductChange(updated[0].id, {
            slug: updated[0].slug,
            reason: "sync-stock-pos",
            changedFields: ["stock"],
        });

        return withCors(NextResponse.json({
            success: true,
            message: "Stock synchronized",
            product: {
                id: updated[0].id,
                sku: updated[0].sku,
                stock: updated[0].webStock,
            },
        }, { status: 200 }));
    } catch (error: any) {
        if (error?.name === "ZodError") {
            return withCors(NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 }));
        }

        console.error("[POS_SYNC_STOCK_PUT]", error);
        return withCors(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
    }
}

export async function PUT(req: NextRequest) {
    return handleStockSync(req);
}

export async function POST(req: NextRequest) {
    return handleStockSync(req);
}
