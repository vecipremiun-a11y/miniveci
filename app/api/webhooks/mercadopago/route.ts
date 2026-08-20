import { NextRequest, NextResponse, after } from "next/server";
import { mpPayment, mpPreApproval } from "@/lib/mercadopago";
import { db } from "@/lib/db";
import { orders, orderItems, orderStatusHistory, products, subscriptions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { confirmRaffleEntriesForOrder, cancelRaffleEntriesForOrder } from "@/lib/raffle-checkout";
import { emitProductChange } from "@/lib/product-live-updates";
import { sendStoreOrderToPosveci } from "@/lib/posveci-store";
import { publishPreorderCancelled } from "@/lib/posveci-publisher";
import { STORE_ACTIVE_STATES } from "@/lib/store-status";

async function handleSubscriptionPreApproval(preApprovalId: string) {
    try {
        const preApproval = await mpPreApproval.get({ id: preApprovalId });
        if (!preApproval) return;

        const mpStatus = preApproval.status; // "authorized", "paused", "cancelled", "pending"
        const externalRef = preApproval.external_reference;

        if (!externalRef) return;

        // Find subscription by mpPreApprovalId
        const [sub] = await db.select().from(subscriptions)
            .where(eq(subscriptions.mpPreApprovalId, preApprovalId))
            .limit(1);

        const now = new Date().toISOString();

        if (mpStatus === "authorized") {
            // Calculate end date (1 month from now)
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);

            if (sub) {
                // Update existing record
                await db.update(subscriptions)
                    .set({
                        status: "active",
                        startDate: now,
                        endDate: endDate.toISOString(),
                        updatedAt: now,
                    })
                    .where(eq(subscriptions.id, sub.id));
            } else {
                // Create new subscription record — first confirmed payment
                // Parse customerId from external_reference: SUB-{customerId}-{timestamp}
                const parts = externalRef.split('-');
                const customerId = parts.slice(1, -1).join('-'); // Handle UUIDs with dashes
                if (customerId) {
                    await db.insert(subscriptions).values({
                        id: randomUUID(),
                        customerId,
                        plan: "premium",
                        status: "active",
                        startDate: now,
                        endDate: endDate.toISOString(),
                        price: 9990,
                        paymentMethod: "mercadopago",
                        mpPreApprovalId: preApprovalId,
                        paymentHistory: JSON.stringify([]),
                        createdAt: now,
                        updatedAt: now,
                    });
                }
            }
        } else if (!sub) {
            return; // No record to update for other statuses
        } else if (mpStatus === "cancelled") {
            await db.update(subscriptions)
                .set({
                    status: "cancelled",
                    cancelledAt: now,
                    updatedAt: now,
                })
                .where(eq(subscriptions.id, sub.id));
        } else if (mpStatus === "paused") {
            await db.update(subscriptions)
                .set({
                    status: "cancelled",
                    cancelledAt: now,
                    updatedAt: now,
                })
                .where(eq(subscriptions.id, sub.id));
        }
    } catch (error) {
        console.error("[WEBHOOK] Error handling subscription preapproval:", error);
    }
}

