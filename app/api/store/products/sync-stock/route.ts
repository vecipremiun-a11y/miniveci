import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiCredentials, products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { emitProductChange } from "@/lib/product-live-updates";

export const dynamic = "force-dynamic";

const syncStockSchema = z.object({
    sku: z.string().min(1, "SKU requerido"),
    stock: z.number(),
});

/** Normaliza stock: negativos → 0, unidades enteras → floor, kg/lt → 2 decimales */
function normalizeStock(stock: number, unit?: string | null): number {
    if (stock < 0) stock = 0;
    const u = (unit ?? "un").toLowerCase();
    if (u === "kg" || u === "lt") {
        return Math.round(stock * 100) / 100;
    }
    return Math.floor(stock);
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

export async function PUT(req: NextRequest) {
    try {
        const { apiKey, apiSecret } = extractCredentials(req);

        if (!apiKey || !apiSecret) {
            return NextResponse.json({ error: "Missing api_key or api_secret" }, { status: 401 });
        }

        const credentials = await db.query.apiCredentials.findFirst({
            where: eq(apiCredentials.id, "main"),
        });

        if (!credentials) {
            return NextResponse.json({ error: "API credentials not configured" }, { status: 503 });
        }

        if (credentials.clientId !== apiKey || credentials.clientSecret !== apiSecret) {
            return NextResponse.json({ error: "Invalid api_key or api_secret" }, { status: 401 });
        }

        const body = await req.json();
        const { sku, stock } = syncStockSchema.parse(body);

        // Buscar producto para obtener unidad y normalizar stock
        const existing = await db.query.products.findFirst({
            where: eq(products.sku, sku),
            columns: { unit: true },
        });

        if (!existing) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const normalizedStock = normalizeStock(stock, existing.unit);

        const updated = await db
            .update(products)
            .set({
                webStock: normalizedStock,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(products.sku, sku))
            .returning({
                id: products.id,
                sku: products.sku,
                slug: products.slug,
                webStock: products.webStock,
            });

        if (updated.length === 0) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        await emitProductChange(updated[0].id, {
            slug: updated[0].slug,
            reason: "sync-stock",
            changedFields: ["stock"],
        });

        return NextResponse.json({
            success: true,
            product: {
                id: updated[0].id,
                sku: updated[0].sku,
                stock: updated[0].webStock,
            },
        });
    } catch (error: any) {
        if (error?.name === "ZodError") {
            return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
        }

        console.error("[SYNC_STOCK_PUT]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
