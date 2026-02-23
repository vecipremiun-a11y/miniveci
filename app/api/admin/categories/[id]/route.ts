import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { eq } from "drizzle-orm";
import * as z from "zod";

const categorySchema = z.object({
    name: z.string().min(1, "Name is required"),
    slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug"),
    description: z.string().optional(),
    isActive: z.boolean().default(true),
    syncPriceSource: z.enum(["global", "pos", "manual"]).default("global"),
    syncStockSource: z.enum(["global", "pos", "manual"]).default("global"),
});

export async function GET(
    req: NextRequest,
    context: any
) {
    try {
        await requireAuth();
        const { params } = context;
        const resolvedParams = await params;
        const { id } = resolvedParams;

        const category = await db.query.categories.findFirst({
            where: eq(categories.id, id),
        });

        if (!category) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }

        return NextResponse.json(category);
    } catch (error) {
        console.error("[CATEGORY_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    context: any
) {
    try {
        await requireAuth();
        const { params } = context;
        const resolvedParams = await params;
        const { id } = resolvedParams;

        const body = await req.json();
        const validatedData = categorySchema.parse(body);

        // Check Slug Uniqueness (excluding self)
        const existingSlug = await db.query.categories.findFirst({
            where: eq(categories.slug, validatedData.slug)
        });

        if (existingSlug && existingSlug.id !== id) {
            return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
        }

        const updatedCategory = await db.update(categories)
            .set({
                name: validatedData.name,
                slug: validatedData.slug,
                description: validatedData.description,
                isActive: validatedData.isActive,
                syncPriceSource: validatedData.syncPriceSource,
                syncStockSource: validatedData.syncStockSource,
                updatedAt: new Date().toISOString(),
            })
            .where(eq(categories.id, id))
            .returning();

        if (updatedCategory.length === 0) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }

        return NextResponse.json(updatedCategory[0]);

    } catch (error: any) {
        if (error?.name === 'ZodError' || error instanceof z.ZodError) {
            return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
        }
        console.error("[CATEGORY_PUT]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: any
) {
    try {
        await requireAuth();
        const { params } = context;
        const resolvedParams = await params;
        const { id } = resolvedParams;

        // Verify if category is used in any products
        const productsCount = await db.select().from(products).where(eq(products.categoryId, id)).limit(1);

        if (productsCount.length > 0) {
            return NextResponse.json(
                { error: "No se puede eliminar la categoría porque hay productos que la usan." },
                { status: 400 }
            );
        }

        const deletedCategory = await db.delete(categories)
            .where(eq(categories.id, id))
            .returning();

        if (deletedCategory.length === 0) {
            return NextResponse.json({ error: "Category not found" }, { status: 404 });
        }

        return NextResponse.json({ message: "Category deleted successfully" });
    } catch (error) {
        console.error("[CATEGORY_DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