async function handleSubscriptionPayment(paymentId: string) {
    try {
        const payment = await mpPayment.get({ id: paymentId });
        if (!payment) return;

        const preApprovalId = (payment as any).preapproval_id;
        if (!preApprovalId) return;

        const [sub] = await db.select().from(subscriptions)
            .where(eq(subscriptions.mpPreApprovalId, preApprovalId))
            .limit(1);

        if (!sub) return;

        const now = new Date().toISOString();
        const history = (typeof sub.paymentHistory === 'string' ? JSON.parse(sub.paymentHistory) : sub.paymentHistory) || [];

        history.push({
            date: now,
            amount: payment.transaction_amount,
            paymentId: String(paymentId),
            status: payment.status,
        });

        if (payment.status === "approved") {
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + 1);

            await db.update(subscriptions)
                .set({
                    status: "active",
                    endDate: endDate.toISOString(),
                    paymentId: String(paymentId),
                    paymentHistory: JSON.stringify(history),
                    updatedAt: now,
                })
                .where(eq(subscriptions.id, sub.id));
        } else {
            await db.update(subscriptions)
                .set({
                    paymentHistory: JSON.stringify(history),
                    updatedAt: now,
                })
                .where(eq(subscriptions.id, sub.id));
        }
    } catch (error) {
        console.error("[WEBHOOK] Error handling subscription payment:", error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Mercado Pago sends different notification types
        const { type, data } = body;

        if (type === "subscription_preapproval") {
            const preApprovalId = data?.id;
            if (preApprovalId) {
                await handleSubscriptionPreApproval(String(preApprovalId));
            }
            return NextResponse.json({ received: true });
        }

        if (type === "subscription_authorized_payment") {
            const paymentId = data?.id;
            if (paymentId) {
                await handleSubscriptionPayment(String(paymentId));
            }
            return NextResponse.json({ received: true });
        }

        if (type === "payment") {
            const paymentId = data?.id;
            if (!paymentId) {
                return NextResponse.json({ received: true });
            }

            // Fetch payment details from MP
            const payment = await mpPayment.get({ id: paymentId });

            if (!payment || !payment.external_reference) {
                return NextResponse.json({ received: true });
            }

            const orderNumber = payment.external_reference;
            const status = payment.status; // "approved", "pending", "rejected", "cancelled", "refunded"

            // Map MP status to our payment/order status
            let paymentStatus: string;
            let orderStatus: string;
            let historyNote: string;

            switch (status) {
                case "approved":
                    paymentStatus = "paid";
                    orderStatus = "paid";
                    historyNote = `Pago aprobado vía Mercado Pago (ID: ${paymentId})`;
                    break;
                case "pending":
                case "in_process":
                    paymentStatus = "pending";
                    orderStatus = "new";
                    historyNote = `Pago pendiente en Mercado Pago (ID: ${paymentId})`;
                    break;
                case "rejected":
                    paymentStatus = "failed";
                    orderStatus = "cancelled";
                    historyNote = `Pago rechazado en Mercado Pago (ID: ${paymentId})`;
                    break;
                case "cancelled":
                    paymentStatus = "failed";
                    orderStatus = "cancelled";
                    historyNote = `Pago cancelado en Mercado Pago (ID: ${paymentId})`;
                    break;
                case "refunded":
                    paymentStatus = "refunded";
                    orderStatus = "refunded";
                    historyNote = `Pago reembolsado en Mercado Pago (ID: ${paymentId})`;
                    break;
                default:
                    paymentStatus = "pending";
                    orderStatus = "new";
                    historyNote = `Notificación de Mercado Pago: ${status} (ID: ${paymentId})`;
            }

            const now = new Date().toISOString();

            // Buscar la orden PRIMERO para tener su id real. Así el historial se
            // inserta con el orderId correcto y evitamos el patrón peligroso de
            // insertar con orderId="" y luego UPDATE ... WHERE orderId="" (que
            // bajo webhooks concurrentes reasignaba filas a la orden equivocada).
            const [order] = await db.select({ id: orders.id, total: orders.total })
                .from(orders)
                .where(eq(orders.orderNumber, orderNumber))
                .limit(1);

            if (!order) {
                // Número de orden desconocido — nada que actualizar.
                return NextResponse.json({ received: true });
            }
            const orderId = order.id;

            // SEGURIDAD: no basta con que MP diga "approved" — hay que comprobar
            // que se pagó el monto de ESTA orden. Sin esto, un pago por un monto
            // menor cuyo external_reference apunte a otro pedido lo dejaba como
            // pagado. Tolerancia de $1 CLP por redondeos de MP.
            if (paymentStatus === "paid") {
                const paidAmount = Math.round(Number(payment.transaction_amount ?? 0));
                const expectedAmount = Math.round(Number(order.total ?? 0));
                if (Math.abs(paidAmount - expectedAmount) > 1) {
                    console.error(
                        `[WEBHOOK_MP] Monto no coincide para ${orderNumber}: pagado=${paidAmount} esperado=${expectedAmount} (pago ${paymentId}). No se marca como pagada.`,
                    );
                    await db.insert(orderStatusHistory).values({
                        id: randomUUID(),
                        orderId,
                        status: "payment_mismatch",
                        changedBy: "mercadopago",
                        notes: `Monto pagado ($${paidAmount}) distinto del total del pedido ($${expectedAmount}). Pago ${paymentId}. Requiere revisión manual.`,
                        createdAt: new Date().toISOString(),
                    });
                    return NextResponse.json({ received: true, mismatch: true });
                }
            }

            const ACTIVE_STATES = STORE_ACTIVE_STATES;
            const TERMINAL_STATES = ["cancelled", "refunded"];

            // Productos cuyo stock cambió, para emitir SSE fuera de la transacción.
            let touchedProducts: Array<{ productId: string; slug: string | null }> = [];
            // Estado previo/final del pedido, para decidir notificaciones a POSVECI
            // fuera de la transacción.
            let previousStatus = "new";
            let finalStatus = orderStatus;

            await db.transaction(async (tx) => {
                // Releer el estado DENTRO de la transacción → read-decide-write atómico.
                // MP reintrega el mismo webhook varias veces; esto evita descontar stock dos veces.
                const [cur] = await tx.select({ status: orders.status })
                    .from(orders).where(eq(orders.id, orderId)).limit(1);
                const currentStatus = cur?.status || "new";

                // Anti-regresión de estado: un webhook tardío no debe degradar ni
                // resucitar una orden. (Ej: un "pending" que llega después de "paid".)
                let targetStatus = orderStatus;
                if (TERMINAL_STATES.includes(currentStatus) && orderStatus !== "refunded") {
                    targetStatus = currentStatus; // no resucitar canceladas/reembolsadas
                } else if (orderStatus === "new" && ACTIVE_STATES.includes(currentStatus)) {
                    targetStatus = currentStatus; // conservar el avance ya alcanzado
                } else if (orderStatus === "paid" && ACTIVE_STATES.includes(currentStatus)) {
                    // El POS ya avanzó el pedido (confirmed/preparing/...): un webhook
                    // de pago tardío no debe retroceder el fulfillment. paymentStatus
                    // igual queda "paid" abajo.
                    targetStatus = currentStatus;
                }
                previousStatus = currentStatus;
                finalStatus = targetStatus;

                // 1. Update order (paymentStatus siempre refleja MP; status con anti-regresión)
                await tx.update(orders)
                    .set({
                        paymentStatus,
                        paymentId: String(paymentId),
                        status: targetStatus,
                        updatedAt: now,
                    })
                    .where(eq(orders.id, orderId));

                // 2. Historial solo si el estado cambió (evita duplicados por reintentos de MP)
                if (targetStatus !== currentStatus) {
                    await tx.insert(orderStatusHistory).values({
                        id: randomUUID(),
                        orderId,
                        status: targetStatus,
                        changedBy: "mercadopago",
                        notes: historyNote,
                        createdAt: now,
                    });
                }

                // 3. Stock — idempotente gracias a las guardas de transición:
                //    descuenta al pasar de "new" a un estado activo (pago confirmado),
                //    repone al cancelar/reembolsar una orden cuyo stock ya se había descontado.
                let stockAction: "deduct" | "restore" | null = null;
                if (currentStatus === "new" && ACTIVE_STATES.includes(targetStatus)) {
                    stockAction = "deduct";
                } else if (TERMINAL_STATES.includes(targetStatus) && currentStatus !== "new" && !TERMINAL_STATES.includes(currentStatus)) {
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
                        .where(eq(orderItems.orderId, orderId));

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

            // Emitir actualización de stock en vivo (fuera de la transacción)
            if (touchedProducts.length > 0) {
                const uniq = new Map(touchedProducts.map((p) => [p.productId, p.slug]));
                await Promise.all(Array.from(uniq).map(([productId, slug]) =>
                    emitProductChange(productId, {
                        slug,
                        reason: "mp-webhook:payment",
                        changedFields: ["stock"],
                    })));
            }

            // Sync raffle entries (según el pago real de MP; idempotente)
            if (paymentStatus === "paid") {
                await confirmRaffleEntriesForOrder(orderId);
            } else if (paymentStatus === "failed" || paymentStatus === "refunded") {
                await cancelRaffleEntriesForOrder(orderId);
            }

            // POSVECI — en background post-response (`after()` mantiene viva la lambda):
            //  - Pago aprobado sobre un pedido que seguía "new": el flujo web de
            //    Mercado Pago crea la orden en create-preference y recién aquí se
            //    confirma → publicarla al POS. Si ya se había enviado al crearla
            //    (flujo móvil), POSVECI responde duplicate:true — inofensivo.
            //  - Pedido que pasó a cancelled/refunded: avisar la cancelación al POS
            //    (si el POS no lo conocía, ignora el external_order_id — inofensivo).
            const becameTerminal = TERMINAL_STATES.includes(finalStatus) && !TERMINAL_STATES.includes(previousStatus);
            if ((paymentStatus === "paid" && previousStatus === "new") || becameTerminal) {
                after(async () => {
                    try {
                        if (becameTerminal) {
                            await publishPreorderCancelled(orderId, historyNote);
                        } else {
                            await sendStoreOrderToPosveci(orderId);
                        }
                    } catch (err) {
                        console.error(`[POSVECI] webhook MP publisher threw para ${orderNumber}:`, (err as Error).message);
                    }
                });
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("Webhook MP error:", error);
        // Always return 200 to MP so they don't retry indefinitely
        return NextResponse.json({ received: true });
    }
}

// MP also sends GET requests to verify the endpoint
export async function GET() {
    return NextResponse.json({ status: "ok" });
}
