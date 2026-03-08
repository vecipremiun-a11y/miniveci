import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiCredentials, products, productImages, categories } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { put, del } from "@vercel/blob";
import { emitProductChange } from "@/lib/product-live-updates";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const syncProductSchema = z.object({
  sku: z.string().trim().min(1, "sku es requerido"),
  name: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  stock: z.number().int().min(0).optional(),
  sale_price: z.number().min(0).optional(),
  offer_price: z.number().min(0).optional().nullable(),
  is_offer: z.boolean().optional(),
  unit: z.string().trim().optional(),
  tax_rate: z.number().min(0).optional(),
  image_url: z.string().url().optional().nullable(),
  image_base64: z.string().optional().nullable(),
});

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PUT,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, x-api-key, x-api-secret, x-api-consumer-key, x-api-consumer-secret, api_key, api_secret, api-key, api-secret",
};

function withCors(response: NextResponse) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

function extractCredentials(req: NextRequest) {
  const apiKey =
    req.headers.get("x-api-key") ||
    req.headers.get("x-api-consumer-key") ||
    req.headers.get("api_key") ||
    req.headers.get("api-key");

  const apiSecret =
    req.headers.get("x-api-secret") ||
    req.headers.get("x-api-consumer-secret") ||
    req.headers.get("api_secret") ||
    req.headers.get("api-secret");

  return { apiKey, apiSecret };
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function resolveCategory(categoryName: string): Promise<string | null> {
  const slug = generateSlug(categoryName);
  if (!slug) return null;

  const existing = await db.query.categories.findFirst({
    where: eq(categories.slug, slug),
    columns: { id: true },
  });

  if (existing) return existing.id;

  const id = crypto.randomUUID();
  await db.insert(categories).values({
    id,
    name: categoryName,
    slug,
  });
  return id;
}

async function uploadBase64ToBlob(
  sku: string,
  imageBase64: string
): Promise<string> {
  const base64Data = imageBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  // Always use .jpg to avoid phantom old-extension blobs
  const blob = await put(`products/${sku}.jpg`, buffer, {
    access: "public",
    addRandomSuffix: false,
    contentType: imageBase64.includes("image/png") ? "image/png" : "image/jpeg",
  });
  return blob.url;
}

async function upsertPrimaryImage(
  productId: string,
  sku: string,
  imageUrl: string | null | undefined,
  imageBase64: string | null | undefined
) {
  let finalUrl: string | null = null;

  // Read existing image before uploading so we can delete old blob
  const existing = await db.query.productImages.findFirst({
    where: eq(productImages.productId, productId),
    columns: { id: true, url: true },
  });

  try {
    if (imageBase64) {
      // Delete old blob if it's a Vercel Blob URL
      if (existing?.url && existing.url.includes(".public.blob.vercel-storage.com")) {
        try { await del(existing.url); } catch { /* ignore */ }
      }
      finalUrl = await uploadBase64ToBlob(sku, imageBase64);
    } else if (imageUrl) {
      finalUrl = imageUrl;
    }
  } catch (err: any) {
    console.error("[POS_SYNC_IMAGE] Error uploading image:", err?.message || err);
    return;
  }

  if (!finalUrl) return;

  if (existing) {
    await db
      .update(productImages)
      .set({ url: finalUrl, isPrimary: true })
      .where(eq(productImages.id, existing.id));
  } else {
    await db.insert(productImages).values({
      id: crypto.randomUUID(),
      productId,
      url: finalUrl,
      isPrimary: true,
      sortOrder: 0,
    });
  }
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

async function handleProductSync(req: NextRequest) {
  try {
    const { apiKey, apiSecret } = extractCredentials(req);

    if (!apiKey || !apiSecret) {
      return withCors(
        NextResponse.json({ error: "Missing api_key or api_secret" }, { status: 401 })
      );
    }

    const credentials = await db.query.apiCredentials.findFirst({
      where: eq(apiCredentials.id, "main"),
    });

    if (!credentials) {
      return withCors(
        NextResponse.json({ error: "API credentials not configured" }, { status: 503 })
      );
    }

    if (credentials.clientId !== apiKey || credentials.clientSecret !== apiSecret) {
      return withCors(
        NextResponse.json({ error: "Invalid api_key or api_secret" }, { status: 401 })
      );
    }

    const body = await req.json();
    const data = syncProductSchema.parse(body);

    const skuUpper = data.sku.toUpperCase();

    // Resolve category if provided
    let categoryId: string | null = null;
    if (data.category) {
      categoryId = await resolveCategory(data.category);
    }

    // CLP no tiene decimales — guardar tal cual
    const webPrice =
      data.sale_price !== undefined ? Math.round(data.sale_price) : undefined;

    // Look for existing product by SKU
    const existing = await db
      .select({ id: products.id, sku: products.sku, slug: products.slug })
      .from(products)
      .where(sql`UPPER(TRIM(${products.sku})) = ${skuUpper}`)
      .limit(1);

    const now = new Date().toISOString();
    let productId: string;
    let productSlug: string;
    let action: "created" | "updated";

    if (existing[0]) {
      // --- UPDATE ---
      productId = existing[0].id;
      productSlug = existing[0].slug ?? "";

      const updateFields: Record<string, unknown> = { updatedAt: now };

      if (data.name !== undefined) {
        updateFields.name = data.name;
      }
      if (categoryId !== null) {
        updateFields.categoryId = categoryId;
      }
      if (data.stock !== undefined) {
        updateFields.webStock = data.stock;
      }
      if (webPrice !== undefined) {
        updateFields.webPrice = webPrice;
      }
      if (data.offer_price !== undefined) {
        updateFields.offerPrice = data.offer_price !== null ? Math.round(data.offer_price) : null;
      }
      if (data.is_offer !== undefined) {
        updateFields.isOffer = data.is_offer;
      }
      if (data.unit !== undefined) {
        updateFields.unit = data.unit;
      }
      if (data.tax_rate !== undefined) {
        updateFields.taxRate = data.tax_rate;
      }

      await db.update(products).set(updateFields).where(eq(products.id, productId));
      action = "updated";
    } else {
      // --- CREATE ---
      const productName = data.name || `Producto ${data.sku}`;
      let slug = generateSlug(productName);

      // Ensure slug uniqueness
      const slugExists = await db.query.products.findFirst({
        where: eq(products.slug, slug),
        columns: { id: true },
      });
      if (slugExists) {
        slug = `${slug}-${Date.now()}`;
      }

      productId = crypto.randomUUID();
      productSlug = slug;

      await db.insert(products).values({
        id: productId,
        sku: skuUpper,
        name: productName,
        slug,
        categoryId,
        webPrice: webPrice ?? 0,
        webStock: data.stock ?? 0,
        offerPrice: data.offer_price != null ? Math.round(data.offer_price) : null,
        isOffer: data.is_offer ?? false,
        unit: data.unit ?? "Und",
        taxRate: data.tax_rate ?? null,
        isPublished: false,
        createdAt: now,
        updatedAt: now,
      });
      action = "created";
    }

    // Handle image
    await upsertPrimaryImage(productId, skuUpper, data.image_url, data.image_base64);

    // Emit live update
    await emitProductChange(productId, {
      slug: productSlug,
      reason: "sync-product-pos",
      changedFields: ["name", "price", "stock", "category", "images"],
    });

    return withCors(
      NextResponse.json(
        {
          success: true,
          action,
          message: action === "created" ? "Product created" : "Product updated",
          product: {
            id: productId,
            sku: skuUpper,
          },
        },
        { status: 200 }
      )
    );
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return withCors(
        NextResponse.json(
          { error: "Validation Error", details: error.errors },
          { status: 400 }
        )
      );
    }

    console.error("[POS_SYNC_PRODUCT]", error);
    return withCors(
      NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    );
  }
}

export async function PUT(req: NextRequest) {
  return handleProductSync(req);
}

export async function POST(req: NextRequest) {
  return handleProductSync(req);
}
