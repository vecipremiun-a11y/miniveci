import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiCredentials, products, productImages, categories } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { put, del } from "@vercel/blob";
import { emitProductChange } from "@/lib/product-live-updates";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Schema acepta snake_case y camelCase (POSKEM envía camelCase)
const syncProductRawSchema = z.object({
  sku: z.string().trim().min(1, "sku es requerido"),
  name: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  stock: z.number().optional(),
  // snake_case
  sale_price: z.number().min(0).optional(),
  offer_price: z.number().min(0).optional().nullable(),
  is_offer: z.boolean().optional(),
  tax_rate: z.number().min(0).optional(),
  image_url: z.string().url().optional().nullable(),
  image_base64: z.string().optional().nullable(),
  // camelCase (POSKEM)
  price: z.number().min(0).optional(),
  offerPrice: z.number().min(0).optional().nullable(),
  isOffer: z.boolean().optional(),
  taxRate: z.number().min(0).optional(),
  imageUrl: z.string().url().optional().nullable(),
  imageBase64: z.string().optional().nullable(),
  unit: z.string().trim().optional(),
}).transform((d) => ({
  sku: d.sku,
  name: d.name,
  category: d.category,
  stock: d.stock,
  sale_price: d.sale_price ?? d.price,
  offer_price: d.offer_price ?? d.offerPrice,
  is_offer: d.is_offer ?? d.isOffer,
  unit: d.unit,
  tax_rate: d.tax_rate ?? d.taxRate,
  image_url: d.image_url ?? d.imageUrl,
  image_base64: d.image_base64 ?? d.imageBase64,
}));

type SyncProductData = z.output<typeof syncProductRawSchema>;

/** Normaliza stock: negativos → 0, unidades enteras → floor, kg/lt → 3 decimales */
function normalizeStock(stock: number | undefined, unit?: string): number | undefined {
  if (stock === undefined) return undefined;
  if (stock < 0) stock = 0;
  const u = (unit ?? "un").toLowerCase();
  if (u === "kg" || u === "lt") {
    return Math.round(stock * 1000) / 1000; // 3 decimales
  }
  return Math.floor(stock); // unidades enteras
}

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
  // addRandomSuffix: true → each upload gets a unique URL, avoiding CDN cache issues
  const blob = await put(`products/${sku}.jpg`, buffer, {
    access: "public",
    addRandomSuffix: true,
    contentType: imageBase64.includes("image/png") ? "image/png" : "image/jpeg",
  });
  return blob.url;
}

async function upsertPrimaryImage(
  productId: string,
  sku: string,
  imageUrl: string | null | undefined,
  imageBase64: string | null | undefined
): Promise<string | null> {
  let finalUrl: string | null = null;

  console.log("[POS_SYNC_IMAGE] Called with:", {
    productId,
    sku,
    hasImageUrl: !!imageUrl,
    hasImageBase64: !!imageBase64,
    base64Length: imageBase64?.length || 0,
  });

  // Read existing image before uploading so we can delete old blob
  const existing = await db.query.productImages.findFirst({
    where: eq(productImages.productId, productId),
    columns: { id: true, url: true },
  });

  console.log("[POS_SYNC_IMAGE] Existing image:", existing?.url || "none");

  try {
    if (imageBase64) {
      // Delete old blob if it's a Vercel Blob URL (strip query params)
      if (existing?.url && existing.url.includes(".public.blob.vercel-storage.com")) {
        const cleanUrl = existing.url.split("?")[0];
        try { await del(cleanUrl); } catch { /* ignore */ }
      }
      finalUrl = await uploadBase64ToBlob(sku, imageBase64);
      console.log("[POS_SYNC_IMAGE] Uploaded to blob:", finalUrl);
    } else if (imageUrl) {
      finalUrl = imageUrl;
      console.log("[POS_SYNC_IMAGE] Using provided URL:", finalUrl);
    }
  } catch (err: any) {
    console.error("[POS_SYNC_IMAGE] Error uploading image:", err?.message || err);
    return null;
  }

  if (!finalUrl) {
    console.log("[POS_SYNC_IMAGE] No image to save, skipping");
    return null;
  }

  if (existing) {
    await db
      .update(productImages)
      .set({ url: finalUrl, isPrimary: true })
      .where(eq(productImages.id, existing.id));
    console.log("[POS_SYNC_IMAGE] Updated existing image record");
  } else {
    await db.insert(productImages).values({
      id: crypto.randomUUID(),
      productId,
      url: finalUrl,
      isPrimary: true,
      sortOrder: 0,
    });
    console.log("[POS_SYNC_IMAGE] Created new image record");
  }

  return finalUrl;
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
    console.log("[POS_SYNC] Raw body keys:", Object.keys(body));
    console.log("[POS_SYNC] stock value:", body.stock, "type:", typeof body.stock);
    console.log("[POS_SYNC] Raw offer/price fields:", {
      price: body.price,
      sale_price: body.sale_price,
      offerPrice: body.offerPrice,
      offer_price: body.offer_price,
      isOffer: body.isOffer,
      is_offer: body.is_offer,
      taxRate: body.taxRate,
      tax_rate: body.tax_rate,
    });

    let data: SyncProductData;
    try {
      data = syncProductRawSchema.parse(body);
    } catch (zodErr: any) {
      console.error("[POS_SYNC] Zod validation failed:", JSON.stringify(zodErr.errors));
      console.error("[POS_SYNC] Full body was:", JSON.stringify(body));
      throw zodErr;
    }
    console.log("[POS_SYNC] Transformed data:", {
      sale_price: data.sale_price,
      offer_price: data.offer_price,
      is_offer: data.is_offer,
      tax_rate: data.tax_rate,
      unit: data.unit,
    });

    const skuUpper = data.sku.toUpperCase();

    // Normalizar stock según unidad
    const normalizedStock = normalizeStock(data.stock, data.unit);

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
        updateFields.webStock = normalizedStock;
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

      console.log("[POS_SYNC] Update fields for", skuUpper, ":", JSON.stringify(updateFields));
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
        webStock: normalizedStock ?? 0,
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
    console.log("[POS_SYNC] Fields received:", Object.keys(body));
    console.log("[POS_SYNC] data.image_base64 present:", !!data.image_base64, "length:", data.image_base64?.length || 0);
    console.log("[POS_SYNC] data.image_url present:", !!data.image_url);
    const imageUrl = await upsertPrimaryImage(productId, skuUpper, data.image_url, data.image_base64);

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
          _build: "20260312a",
          message: action === "created" ? "Product created" : "Product updated",
          product: {
            id: productId,
            sku: skuUpper,
            imageUrl: imageUrl || undefined,
          },
        },
        { status: 200 }
      )
    );
  } catch (error: any) {
    if (error?.name === "ZodError") {
      return withCors(
        NextResponse.json(
          { error: "Validation Error", details: error.errors, _build: "20260312a" },
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
