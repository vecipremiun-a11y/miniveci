import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, categories, productImages } from "@/lib/db/schema";
import { eq, and, or, like, desc, inArray, sql } from "drizzle-orm";
import { resolveProduct, ProductInput, CategoryInput } from "@/lib/services/product-resolver";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const categorySlug = searchParams.get("category");
        const search = searchParams.get("search")?.trim();
        const isFeatured = searchParams.get("featured") === "true";
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

        // Build WHERE conditions
        const conditions: any[] = [eq(products.isPublished, true)];

        if (categoryIdFilter) {
            conditions.push(eq(products.categoryId, categoryIdFilter));
        }

        if (isFeatured) {
            conditions.push(eq(products.isFeatured, true));
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

        const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

        // Fetch products using select builder
        const rawProducts = await db
            .select({
                product: products,
                categoryData: categories,
            })
            .from(products)
            .leftJoin(categories, eq(products.categoryId, categories.id))
            .where(whereClause)
            .orderBy(desc(products.createdAt));

        // Fetch images for these products
        const productIds = rawProducts.map(p => p.product.id);
        let allImages: any[] = [];
        if (productIds.length > 0) {
            allImages = await db.select().from(productImages).where(inArray(productImages.productId, productIds));
        }

        // Resolve logic
        const publicProducts: any[] = [];

        for (const row of rawProducts) {
            const raw = row.product;
            const cat = row.categoryData;

            const resolved = resolveProduct(
                raw as ProductInput,
                cat as CategoryInput | null
            );

            if (resolved.is_available && resolved.resolved_stock > 0) {
                const itemImages = allImages.filter(i => i.productId === raw.id).map(img => ({
                    id: img.id,
                    url: img.url,
                    altText: img.altText,
                    isPrimary: img.isPrimary
                }));

                publicProducts.push({
                    id: raw.id,
                    name: raw.name,
                    slug: raw.slug,
                    description: raw.description,
                    seoTitle: raw.seoTitle,
                    seoDescription: raw.seoDescription,
                    price: resolved.resolved_price,
                    stock: resolved.resolved_stock,
                    category: cat ? {
                        id: cat.id,
                        name: cat.name,
                        slug: cat.slug
                    } : null,
                    images: itemImages,
                    badges: raw.badges,
                    tags: raw.tags
                });
            }
        }

        // Manual Pagination
        const paginatedData = publicProducts.slice(offset, offset + limit);
        const total = publicProducts.length;

        return NextResponse.json({
            data: paginatedData,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("[PUBLIC_API_PRODUCTS_GET]", error);
        return NextResponse.json({ error: "Internal Server Error", details: String(error) }, { status: 500 });
    }
}
