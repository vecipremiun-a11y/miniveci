import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        // Single query with LEFT JOIN instead of N+1
        const result = await db.select({
            id: categories.id,
            name: categories.name,
            slug: categories.slug,
            description: categories.description,
            imageUrl: categories.imageUrl,
            productCount: sql<number>`count(CASE WHEN ${products.isPublished} = 1 THEN 1 END)`.mapWith(Number),
        })
            .from(categories)
            .leftJoin(products, eq(products.categoryId, categories.id))
            .where(eq(categories.isActive, true))
            .groupBy(categories.id)
            .orderBy(categories.sortOrder, categories.name);

        return NextResponse.json({ data: result });
    } catch (error) {
        console.error("[PUBLIC_API_CATEGORIES_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
