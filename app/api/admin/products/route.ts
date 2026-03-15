import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products, categories, productImages } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { emitProductChange } from "@/lib/product-live-updates";
import { productSchema } from "@/lib/validations/product";
import { desc, asc, eq, and, or, sql, inArray } from "drizzle-orm";
import { ZodError } from "zod";

export async function GET(req: NextRequest) {
    try {
        await requireAuth();

        const { searchParams } = new URL(req.url);
        const page = Math.max(parseInt(searchParams.get("page") || "1") || 1, 1);
        const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "10") || 10, 1), 100);
        const offset = (page - 1) * limit;

        const search = searchParams.get("search");
        const categoryId = searchParams.get("category");
        const status = searchParams.get("status"); // published, draft, all
        const stock = searchParams.get("stock"); // in_stock, out_of_stock, low_stock
        const priceSource = searchParams.get("price_source");
        const sort = searchParams.get("sort") || "createdAt";
        const order = searchParams.get("order") || "desc";

        const conditions = [];

        // Search (case-insensitive using LOWER for proper Unicode support)
        if (search) {
            const term = search.trim().toLowerCase();
            conditions.push(
                or(
                    sql`LOWER(${products.name}) LIKE ${'%' + term + '%'}`,
                    sql`LOWER(${products.sku}) LIKE ${'%' + term + '%'}`
                )
            );
        }

        // Category
        if (categoryId) {
            conditions.push(eq(products.categoryId, categoryId));
        }

        // Status
        if (status === "published") {
            conditions.push(eq(products.isPublished, true));
        } else if (status === "draft") {
            conditions.push(eq(products.isPublished, false));
        }

        // Price Source
        if (priceSource && priceSource !== "all") {
            conditions.push(eq(products.priceSource, priceSource));
        }

        // Stock Filter
        // Note: This logic is simplified. "low_stock" is hardcoded to < 5 for now.
        // Ideally, stock is determined by stockSource, but for list filtering we might just check webStock or do complex logic.
        // For this MVP, we will filter based on `webStock` which is the "effective" stock displayed
        if (stock === "in_stock") {
            conditions.push(sql`${products.webStock} > 0`);
        } else if (stock === "out_of_stock") {
            conditions.push(sql`${products.webStock} = 0`);
        } else if (stock === "low_stock") {
            conditions.push(and(sql`${products.webStock} > 0`, sql`${products.webStock} < 5`));
        }


        // Build Query
        const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

        // Sort
        let orderBy = desc(products.createdAt);
        if (sort === "name") orderBy = order === "asc" ? asc(products.name) : desc(products.name);
        if (sort === "price") orderBy = order === "asc" ? asc(products.webPrice) : desc(products.webPrice);
        if (sort === "stock") orderBy = order === "asc" ? asc(products.webStock) : desc(products.webStock);

        // Execute Query
        const data = await db.select({
            product: products,
            categoryName: categories.name,
            imageUrl: sql<string | null>`(SELECT url FROM product_images WHERE product_id = ${products.id} AND is_primary = 1 LIMIT 1)`,
        })
            .from(products)
            .leftJoin(categories, eq(products.categoryId, categories.id))
            .where(whereCondition)
            .limit(limit)
            .offset(offset)
            .orderBy(orderBy);

        // Get Total Count for Pagination
        // Drizzle simplified count
        const countResult = await db.select({ count: sql<number>`count(*)` })
            .from(products)
            .where(whereCondition);

        const total = countResult[0].count;
        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            products: data.map(d => ({ ...d.product, categoryName: d.categoryName, imageUrl: d.imageUrl })),
            total,
            page,
            totalPages
        });

    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[PRODUCTS_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await requireAuth();
        const body = await req.json();

        const validatedData = productSchema.parse(body);

        // Check SKU Uniqueness
        const existingSku = await db.query.products.findFirst({
            where: eq(products.sku, validatedData.sku)
        });
        if (existingSku) {
            return NextResponse.json({ error: "El SKU ya existe" }, { status: 409 });
        }

        // Check Slug Uniqueness
        const existingSlug = await db.query.products.findFirst({
            where: eq(products.slug, validatedData.slug)
        });
        if (existingSlug) {
            return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
        }

        const { categoryId, ...productData } = validatedData;

        // Create Product
        const newProduct = await db.insert(products).values({
            id: crypto.randomUUID(),
            categoryId: categoryId || null,
            sku: productData.sku,
            name: productData.name,
            slug: productData.slug,
            description: productData.description,
            webPrice: productData.webPrice,
            webStock: productData.webStock,
            webTitle: productData.webTitle,
            webDescription: productData.webDescription,
            seoTitle: productData.seoTitle,
            seoDescription: productData.seoDescription,
            priceSource: productData.priceSource,
            stockSource: productData.stockSource,
            reservedQty: productData.reservedQty,
            isPublished: productData.isPublished,
            isFeatured: productData.isFeatured,
            tags: productData.tags,
            badges: productData.badges,
            priceTiers: productData.priceTiers ?? null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }).returning();

        await emitProductChange(newProduct[0].id, {
            slug: newProduct[0].slug,
            reason: "created",
        });

        const refreshedProduct = await db.query.products.findFirst({
            where: eq(products.id, newProduct[0].id),
        });

        return NextResponse.json({
            ...(refreshedProduct ?? newProduct[0]),
        }, { status: 201 });

    } catch (error: any) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (error?.name === 'ZodError' || error instanceof ZodError) {
            return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
        }
        console.error("[PRODUCTS_POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
