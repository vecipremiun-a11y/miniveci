import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveProduct, ProductInput, CategoryInput } from "@/lib/services/product-resolver";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: any) {
    try {
        const { slug } = await context.params;

        const rawProduct = await db.query.products.findFirst({
            where: and(
                eq(products.slug, slug),
                eq(products.isPublished, true)
            ),
            with: {
                category: true,
            }
        });

        if (!rawProduct) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const images = await db.query.productImages.findMany({
            where: eq(productImages.productId, rawProduct.id),
            orderBy: (productImages, { desc }) => [desc(productImages.isPrimary), desc(productImages.sortOrder)]
        });

        const resolved = resolveProduct(
            rawProduct as ProductInput,
            rawProduct.category as CategoryInput | null
        );

        if (!resolved.is_available) {
            return NextResponse.json({ error: "Product not found" }, { status: 404 });
        }

        const publicProduct = {
            id: rawProduct.id,
            name: rawProduct.name,
            slug: rawProduct.slug,
            description: rawProduct.webDescription || rawProduct.description,
            seoTitle: rawProduct.seoTitle,
            seoDescription: rawProduct.seoDescription,
            price: resolved.resolved_price,
            offerPrice: rawProduct.isOffer && rawProduct.offerPrice ? rawProduct.offerPrice : null,
            isOffer: Boolean(rawProduct.isOffer),
            stock: resolved.resolved_stock,
            unit: rawProduct.unit || "Und",
            equivLabel: rawProduct.equivLabel || null,
            equivWeight: rawProduct.equivWeight || null,
            category: rawProduct.category ? {
                id: (rawProduct.category as any).id,
                name: (rawProduct.category as any).name,
                slug: (rawProduct.category as any).slug
            } : null,
            images: images.map(img => ({
                id: img.id,
                url: img.url,
                altText: img.altText,
                isPrimary: img.isPrimary
            })),
            badges: rawProduct.badges,
            tags: rawProduct.tags,
            priceTiers: (rawProduct.priceTiers as any[]) ?? [],
        };

        return NextResponse.json(publicProduct);

    } catch (error) {
        console.error("[PUBLIC_API_PRODUCT_DETAIL_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
