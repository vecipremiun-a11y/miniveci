import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { categorySchema } from "@/lib/validations/category";
import { desc, eq, sql } from "drizzle-orm";
import { ZodError } from "zod";

export async function GET(req: NextRequest) {
    try {
        await requireAuth();

        // Fetch categories with product count
        // Note: Drizzle doesn't support easy relations count in one query without relations definitions or raw SQL join
        // For simplicity efficiently, we can do a left join and count

        // Using raw SQL for the count might be cleaner or query builder
        const result = await db.select({
            id: categories.id,
            name: categories.name,
            slug: categories.slug,
            isActive: categories.isActive,
            imageUrl: categories.imageUrl,
            productCount: sql<number>`count(${products.id})`.mapWith(Number)
        })
            .from(categories)
            .leftJoin(products, eq(categories.id, products.categoryId))
            .groupBy(categories.id)
            .orderBy(desc(categories.createdAt));

        return NextResponse.json(result);
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[CATEGORIES_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await requireAuth();
        // Verify admin/owner role if needed, requireAuth checks generic login

        const body = await req.json();
        const validatedData = categorySchema.parse(body);

        // Check slug uniqueness
        const existingSlugResult = await db.select().from(categories).where(eq(categories.slug, validatedData.slug)).limit(1);
        if (existingSlugResult.length > 0) {
            return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
        }

        const newCategory = await db.insert(categories).values({
            id: crypto.randomUUID(),
            ...validatedData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }).returning();

        return NextResponse.json(newCategory[0], { status: 201 });

    } catch (error: any) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (error?.name === 'ZodError' || error instanceof ZodError) {
            return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
        }
        console.error("[CATEGORIES_POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
