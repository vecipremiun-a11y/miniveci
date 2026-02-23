import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, posConfig, productImages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveProduct, ProductInput, CategoryInput, PosConfigInput } from "@/lib/services/product-resolver";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: any) {
    try {
        const { slug } = await context.params;

        const globalConfig = await db.query.posConfig.findFirst({
            where: eq(posConfig.id, "main")
        });

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
            rawProduct.category as CategoryInput | null,
            globalConfig as PosConfigInput | null
        );

        if (!resolved.is_available || resolved.resolved_stock <= 0) {
            return NextResponse.json({ error: "Product not found or out of stock" }, { status: 404 });
        }

        const publicProduct = {
            id: rawProduct.id,
            name: rawProduct.name,
            slug: rawProduct.slug,
            description: rawProduct.webDescription || rawProduct.description,
            seoTitle: rawProduct.seoTitle,
            seoDescription: rawProduct.seoDescription,
            price: resolved.resolved_price,
            stock: resolved.resolved_stock,
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
            tags: rawProduct.tags
        };

        return NextResponse.json(publicProduct);

    } catch (error) {
        console.error("[PUBLIC_API_PRODUCT_DETAIL_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
