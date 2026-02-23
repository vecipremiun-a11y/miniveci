import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, categories, productImages } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { productSchema } from "@/lib/validations/product";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> } // Params as promise for Next.js 15
) {
    try {
        await requireAuth();
        const { id } = await params;

        const product = await db.query.products.findFirst({
            where: eq(products.id, id),
            with: {
                images: true, // Assuming relation is defined in schema or we need to fetch separately
            }
        });

        if (!product) {
            return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
        }

        // Since `images` relation might not be strictly defined in schema.ts provided (it was using standard drizzle-kit w/o relations), 
        // let's fetch images manually if 'with' doesn't work out of the box without relations definitions.
        // But let's assume valid relations setup or manual fetch.
        // Based on provided schema.ts, NO RELATIONS were exported in schema.ts.
        // So we fetch images manually.
        const images = await db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(productImages.sortOrder);

        return NextResponse.json({ ...product, images });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[PRODUCT_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth();
        const { id } = await params;
        const body = await req.json();

        const validatedData = productSchema.partial().parse(body);

        const existingResult = await db.select().from(products).where(eq(products.id, id)).limit(1);
        const existingProduct = existingResult[0];
        if (!existingProduct) {
            return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
        }

        // Check SKU uniqueness if changed
        if (validatedData.sku && validatedData.sku !== existingProduct.sku) {
            const existingSku = await db.query.products.findFirst({
                where: eq(products.sku, validatedData.sku)
            });
            if (existingSku) return NextResponse.json({ error: "El SKU ya existe" }, { status: 409 });
        }

        // Check Slug uniqueness if changed
        if (validatedData.slug && validatedData.slug !== existingProduct.slug) {
            const existingSlug = await db.query.products.findFirst({
                where: eq(products.slug, validatedData.slug)
            });
            if (existingSlug) return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
        }

        const { categoryId, ...productData } = validatedData;

        await db.update(products).set({
            ...productData,
            categoryId: categoryId, // Optional update
            updatedAt: new Date().toISOString(),
        }).where(eq(products.id, id));

        return NextResponse.json({ success: true });

    } catch (error: any) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (error?.name === 'ZodError' || error instanceof ZodError) {
            return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
        }
        console.error("[PRODUCT_PUT]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth();
        const { id } = await params;

        // Verify product exists before deleting
        const existCheck = await db.select({ id: products.id }).from(products).where(eq(products.id, id)).limit(1);
        if (existCheck.length === 0) {
            return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
        }

        await db.delete(products).where(eq(products.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[PRODUCT_DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
