/**
 * Stock de los pedidos web: se descuenta UNA vez y se devuelve UNA vez.
 *
 * Acuerdo con POSVECI (oct-2026): cada sistema descuenta sus ventas en su propia
 * base. miniveci descuenta su copia (webStock y offerStock) cuando el pedido
 * queda firme, sin preguntarle nada a POSVECI:
 *   - contra entrega / transferencia → al crearse
 *   - Mercado Pago                   → al aprobarse el pago
 * Los estados que manda POSVECI (preparando, en camino, entregado) no mueven
 * stock. Al cancelar o reembolsar se devuelve.
 *
 * La marca `orders.stock_applied_at` es la que garantiza el "una vez": un
 * webhook repetido, un reintento o un cambio de estado de más no vuelve a
 * descontar ni a devolver.
 */

import { db } from "@/lib/db";
import { orders, orderItems, products } from "@/lib/db/schema";
import { and, eq, isNotNull, isNull, notInArray, sql } from "drizzle-orm";
import { offerStockAfterSale } from "@/lib/store-filters";
import { emitProductChange } from "@/lib/product-live-updates";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbLike = typeof db | Tx;

export interface TouchedProduct {
    productId: string;
    slug: string | null;
}

/**
 * Descuenta (o devuelve) el stock web de un pedido, si corresponde.
 * Devuelve los productos tocados (vacío si no hizo nada) para avisar en vivo.
 */
export async function applyOrderStock(
    conn: DbLike,
    orderId: string,
    action: "deduct" | "restore",
): Promise<TouchedProduct[]> {
    const now = new Date().toISOString();
    const marked = action === "deduct"
        ? await conn.update(orders).set({ stockAppliedAt: now })
            .where(and(eq(orders.id, orderId), isNull(orders.stockAppliedAt)))
            .returning({ id: orders.id })
        : await conn.update(orders).set({ stockAppliedAt: null })
            .where(and(eq(orders.id, orderId), isNotNull(orders.stockAppliedAt)))
            .returning({ id: orders.id });
    if (marked.length === 0) return [];

    // quantity está en unidades también en las cajas (cajas × units): el stock
    // se descuenta igual. Lo que no gastan las cajas es el stock en oferta.
    const lines = await conn.select({
        productId: orderItems.productId,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        presentationQty: orderItems.presentationQty,
        slug: products.slug,
    })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, orderId));

    const touched = new Map<string, string | null>();
    for (const line of lines) {
        if (!line.productId) continue;
        await conn.update(products)
            .set({
                webStock: action === "deduct"
                    ? sql`${products.webStock} - ${line.quantity}`
                    : sql`${products.webStock} + ${line.quantity}`,
                offerStock: offerStockAfterSale(
                    // Precio fijo de la presentación: nunca se cobró a precio oferta,
                    // aunque price/units coincida con el precio oferta.
                    { quantity: line.quantity, unitPrice: line.presentationQty ? null : line.unitPrice },
                    action,
                ),
            })
            .where(eq(products.id, line.productId));
        touched.set(line.productId, line.slug ?? null);
    }
    return Array.from(touched, ([productId, slug]) => ({ productId, slug }));
}

/** Avisa a la tienda en vivo que cambió el stock de estos productos. */
export async function emitOrderStockChange(touched: TouchedProduct[], reason: string): Promise<void> {
    await Promise.all(touched.map(({ productId, slug }) => emitProductChange(productId, {
        slug,
        reason,
        changedFields: ["stock", "offerStock"],
    })));
}

/** Descuenta y avisa, fuera de una transacción (al crear un pedido). */
export async function deductOrderStock(orderId: string, reason: string): Promise<void> {
    const touched = await applyOrderStock(db, orderId, "deduct");
    await emitOrderStockChange(touched, reason);
}

/**
 * Unidades de pedidos web que miniveci ya descontó pero que POSVECI todavía no
 * recibió (`pos_sent_at` vacío). El stock que manda POSVECI (absoluto) aún no
 * las incluye: si se tomara tal cual, la venta web se "devolvería" sola hasta
 * que el pedido le llegue. `offerQty` son las que se vendieron a precio oferta.
 */
export async function pendingWebOrderQty(productId: string): Promise<{ qty: number; offerQty: number }> {
    const [row] = await db.select({
        qty: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)`,
        offerQty: sql<number>`COALESCE(SUM(CASE WHEN ${orderItems.presentationQty} IS NULL AND ${orderItems.unitPrice} = ${products.offerPrice} THEN ${orderItems.quantity} ELSE 0 END), 0)`,
    })
        .from(orderItems)
        .innerJoin(orders, eq(orderItems.orderId, orders.id))
        .innerJoin(products, eq(orderItems.productId, products.id))
        .where(and(
            eq(orderItems.productId, productId),
            isNotNull(orders.stockAppliedAt),
            isNull(orders.posSentAt),
            notInArray(orders.status, ["cancelled", "refunded"]),
        ));
    return { qty: Number(row?.qty ?? 0), offerQty: Number(row?.offerQty ?? 0) };
}

/**
 * Lo que POSVECI manda (stock y stock en oferta, absolutos) menos lo vendido en
 * la web que todavía no le llegó. Solo toca los valores que vinieron.
 */
export async function adjustPosStockForPendingWebOrders<T extends { webStock?: number; offerStock?: number | null }>(
    productId: string,
    incoming: T,
): Promise<T> {
    if (incoming.webStock === undefined && (incoming.offerStock === undefined || incoming.offerStock === null)) return incoming;
    const pending = await pendingWebOrderQty(productId);
    if (pending.qty === 0) return incoming;
    const out = { ...incoming };
    if (out.webStock !== undefined) out.webStock = Math.max(0, out.webStock - pending.qty);
    if (out.offerStock !== undefined && out.offerStock !== null) out.offerStock = Math.max(0, out.offerStock - pending.offerQty);
    return out;
}

/** Pedidos web: ¿ya están firmes para descontar stock al crearse? */
export function isPaidOnline(paymentMethod: string | null | undefined): boolean {
    return paymentMethod === "mercadopago" || paymentMethod === "mercado_pago" || paymentMethod === "webpay";
}
