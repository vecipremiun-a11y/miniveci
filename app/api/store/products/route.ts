import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, categories, productImages } from "@/lib/db/schema";
import { eq, and, desc, asc, inArray, sql } from "drizzle-orm";
import { tokenizeSearch } from "@/lib/search-text";
import { searchTokensCondition } from "@/lib/search-sql";
import { branchIds } from "@/lib/category-tree";
import { getSessionCustomerId } from "@/lib/session-customer";
import { hasActiveSubscription } from "@/lib/subscriptions";
import { quickFilterConditions } from "@/lib/store-filters";
import { tierGroupKey } from "@/lib/product-price";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const categorySlug = searchParams.get("category");
        const search = searchParams.get("search")?.trim();
        const isFeatured = searchParams.get("featured") === "true";
        const onlyOffer = searchParams.get("offer") === "true";
        const onlyVeciSeal = searchParams.get("veci") === "true";
        // Productos de un grupo de escala (carrusel "combínalo con" de la ficha).
        const tierGroupParam = tierGroupKey(searchParams.get("group"));
        const maxPriceParam = searchParams.get("maxPrice");
        const maxPrice = maxPriceParam ? parseInt(maxPriceParam) || null : null;
        const sortParam = searchParams.get("sort") || "newest";
        const page = parseInt(searchParams.get("page") || "1") || 1;
        const limit = Math.min(parseInt(searchParams.get("limit") || "20") || 20, 100);
        const offset = (page - 1) * limit;

        // Resolve Category Filter — elegir una categoría trae TODA su rama
        // (subcategorías y sus hijas), igual que el inventario de POSVECI:
        // "Amasandería" tiene que traer también Panes y Empanadas.
        let branchCategoryIds: string[] | null = null;
        if (categorySlug) {
            const activeCats = await db
                .select({ id: categories.id, name: categories.name, parentId: categories.parentId, slug: categories.slug })
                .from(categories)
                .where(eq(categories.isActive, true));
            const target = activeCats.find((c) => c.slug === categorySlug);
            if (!target) {
                return NextResponse.json({ data: [], meta: { total: 0, page, limit, totalPages: 0 } });
            }
            branchCategoryIds = branchIds(activeCats, target.id);
        }

        // Build WHERE conditions — all filtering at SQL level
        const conditions: any[] = [sql`${products.isPublished} = 1`];

        // Products with stock 0 are shown but with "Sin stock" label

        if (branchCategoryIds) {
            conditions.push(inArray(products.categoryId, branchCategoryIds));
        }

        if (isFeatured) {
            conditions.push(eq(products.isFeatured, true));
        }

        conditions.push(...quickFilterConditions({ onlyOffer, onlyVeciSeal }));

        // El grupo se compara sin mayúsculas ni tildes (tierGroupKey), cosa que
        // SQLite no hace bien; como son pocos los productos con grupo, se traen
        // los que tienen uno y se filtran acá.
        if (tierGroupParam) {
            const grouped = await db
                .select({ id: products.id, tierGroup: products.tierGroup })
                .from(products)
                .where(sql`${products.tierGroup} IS NOT NULL`);
            const ids = grouped.filter((g) => tierGroupKey(g.tierGroup) === tierGroupParam).map((g) => g.id);
            if (ids.length === 0) {
                return NextResponse.json({ data: [], meta: { total: 0, page, limit, totalPages: 0 } });
            }
            conditions.push(inArray(products.id, ids));
        }

        // Cada palabra debe aparecer en nombre, descripción o categoría, en cualquier orden
        // y sin importar tildes. Los que tienen todas las palabras en el nombre salen primero.
        const searchTokens = search ? tokenizeSearch(search) : [];
        const searchCondition = searchTokensCondition(searchTokens, [products.name, products.description, categories.name]);
        const nameMatchCondition = searchTokensCondition(searchTokens, [products.name]);
        if (searchCondition) {
            conditions.push(searchCondition);
        }

        // maxPrice filter at SQL level
        if (maxPrice !== null) {
            conditions.push(sql`(
                CASE
                    WHEN ${products.isOffer} = 1 AND ${products.offerPrice} IS NOT NULL THEN ${products.offerPrice}
                    ELSE COALESCE(${products.webPrice}, 0)
                END <= ${maxPrice}
            )`);
        }

        const whereClause = and(...conditions);

        // COUNT total at SQL level (no need to fetch all rows)
        const countResult = await db
            .select({ total: sql<number>`count(*)` })
            .from(products)
            .leftJoin(categories, eq(products.categoryId, categories.id))
            .where(whereClause);
        const total = countResult[0]?.total ?? 0;

        // Fetch only the paginated products (LIMIT/OFFSET at DB level)
        const rawProducts = await db
            .select({
                product: products,
                categoryData: categories,
            })
            .from(products)
            .leftJoin(categories, eq(products.categoryId, categories.id))
            .where(whereClause)
            .orderBy(
                // Out-of-stock products always go last
                asc(sql`CASE WHEN COALESCE(${products.webStock}, 0) <= 0 THEN 1 ELSE 0 END`),
                ...(nameMatchCondition ? [asc(sql`CASE WHEN ${nameMatchCondition} THEN 0 ELSE 1 END`)] : []),
                ...(sortParam === 'price_asc' ? [asc(products.webPrice)] :
                    sortParam === 'price_desc' ? [desc(products.webPrice)] :
                    sortParam === 'featured' ? [desc(products.isFeatured), desc(products.createdAt)] :
                    [desc(products.createdAt)])
            )
            .limit(limit)
            .offset(offset);

        // Only fetch images for the paginated subset
        const productIds = rawProducts.map(p => p.product.id);
        let allImages: any[] = [];
        if (productIds.length > 0) {
            allImages = await db.select().from(productImages).where(inArray(productImages.productId, productIds));
        }

        // El precio de suscriptor solo viaja si quien mira ES suscriptor: así
        // la presencia del campo ya es la señal para el front, sin tener que
        // mandarle aparte si tiene membresía. Ver resolveUnitPrice.
        const isSubscriber = await hasActiveSubscription(await getSessionCustomerId());

        // Map results (resolve price/stock inline — no loop over all products)
        const publicProducts = rawProducts.map(row => {
            const raw = row.product;
            const cat = row.categoryData;

            const resolvedPrice = raw.webPrice ?? 0;
            let resolvedStock = raw.webStock ?? 0;
            const stockSource = raw.stockSource || "global";
            if (stockSource === "reserved" || (stockSource === "global" && cat?.syncStockSource === "reserved")) {
                resolvedStock = Math.max(0, (raw.webStock ?? 0) - (raw.reservedQty ?? 0));
            }

            const itemImages = allImages.filter(i => i.productId === raw.id).map(img => ({
                id: img.id,
                url: img.url,
                altText: img.altText,
                isPrimary: img.isPrimary,
            }));

            return {
                id: raw.id,
                name: raw.name,
                slug: raw.slug,
                description: raw.description,
                seoTitle: raw.seoTitle,
                seoDescription: raw.seoDescription,
                price: resolvedPrice,
                offerPrice: raw.isOffer && raw.offerPrice ? raw.offerPrice : null,
                isOffer: Boolean(raw.isOffer),
                stock: resolvedStock,
                unit: raw.unit || "Und",
                equivLabel: raw.equivLabel || null,
                equivWeight: raw.equivWeight || null,
                category: cat ? {
                    id: cat.id,
                    name: cat.name,
                    slug: cat.slug,
                } : null,
                images: itemImages,
                badges: raw.badges,
                tags: raw.tags,
                priceTiers: (raw.priceTiers as any[]) ?? [],
                tierGroup: raw.tierGroup ?? null,
                subscriptionPrice: isSubscriber && raw.subscriptionPrice ? raw.subscriptionPrice : null,
            };
        });

        return NextResponse.json({
            data: publicProducts,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        });

    } catch (error) {
        // El detalle del error va solo al log del servidor: devolverlo al cliente
        // filtraba mensajes internos (esquema, conexión) en una ruta pública.
        console.error("[PUBLIC_API_PRODUCTS_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
