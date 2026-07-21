import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { bakeryOrders, bakeryOrderItems, orders, orderItems, orderStatusHistory, products } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { canTransition, serializeOrder } from "@/lib/bakery";
import { publishBakeryEvent } from "@/lib/bakery-live-updates";
import { publishStoreOrderEvent } from "@/lib/store-live-updates";
import { emitProductChange } from "@/lib/product-live-updates";
import { notifyOrderStatusChanged } from "@/lib/fcm";
import { bakeryUpdateStatusSchema, type BakeryStatus } from "@/lib/validations/bakery";
import { canStoreTransition, mapPosStatusToStore, STORE_ACTIVE_STATES } from "@/lib/store-status";
import { ZodError } from "zod";
import { requirePosCredentials, withPosCors } from "@/lib/pos-auth";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
    return withPosCors(new NextResponse(null, { status: 204 }));
}

/**
 * PATCH /api/pos/bakery/orders/:id/status
 *
 * Body: { "status": "confirmed" | "preparing" | "ready" | "delivered" | "cancelled", "reason"?: "..." }
 *
 * Callback de estado de POSVECI. Resuelve ENCARGOS de amasandería (bakery_orders)
 * y también PEDIDOS NORMALES de tienda (orders): si el id/código no matchea un
 * encargo, se busca en pedidos de tienda por orderNumber o id.
 *
 * Encargos: valida transición (pending→confirmed→preparing→ready→delivered),
 * acepta bloque `delivery` con pesos reales, publica SSE para /admin/encargos.
 * Tienda: mapea el estado al vocabulario de tienda, ignora `delivery`, publica
 * SSE para /admin/pedidos y aplica la misma gestión de stock web que el admin.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denial = await requirePosCredentials(req);
    if (denial) return denial;

    try {
        const { id: idOrCode } = await params;
        const body = await req.json().catch(() => ({}));
        const { status, reason, delivery } = bakeryUpdateStatusSchema.parse(body);

        // Detalle real de entrega (POSVECI lo manda al pasar a 'delivered'): mapear a camelCase.
        const deliveryDetail = delivery ? {
            realTotal: delivery.real_total,
            depositPaid: delivery.deposit_paid,
            balancePaid: delivery.balance_paid,
            balancePaymentMethod: delivery.balance_payment_method ?? null,
            items: delivery.items.map((it) => ({
                externalProductId: it.external_product_id ?? null,
                productName: it.product_name,
                pricingMode: it.pricing_mode,
                realQty: it.real_qty ?? null,
                realWeightKg: it.real_weight_kg ?? null,
                realTotal: it.real_total,
            })),
        } : null;

        const isPublicCode = /^MV-/i.test(idOrCode);
        const order = await db.query.bakeryOrders.findFirst({
            where: isPublicCode
                ? eq(bakeryOrders.publicCode, idOrCode.toUpperCase())
                : eq(bakeryOrders.id, idOrCode),
        });
        if (!order) {
            // No es un encargo: puede ser un pedido normal de tienda (POSVECI usa
            // el mismo endpoint de callback para ambos, con el mismo public_code).
            return await patchStoreOrderStatus(idOrCode, isPublicCode, status, reason);
        }

        const from = order.status as BakeryStatus;
        if (!canTransition(from, status)) {
            return withPosCors(NextResponse.json({
                error: `Transición no permitida: ${from} → ${status}`,
                from,
                to: status,
            }, { status: 400 }));
        }

        const now = new Date().toISOString();
        await db.update(bakeryOrders)
            .set({ status, updatedAt: now, ...(deliveryDetail ? { deliveryDetail } : {}) })
            .where(eq(bakeryOrders.id, order.id));

        publishBakeryEvent({
            type: "order.status_changed",
            orderId: order.id,
            publicCode: order.publicCode,
            status,
            previousStatus: from,
            occurredAt: now,
        });

        // Push FCM al cliente del encargo (POSVECI cambió el estado) — background after response
        after(async () => {
            try {
                await notifyOrderStatusChanged({
                    userId: order.userId,
                    status,
                    source: "bakery",
                    publicCode: order.publicCode,
                    orderId: order.id,
                });
            } catch (err) {
                console.error(`[FCM] notify threw para ${order.publicCode}:`, (err as Error).message);
            }
        });

        // Devolver el encargo completo actualizado (más útil para POS que recargar)
        const items = await db
            .select()
            .from(bakeryOrderItems)
            .where(eq(bakeryOrderItems.orderId, order.id));
        const refreshed = { ...order, status, updatedAt: now, deliveryDetail: deliveryDetail ?? order.deliveryDetail };
        return withPosCors(NextResponse.json(serializeOrder(refreshed, items)));
    } catch (error) {
        if (error instanceof ZodError) {
            return withPosCors(NextResponse.json({
                error: error.issues[0]?.message || "Datos inválidos",
                details: error.issues,
            }, { status: 400 }));
        }
        console.error("[POS_BAKERY_ORDER_STATUS_PATCH]", error);
        return withPosCors(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
    }
}

/**
 * Cambio de estado de un PEDIDO NORMAL de tienda ordenado por POSVECI.
 *
 * Mapea el estado del vocabulario de encargos al de tienda (confirmed→confirmed,
 * out_for_delivery→shipped, etc.), valida la transición y aplica la misma
 * gestión de stock web que /api/admin/orders/[id]/status. El bloque `delivery`
 * del body se IGNORA (es para pesos reales de encargos).
 */
