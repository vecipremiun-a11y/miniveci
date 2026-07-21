/**
 * Envío de pedidos normales de Tienda a POSVECI.
 *
 * Carga el pedido desde la BD (orden + items + posProductId de productos) y lo
 * publica al mismo endpoint de preorders con `order_type: "store"`. Se llama
 * en background (`after()`) desde:
 *   - POST /api/store/orders            (checkout móvil y web legacy, al crear)
 *   - webhook Mercado Pago              (flujo create-preference, al aprobarse el pago)
 *
 * Best-effort con reintentos (ver publishStoreOrderCreated): nunca bloquea ni
 * revierte la creación del pedido en miniveci.
 */

import { db } from "@/lib/db";
import { orders, orderItems, products } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { chileLocalToUtcISO } from "@/lib/timezone";
import { publishStoreOrderCreated, type StoreOrderCreatedPayload } from "@/lib/posveci-publisher";

/**
 * Mapea el método de pago interno al vocabulario de POSVECI.
 * Métodos reales en miniveci: web legacy 'contrarembolso'|'transferencia'|'mercadopago',
 * móvil 'cash'|'mercado_pago'.
 */
function mapPaymentMethod(method: string | null): "webpay" | "transferencia" | "contra_entrega" {
    switch (method) {
        case "mercadopago":
        case "mercado_pago":
        case "webpay":
            return "webpay";
        case "transferencia":
            return "transferencia";
        default: // 'contrarembolso', 'cash', null → pago contra entrega
            return "contra_entrega";
    }
}

/**
 * scheduled_for opcional: solo si el cliente eligió fecha de entrega/retiro en
 * el checkout web (deliveryDate 'YYYY-MM-DD' + slot tipo '15:00 - 18:00').
 * Toma el inicio del slot como hora de pared Chile. Si no hay fecha, se omite
 * y POSVECI usa la hora del pedido.
 */
function buildScheduledFor(deliveryDate: string | null, timeSlot: string | null): string | null {
    if (!deliveryDate || !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) return null;
    const slotStart = timeSlot?.match(/(\d{1,2}):(\d{2})/);
    const hh = slotStart ? slotStart[1].padStart(2, "0") : "12";
    const mm = slotStart ? slotStart[2] : "00";
    return chileLocalToUtcISO(`${deliveryDate}T${hh}:${mm}`);
}

/**
 * Publica un pedido de tienda a POSVECI por su id interno.
 * Idempotente aguas abajo (external_order_id = orders.id): llamarlo dos veces
 * para el mismo pedido responde `duplicate:true` y no duplica nada en el POS.
 */
export async function sendStoreOrderToPosveci(orderId: string): Promise<void> {
    const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    if (!order) {
        console.error(`[POSVECI] sendStoreOrderToPosveci: pedido ${orderId} no existe`);
        return;
    }
    if (order.status === "cancelled" || order.status === "refunded") {
        console.log(`[POSVECI] pedido ${order.orderNumber} ya está ${order.status}, no se publica`);
        return;
    }

    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    if (items.length === 0) {
        console.error(`[POSVECI] pedido ${order.orderNumber} sin items, no se publica`);
        return;
    }

    // posProductId (id interno del producto en POSVECI) > sku como fallback
    const productIds = items.map((it) => it.productId).filter((id): id is string => !!id);
    const productRows = productIds.length > 0
        ? await db.select({ id: products.id, posProductId: products.posProductId })
            .from(products).where(inArray(products.id, productIds))
        : [];
    const posIdByProduct = new Map(productRows.map((p) => [p.id, p.posProductId]));

    const isPickup = order.deliveryType === "pickup";
    const address = isPickup ? null : [order.shippingAddress, order.shippingComuna]
        .filter(Boolean).join(", ") || null;
    const scheduledFor = buildScheduledFor(order.deliveryDate, order.deliveryTimeSlot);

    const payload: StoreOrderCreatedPayload = {
        external_order_id: order.id,
        public_code: order.orderNumber,
        order_type: "store",
        payment_method: mapPaymentMethod(order.paymentMethod),
        method: isPickup ? "pickup" : "delivery",
        address,
        delivery_fee: order.shippingCost ?? 0,
        client: {
            external_id: order.customerId,
            name: order.customerName,
            phone: order.customerPhone,
            email: order.customerEmail || null,
            rut: order.customerRut,
        },
        items: items.map((it) => ({
            product_external_id: (it.productId ? posIdByProduct.get(it.productId) : null) ?? it.productSku ?? null,
            product_name: it.productName,
            quantity: it.quantity,
            unit_price: it.unitPrice,
            line_subtotal: it.totalPrice,
        })),
        subtotal: order.subtotal,
        total: order.total,
        ...(scheduledFor ? { scheduled_for: scheduledFor } : {}),
        occurred_at: new Date().toISOString(),
    };

    await publishStoreOrderCreated(payload);
}
