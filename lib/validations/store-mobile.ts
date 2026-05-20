import { z } from "zod";

/**
 * Schemas para el contrato móvil (Flutter app) de tienda regular.
 * El contrato web legacy vive directo en app/api/store/orders/route.ts y no se toca.
 */

export const PAYMENT_METHODS_MOBILE = ["cash", "mercado_pago"] as const;
export type PaymentMethodMobile = (typeof PAYMENT_METHODS_MOBILE)[number];

export const DELIVERY_METHODS = ["pickup", "delivery"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export const storeOrderItemInputSchema = z.object({
    productId: z.string().min(1),
    quantity: z.number().int().min(1).max(500),
    notes: z.string().max(280).optional().nullable(),
});

export const storeMobileOrderSchema = z.object({
    items: z.array(storeOrderItemInputSchema).min(1, "Al menos un producto"),
    method: z.enum(DELIVERY_METHODS),
    address: z.string().max(500).optional().nullable(),
    phone: z.string().min(6).max(40),
    notes: z.string().max(500).optional().nullable(),
    paymentMethod: z.enum(PAYMENT_METHODS_MOBILE),
}).refine(
    (d) => d.method !== "delivery" || (d.address && d.address.trim().length >= 4),
    { message: "Dirección requerida para delivery", path: ["address"] },
);

export type StoreMobileOrderInput = z.infer<typeof storeMobileOrderSchema>;
