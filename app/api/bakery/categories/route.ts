import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bakeryCategories } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** GET /api/bakery/categories — lista pública de categorías activas (para form y display). */
export async function GET() {
    try {
        const rows = await db
            .select()
            .from(bakeryCategories)
            .where(eq(bakeryCategories.active, true))
            .orderBy(asc(bakeryCategories.sortOrder), asc(bakeryCategories.label));
        return NextResponse.json(rows.map((c) => ({
            id: c.id,
            slug: c.slug,
            label: c.label,
            sortOrder: c.sortOrder,
        })));
    } catch (error) {
        console.error("[BAKERY_CATEGORIES_GET]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}
