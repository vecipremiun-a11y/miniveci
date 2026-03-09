import { db } from "@/lib/db";
import { productImages, products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveProduct, type CategoryInput, type ProductInput } from "@/lib/services/product-resolver";
import type { StoreProductPayload } from "@/lib/store-product-types";

export async function getPublicStoreProductById(productId: string): Promise<StoreProductPayload | null> {
    const rawProduct = await db.query.products.findFirst({
        where: eq(products.id, productId),
        with: {
            category: true,
        },
    });

    if (!rawProduct) {
        return null;
    }

    const images = await db.query.productImages.findMany({
        where: eq(productImages.productId, rawProduct.id),
        orderBy: (productImagesTable, { desc }) => [desc(productImagesTable.isPrimary), desc(productImagesTable.sortOrder)],
    });

    const resolved = resolveProduct(
        rawProduct as ProductInput,
        rawProduct.category as CategoryInput | null,
    );

    if (!resolved.is_available || resolved.resolved_stock <= 0) {
        return null;
    }

    return {
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
        category: rawProduct.category
            ? {
                id: rawProduct.category.id,
                name: rawProduct.category.name,
                slug: rawProduct.category.slug,
            }
            : null,
        images: images.map((image) => ({
            id: image.id,
            url: image.url,
            altText: image.altText,
            isPrimary: Boolean(image.isPrimary),
        })),
        badges: (rawProduct.badges as string[] | null) ?? null,
        tags: (rawProduct.tags as string[] | null) ?? null,
    };
}
