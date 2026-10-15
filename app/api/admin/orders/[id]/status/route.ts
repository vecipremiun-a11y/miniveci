import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { orders, orderStatusHistory } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { notifyOrderStatusChanged } from "@/lib/fcm";
import { publishPreorderCancelled } from "@/lib/posveci-publisher";
import { STORE_VALID_TRANSITIONS as validTransitions, STORE_ACTIVE_STATES, isConfirmedTransfer } from "@/lib/store-status";
import { applyOrderStock, emitOrderStockChange, type TouchedProduct } from "@/lib/order-stock";
import { eq } from "drizzle-orm";

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth();
        const { id } = await params;

        const body = await req.json();
        const { status: newStatus, notes } = body;

        if (!newStatus || !validTransitions[newStatus]) {
            return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
        }

        const orderResult = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
        const order = orderResult[0];
        if (!order) {
            return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
        }

        const currentStatus = order.status || "new";

        if (!validTransitions[currentStatus]?.includes(newStatus)) {
            return NextResponse.json({
                error: `Transición inválida de ${currentStatus} a ${newStatus}`
            }, { status: 400 });
        }

        // La venta de una transferencia confirmada ya está en POSVECI (que
        // rechaza cancelarla con 409): la devolución la gestiona el local.
        if ((newStatus === "cancelled" || newStatus === "refunded") && isConfirmedTransfer(order)) {
            return NextResponse.json({
                error: "La transferencia ya fue confirmada por el local y la venta está registrada en POSVECI. Si corresponde una devolución, la gestiona el local.",
            }, { status: 409 });
        }

        let touched: TouchedProduct[] = [];
        await db.transaction(async (tx) => {

            // 1. Update Order Status
            await tx.update(orders).set({
                status: newStatus,
                updatedAt: new Date().toISOString()
            }).where(eq(orders.id, id));

            // 2. Add History Entry
            await tx.insert(orderStatusHistory).values({
                id: crypto.randomUUID(),
                orderId: id,
                status: newStatus,
                changedBy: session.user?.id || session.user?.email || "admin",
                notes: notes || `El estado cambió de ${currentStatus} a ${newStatus}`,
                createdAt: new Date().toISOString()
            });

            // 3. Stock (ver lib/order-stock.ts): se devuelve al cancelar o
            // reembolsar. Si el pedido avanza y su stock todavía no se había
            // descontado (pedidos de antes del acuerdo con POSVECI), se descuenta
            // ahora. La marca del pedido impide hacerlo dos veces.
            if (newStatus === "cancelled" || newStatus === "refunded") {
                touched = await applyOrderStock(tx, id, "restore");
            } else if (STORE_ACTIVE_STATES.includes(newStatus)) {
                touched = await applyOrderStock(tx, id, "deduct");
            }
        });

        await emitOrderStockChange(touched, `order-status:${newStatus}`);

        // Push FCM al cliente — background after response
        after(async () => {
            // Si admin canceló desde miniveci, avisar a POSVECI (mismo PATCH que
            // encargos; idempotente — si el POS no conoce el pedido, lo ignora).
            // La cancelación originada en POSVECI entra por /api/pos/... y no pasa por aquí.
            if (newStatus === "cancelled") {
                try {
                    await publishPreorderCancelled(id, notes || "Cancelado por admin desde miniveci");
                } catch (err) {
                    console.error(`[POSVECI] cancellation threw para ${order.orderNumber}:`, (err as Error).message);
                }
            }
            try {
                await notifyOrderStatusChanged({
                    userId: order.customerId,
                    status: newStatus,
                    source: "store",
                    publicCode: order.orderNumber,
                    orderId: id,
                });
            } catch (err) {
                console.error(`[FCM] notify threw para ${order.orderNumber}:`, (err as Error).message);
            }
        });

        return NextResponse.json({ success: true, newStatus });

    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ORDER_STATUS_PUT]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
