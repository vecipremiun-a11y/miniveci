import { NextRequest, NextResponse } from "next/server";
import { mpPayment } from "@/lib/mercadopago";
import { db } from "@/lib/db";
import { orders, orderStatusHistory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Mercado Pago sends different notification types
        const { type, data } = body;

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

            // Update order
            await db.update(orders)
                .set({
                    paymentStatus,
                    paymentId: String(paymentId),
                    status: orderStatus,
                    updatedAt: now,
                })
                .where(eq(orders.orderNumber, orderNumber));

            // Add status history
            await db.insert(orderStatusHistory).values({
                id: randomUUID(),
                orderId: "", // We'll get it from a subquery
                status: orderStatus,
                changedBy: "mercadopago",
                notes: historyNote,
                createdAt: now,
            });

            // Get orderId for accurate history
            const [order] = await db.select({ id: orders.id })
                .from(orders)
                .where(eq(orders.orderNumber, orderNumber))
                .limit(1);

            if (order) {
                await db.update(orderStatusHistory)
                    .set({ orderId: order.id })
                    .where(eq(orderStatusHistory.orderId, ""));
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
