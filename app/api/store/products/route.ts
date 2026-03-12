import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, categories, productImages } from "@/lib/db/schema";
import { eq, and, or, like, desc, inArray, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const categorySlug = searchParams.get("category");
        const search = searchParams.get("search")?.trim();
        const isFeatured = searchParams.get("featured") === "true";
        const onlyOffer = searchParams.get("offer") === "true";
        const maxPriceParam = searchParams.get("maxPrice");
        const maxPrice = maxPriceParam ? parseInt(maxPriceParam) || null : null;
        const page = parseInt(searchParams.get("page") || "1") || 1;
        const limit = Math.min(parseInt(searchParams.get("limit") || "20") || 20, 100);
        const offset = (page - 1) * limit;

        // Resolve Category Filter
        let categoryIdFilter: string | null = null;
        if (categorySlug) {
            const cats = await db.select().from(categories).where(and(eq(categories.slug, categorySlug), eq(categories.isActive, true))).limit(1);
            if (cats[0]) {
                categoryIdFilter = cats[0].id;
            } else {
                return NextResponse.json({ data: [], meta: { total: 0, page, limit, totalPages: 0 } });
            }
        }

        // Build WHERE conditions — all filtering at SQL level
        const conditions: any[] = [eq(products.isPublished, true)];

        // Effective stock > 0 (handles "reserved" stock source at SQL level)
        conditions.push(sql`(
            CASE
                WHEN ${products.stockSource} = 'reserved' THEN COALESCE(${products.webStock}, 0) - COALESCE(${products.reservedQty}, 0)
                WHEN (${products.stockSource} = 'global' OR ${products.stockSource} IS NULL) AND ${categories.syncStockSource} = 'reserved' THEN COALESCE(${products.webStock}, 0) - COALESCE(${products.reservedQty}, 0)
                ELSE COALESCE(${products.webStock}, 0)
            END > 0
        )`);

        if (categoryIdFilter) {
            conditions.push(eq(products.categoryId, categoryIdFilter));
        }

        if (isFeatured) {
            conditions.push(eq(products.isFeatured, true));
        }

        if (onlyOffer) {
            conditions.push(eq(products.isOffer, true));
        }

        if (search) {
            conditions.push(
                or(
                    like(products.name, `%${search}%`),
                    like(products.description, `%${search}%`),
                    like(categories.name, `%${search}%`)
                )
            );
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
            .orderBy(desc(products.createdAt))
            .limit(limit)
            .offset(offset);

        // Only fetch images for the paginated subset
        const productIds = rawProducts.map(p => p.product.id);
        let allImages: any[] = [];
        if (productIds.length > 0) {
            allImages = await db.select().from(productImages).where(inArray(productImages.productId, productIds));
        }

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
                category: cat ? {
                    id: cat.id,
                    name: cat.name,
                    slug: cat.slug,
                } : null,
                images: itemImages,
                badges: raw.badges,
                tags: raw.tags,
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
        console.error("[PUBLIC_API_PRODUCTS_GET]", error);
        return NextResponse.json({ error: "Internal Server Error", details: String(error) }, { status: 500 });
    }
}
