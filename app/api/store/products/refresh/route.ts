import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

const REFRESH_WINDOW_MS = 15000;

declare global {
    // eslint-disable-next-line no-var
    var __storefrontPosRefreshState: Map<string, number> | undefined;
}

function getRefreshState() {
    if (!globalThis.__storefrontPosRefreshState) {
        globalThis.__storefrontPosRefreshState = new Map<string, number>();
    }

    return globalThis.__storefrontPosRefreshState;
}

export async function POST(req: NextRequest) {
    let signature: string | null = null;

    try {
        const body = await req.json();
        const productIds = Array.isArray(body?.productIds)
            ? body.productIds.map((value: unknown) => String(value)).filter(Boolean).slice(0, 24)
            : [];

        if (productIds.length === 0) {
            return NextResponse.json({ success: true, skipped: true, reason: "no-products" });
        }

        signature = [...productIds].sort().join(",");
        const refreshState = getRefreshState();
        const lastRun = refreshState.get(signature) ?? 0;
        const now = Date.now();

        if (now - lastRun < REFRESH_WINDOW_MS) {
            return NextResponse.json({ success: true, skipped: true, reason: "cooldown" });
        }

        refreshState.set(signature, now);

        const matchingProducts = await db.select({
            id: products.id,
            sku: products.sku,
        })
            .from(products)
            .where(inArray(products.id, productIds));

        if (matchingProducts.length === 0) {
            return NextResponse.json({ success: true, skipped: true, reason: "not-found" });
        }

        return NextResponse.json({
            success: true,
            skipped: true,
            reason: "pos-sync-disabled",
            productsChecked: matchingProducts.length,
        });
    } catch (error: any) {
        if (signature) {
            getRefreshState().delete(signature);
        }

        return NextResponse.json({
            success: false,
            skipped: true,
            reason: "refresh-failed",
            error: error.message || "Refresh failed",
        });
    }
}
