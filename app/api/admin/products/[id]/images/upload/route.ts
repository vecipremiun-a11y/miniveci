import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { productImages, products } from "@/lib/db/schema";
import { requireAuth } from "@/lib/auth-utils";
import { emitProductChange } from "@/lib/product-live-updates";
import { eq } from "drizzle-orm";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(
    req: NextRequest,
    context: any
) {
    try {
        await requireAuth();
        const { params } = context;
        const { id: productId } = await params;

        const product = await db.query.products.findFirst({
            where: eq(products.id, productId),
            columns: { id: true, slug: true, sku: true },
        });

        if (!product) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: "Formato no válido. Sube JPG, PNG, WebP o AVIF." },
                { status: 400 }
            );
        }

        if (file.size > MAX_SIZE) {
            return NextResponse.json(
                { error: "El archivo es muy grande. Máximo 5MB." },
                { status: 400 }
            );
        }

        const ext = file.name.split(".").pop() || "jpg";
        const filename = `products/${product.sku || productId}-${Date.now()}.${ext}`;

        const blob = await put(filename, file, {
            access: "public",
            addRandomSuffix: true,
        });

        // Check if this is the first image (make it primary)
        const existingImages = await db.query.productImages.findMany({
            where: eq(productImages.productId, productId),
            columns: { id: true },
        });

        const isPrimary = existingImages.length === 0;

        if (isPrimary) {
            // Unset other primaries just in case
            await db.update(productImages)
                .set({ isPrimary: false })
                .where(eq(productImages.productId, productId));
        }

        const newImage = await db.insert(productImages).values({
            id: crypto.randomUUID(),
            productId,
            url: blob.url,
            isPrimary,
            sortOrder: existingImages.length,
        }).returning();

        await emitProductChange(productId, {
            slug: product.slug,
            reason: "image-uploaded",
            changedFields: ["images"],
        });

        return NextResponse.json(newImage[0], { status: 201 });
    } catch (error) {
        console.error("[PRODUCT_IMAGE_UPLOAD]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
