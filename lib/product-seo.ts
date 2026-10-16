import { cache } from "react";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, productImages } from "@/lib/db/schema";
import { isOfferActive } from "@/lib/product-price";
import { resolveProduct, type CategoryInput, type ProductInput } from "@/lib/services/product-resolver";
import { COMERCIAL_VECI_BADGE } from "@/lib/store-product-types";
import type { ProductSeo } from "@/lib/seo";

export type ProductSeoResult =
    | { status: "found"; product: ProductSeo; seoTitle: string | null; seoDescription: string | null }
    | { status: "not-found" }
    | { status: "error" };

/**
 * Lo que necesita el servidor para la metadata y el JSON-LD de la ficha de un
 * producto. Mismo filtro y precio públicos que /api/store/products/[slug],
 * sin el precio de suscriptor: Google tiene que ver el precio que ve cualquiera.
 *
 * Distingue "no existe" (la página responde 404) de "falló la base" (la página
 * se muestra igual, sin datos estructurados, y el cliente reintenta su fetch).
 * `cache` evita consultar dos veces entre generateMetadata y la página.
 */
export const getProductSeo = cache(async (slug: string): Promise<ProductSeoResult> => {
    try {
        const raw = await db.query.products.findFirst({
            where: and(eq(products.slug, slug), sql`${products.isPublished} = 1`),
            with: { category: true },
        });
        if (!raw) return { status: "not-found" };

        const images = await db.query.productImages.findMany({
            where: eq(productImages.productId, raw.id),
            orderBy: (productImages, { desc }) => [desc(productImages.isPrimary), desc(productImages.sortOrder)],
        });

        const category = raw.category as { name: string; slug: string } | null;
        const resolved = resolveProduct(raw as ProductInput, category as CategoryInput | null);
        const offerActive = isOfferActive(raw);
        const badges = Array.isArray(raw.badges) ? (raw.badges as string[]) : [];

        return {
            status: "found",
            seoTitle: raw.seoTitle?.trim() || null,
            seoDescription: raw.seoDescription?.trim() || null,
            product: {
                name: raw.name,
                slug: raw.slug,
                description: (raw.webDescription || raw.description)?.trim() || null,
                price: offerActive && raw.offerPrice ? raw.offerPrice : resolved.resolved_price,
                stock: resolved.resolved_stock,
                offerEndsAt: offerActive ? raw.offerEndsAt ?? null : null,
                category: category ? { name: category.name, slug: category.slug } : null,
                images: images.map((img) => ({ url: img.url, alt: img.altText || raw.name })),
                isOwnBrand: badges.includes(COMERCIAL_VECI_BADGE),
            },
        };
    } catch (error) {
        console.error("[product-seo] no se pudo leer el producto", slug, error);
        return { status: "error" };
    }
});
