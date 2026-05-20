import { z } from "zod";

export const BAKERY_STATUSES = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"] as const;
export type BakeryStatus = (typeof BAKERY_STATUSES)[number];

export const BAKERY_CATEGORIES = ["pan", "sandwich", "hamburguesa", "canape", "dulce"] as const;
export type BakeryCategory = (typeof BAKERY_CATEGORIES)[number];

export const PRICING_MODES = ["unit", "kg"] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

// Producto — objeto base SIN refine. Útil para PATCH (.partial()) y forms.
// El POST usa la versión refinada (bakeryProductSchema) que también valida kg→gramsPerUnit.
export const bakeryProductObjectSchema = z.object({
    name: z.string().min(1, "Nombre requerido").max(120),
    description: z.string().max(500).optional().nullable(),
    imageUrl: z.string().url().optional().nullable().or(z.literal("")),
    category: z.enum(BAKERY_CATEGORIES),
    pricingMode: z.enum(PRICING_MODES),
    price: z.number().int().min(0),
    gramsPerUnit: z.number().int().min(1).optional().nullable(),
    allowsNotes: z.boolean().default(false),
    active: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
});

export const bakeryProductSchema = bakeryProductObjectSchema.refine(
    (d) => d.pricingMode !== "kg" || (d.gramsPerUnit != null && d.gramsPerUnit > 0),
    { message: "gramsPerUnit es requerido para pricingMode='kg'", path: ["gramsPerUnit"] },
);

// Item de carrito enviado por el cliente al crear orden
export const bakeryOrderItemInputSchema = z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(500),
    notes: z.string().max(280).optional().nullable(),
});

// Crear orden — todas las llaves en camelCase, consistente con respuestas del API.
export const bakeryCreateOrderSchema = z.object({
    items: z.array(bakeryOrderItemInputSchema).min(1, "Al menos un producto"),
    scheduledFor: z.string().min(10), // ISO 8601
    method: z.enum(["pickup", "delivery"]),
    address: z.string().max(240).optional().nullable(),
    generalNotes: z.string().max(500).optional().nullable(),
}).refine(
    (d) => d.method !== "delivery" || (d.address && d.address.trim().length > 0),
    { message: "Dirección requerida para delivery", path: ["address"] },
);

// Cambio de estado
export const bakeryUpdateStatusSchema = z.object({
    status: z.enum(BAKERY_STATUSES),
});

// Config (subconjunto)
export const bakeryConfigUpdateSchema = z.object({
    min_hours_ahead: z.number().int().min(0).max(720).optional(),
    max_days_ahead: z.number().int().min(1).max(365).optional(),
    closed_weekdays: z.array(z.number().int().min(1).max(7)).optional(),
    open_hour: z.number().int().min(0).max(23).optional(),
    close_hour: z.number().int().min(1).max(24).optional(),
    slot_minutes: z.number().int().min(5).max(180).optional(),
    offers_delivery: z.boolean().optional(),
    delivery_fee: z.number().int().min(0).optional(),
}).strict();
