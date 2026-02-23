import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productImages, products } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { eq, and } from "drizzle-orm";
import * as z from "zod";

const imageSchema = z.object({
    url: z.string().url("Invalid URL"),
    altText: z.string().optional(),
    isPrimary: z.boolean().default(false),
});

export async function POST(
    req: NextRequest,
    context: any
) {
    try {
        await requireAuth();
        const { params } = context;
        const resolvedParams = await params;
        const { id: productId } = resolvedParams;

        // Verify product exists
        const product = await db.query.products.findFirst({
            where: eq(products.id, productId),
        });

        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const body = await req.json();
        const { url, altText, isPrimary } = imageSchema.parse(body);

        // If setting as primary, unset others
        if (isPrimary) {
            await db.update(productImages)
                .set({ isPrimary: false })
                .where(eq(productImages.productId, productId));
        }

        // Determine sort order
        const existingImages = await db.query.productImages.findMany({
            where: eq(productImages.productId, productId),
            orderBy: (images, { desc }) => [desc(images.sortOrder)],
            limit: 1
        });

        const nextSortOrder = existingImages.length > 0 ? (existingImages[0].sortOrder || 0) + 1 : 0;

        const newImage = await db.insert(productImages).values({
            id: crypto.randomUUID(),
            productId,
            url,
            altText,
            isPrimary,
            sortOrder: nextSortOrder
        }).returning();

        return NextResponse.json(newImage[0], { status: 201 });

    } catch (error: any) {
        if (error?.name === 'ZodError' || error instanceof z.ZodError) {
            return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
        }
        console.error("[PRODUCT_IMAGES_POST]", error);
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
        const { id: productId } = resolvedParams;

        const { searchParams } = new URL(req.url);
        const imageId = searchParams.get("imageId");

        if (!imageId) {
            return NextResponse.json({ error: "imageId is required" }, { status: 400 });
        }

        const deletedImage = await db.delete(productImages)
            .where(
                and(
                    eq(productImages.id, imageId),
                    eq(productImages.productId, productId)
                )
            )
            .returning();

        if (deletedImage.length === 0) {
            return NextResponse.json({ error: "Image not found" }, { status: 404 });
        }

        return NextResponse.json({ message: "Image deleted successfully" });
    } catch (error) {
        console.error("[PRODUCT_IMAGES_DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
