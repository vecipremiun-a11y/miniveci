import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bakeryProducts } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { serializeProduct } from "@/lib/bakery";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");
        const conditions = [eq(bakeryProducts.active, true)];
        if (category) {
            conditions.push(eq(bakeryProducts.category, category));
        }
        const rows = await db
            .select()
            .from(bakeryProducts)
            .where(and(...conditions))
            .orderBy(asc(bakeryProducts.sortOrder), asc(bakeryProducts.name));
        return NextResponse.json(rows.map(serializeProduct));
    } catch (error) {
        console.error("[BAKERY_PRODUCTS_GET]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}
