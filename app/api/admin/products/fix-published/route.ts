import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { isNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

// Normaliza todos los productos con is_published = NULL a false (0).
// Esto arregla el bug donde el admin mostraba "Publicado" pero el producto
// no aparecía en la tienda porque NULL != 1 en SQL.
export async function POST() {
    try {
        await requireAuth();

        const fixed = await db
            .update(products)
            .set({ isPublished: false, updatedAt: new Date().toISOString() })
            .where(isNull(products.isPublished))
            .returning({ id: products.id, name: products.name });

        return NextResponse.json({
            success: true,
            fixed: fixed.length,
            products: fixed.map(p => p.name),
        });
    } catch (error) {
        console.error("[FIX_PUBLISHED]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
