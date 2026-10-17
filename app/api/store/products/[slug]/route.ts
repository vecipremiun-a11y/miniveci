import { NextRequest, NextResponse } from "next/server";
import { isOfferActive } from "@/lib/product-price";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { resolveProduct, ProductInput, CategoryInput } from "@/lib/services/product-resolver";
import { getSessionCustomerId } from "@/lib/session-customer";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { presentationsAllowed } from "@/lib/product-presentations";
import { loadStorePresentations } from "@/lib/product-presentations-db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, context: any) {
    try {
        const { slug } = await context.params;

        const rawProduct = await db.query.products.findFirst({
            where: and(
                eq(products.slug, slug),
                sql`${products.isPublished} = 1`
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

        // Solo se manda a quien ES suscriptor (ver la lista de productos).
        const isSubscriber = await hasActiveSubscription(await getSessionCustomerId());

        // Oferta vencida (offerEndsAt en el pasado) = precio normal para todos.
        const offerActive = isOfferActive(rawProduct);

        // Unidades de medida (Caja, Bandeja…), solo en los productos por unidad.
        const presentations = presentationsAllowed(rawProduct)
            ? (await loadStorePresentations([rawProduct.id])).get(rawProduct.id) ?? []
            : [];

        const publicProduct = {
            id: rawProduct.id,
            name: rawProduct.name,
            slug: rawProduct.slug,
            description: rawProduct.webDescription || rawProduct.description,
            seoTitle: rawProduct.seoTitle,
            seoDescription: rawProduct.seoDescription,
            price: resolved.resolved_price,
            offerPrice: offerActive ? rawProduct.offerPrice : null,
            isOffer: offerActive,
            offerEndsAt: offerActive ? rawProduct.offerEndsAt ?? null : null,
            offerStock: offerActive ? rawProduct.offerStock ?? null : null,
            subscriptionPrice: isSubscriber && rawProduct.subscriptionPrice ? rawProduct.subscriptionPrice : null,
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
            tierGroup: rawProduct.tierGroup ?? null,
            presentations,
        };

        return NextResponse.json(publicProduct);

    } catch (error) {
        console.error("[PUBLIC_API_PRODUCT_DETAIL_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
