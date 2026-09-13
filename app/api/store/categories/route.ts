import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { orderAsTree, branchCounts } from "@/lib/category-tree";

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
            parentId: categories.parentId,
            sortOrder: categories.sortOrder,
            productCount: sql<number>`count(CASE WHEN ${products.isPublished} = 1 THEN 1 END)`.mapWith(Number),
        })
            .from(categories)
            .leftJoin(products, eq(products.categoryId, categories.id))
            .where(eq(categories.isActive, true))
            .groupBy(categories.id)
            .orderBy(categories.sortOrder, categories.name);

        // La jerarquía que manda POSVECI: cada categoría seguida de sus hijas, con
        // el nivel para sangrarlas. `branchProductCount` es lo que realmente trae al
        // elegirla (lo suyo más lo de sus hijas), que es el número que se muestra.
        const ownCounts = Object.fromEntries(result.map((c) => [c.id, c.productCount]));
        const totals = branchCounts(result, ownCounts);
        const data = orderAsTree(result).map((category) => ({
            ...category,
            branchProductCount: totals[category.id] ?? category.productCount,
        }));

        return NextResponse.json({ data });
    } catch (error) {
        console.error("[PUBLIC_API_CATEGORIES_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
