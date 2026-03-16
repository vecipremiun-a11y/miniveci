import * as z from "zod";

export const productSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    sku: z.string().min(1, "El SKU es requerido"),
    slug: z.string().min(1, "El slug es requerido").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido"),
    description: z.string().optional(),
    categoryId: z.string().optional(),

    // Web specific
    webPrice: z.coerce.number().min(0, "El precio debe ser mayor o igual a 0").optional(),
    webStock: z.coerce.number().min(0, "El stock debe ser mayor o igual a 0").optional(),
    webTitle: z.string().optional(),
    webDescription: z.string().optional(),

    // SEO
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),

    // Sources
    priceSource: z.enum(["global", "pos", "manual"]).default("global"),
    stockSource: z.enum(["global", "pos", "manual", "reserved"]).default("global"),
    reservedQty: z.coerce.number().min(0).default(0),

    // POS fields
    offerPrice: z.coerce.number().min(0).optional().nullable(),
    isOffer: z.boolean().default(false),
    unit: z.string().optional().default("Und"),
    equivLabel: z.string().optional().nullable(),
    equivWeight: z.coerce.number().min(0).optional().nullable(),
    taxRate: z.coerce.number().min(0).optional().nullable(),

    // Cost & Margin
    costPrice: z.coerce.number().min(0).optional().nullable(),
    profitMargin: z.coerce.number().min(0).optional().nullable(),

    // Status
    isPublished: z.boolean().default(false),
    isFeatured: z.boolean().default(false),

    // Collections/Arrays
    tags: z.array(z.string()).default([]),
    badges: z.array(z.string()).default([]),

    // Price tiers (quantity discounts)
    priceTiers: z.array(z.object({
        minQty: z.coerce.number().min(1),
        maxQty: z.coerce.number().min(1).nullable(),
        price: z.coerce.number().min(0),
    })).default([]),

    // Images are handled via separate endpoint or specific logic, 
    // but form might submit URLs
    images: z.array(z.object({
        id: z.string().optional(),
        url: z.string().url(),
        isPrimary: z.boolean().default(false),
        sortOrder: z.number().default(0)
    })).optional()
});

export type ProductFormValues = z.infer<typeof productSchema>;