async function patchStoreOrderStatus(
    idOrCode: string,
    isPublicCode: boolean,
    posStatus: BakeryStatus,
    reason: string | null | undefined,
) {
    const order = await db.query.orders.findFirst({
        where: isPublicCode
            ? eq(orders.orderNumber, idOrCode.toUpperCase())
            : eq(orders.id, idOrCode),
    });
    if (!order) {
        return withPosCors(NextResponse.json({ error: "Order not found" }, { status: 404 }));
    }

    const status = mapPosStatusToStore(posStatus);
    if (!status) {
        return withPosCors(NextResponse.json({
            error: `Estado no soportado para pedidos de tienda: ${posStatus}`,
        }, { status: 400 }));
    }

    const from = order.status ?? "new";
    if (status === from) {
        // Reintento del POS con el mismo estado → no-op idempotente
        return withPosCors(NextResponse.json({
            success: true, orderType: "store", publicCode: order.orderNumber, status,
        }));
    }
    if (!canStoreTransition(from, status)) {
        return withPosCors(NextResponse.json({
            error: `Transición no permitida: ${from} → ${status}`,
            from,
            to: status,
        }, { status: 400 }));
    }

    const now = new Date().toISOString();
    // Productos cuyo stock cambió, para emitir SSE fuera de la transacción.
    let touchedProducts: Array<{ productId: string; slug: string | null }> = [];

    await db.transaction(async (tx) => {
        await tx.update(orders)
            .set({ status, updatedAt: now })
            .where(eq(orders.id, order.id));

        await tx.insert(orderStatusHistory).values({
            id: randomUUID(),
            orderId: order.id,
            status,
            changedBy: "posveci",
            notes: reason || `POSVECI cambió el estado de ${from} a ${status}`,
            createdAt: now,
        });

        // Stock web — misma regla que el admin: descuenta al salir de "new" a un
        // estado activo, repone al cancelar un pedido cuyo stock ya se descontó.
        let stockAction: "deduct" | "restore" | null = null;
        if (from === "new" && STORE_ACTIVE_STATES.includes(status)) {
            stockAction = "deduct";
        } else if (status === "cancelled" && from !== "new") {
            stockAction = "restore";
        }

        if (stockAction) {
            const itemRows = await tx.select({
                productId: orderItems.productId,
                quantity: orderItems.quantity,
                slug: products.slug,
            })
                .from(orderItems)
                .leftJoin(products, eq(orderItems.productId, products.id))
                .where(eq(orderItems.orderId, order.id));

            for (const it of itemRows) {
                if (!it.productId) continue;
                const expr = stockAction === "deduct"
                    ? sql`${products.webStock} - ${it.quantity}`
                    : sql`${products.webStock} + ${it.quantity}`;
                await tx.update(products).set({ webStock: expr }).where(eq(products.id, it.productId));
            }

            touchedProducts = itemRows
                .filter((i) => !!i.productId)
                .map((i) => ({ productId: i.productId as string, slug: i.slug ?? null }));
        }
    });

    if (touchedProducts.length > 0) {
        const uniq = new Map(touchedProducts.map((p) => [p.productId, p.slug]));
        await Promise.all(Array.from(uniq).map(([productId, slug]) => emitProductChange(productId, {
            slug,
            reason: `pos-order-status:${status}`,
            changedFields: ["stock"],
        })));
    }

    // SSE para que /admin/pedidos refleje el cambio en vivo
    publishStoreOrderEvent({
        type: "order.status_changed",
        orderId: order.id,
        orderNumber: order.orderNumber,
        status,
        previousStatus: from,
        occurredAt: now,
    });

    // Push FCM al cliente del pedido — background after response
    after(async () => {
        try {
            await notifyOrderStatusChanged({
                userId: order.customerId,
                status,
                source: "store",
                publicCode: order.orderNumber,
                orderId: order.id,
            });
        } catch (err) {
            console.error(`[FCM] notify threw para ${order.orderNumber}:`, (err as Error).message);
        }
    });

    return withPosCors(NextResponse.json({
        success: true,
        orderType: "store",
        publicCode: order.orderNumber,
        status,
        previousStatus: from,
    }));
}
