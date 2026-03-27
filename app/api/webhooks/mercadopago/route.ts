import { NextRequest, NextResponse } from "next/server";
import { mpPayment, mpPreApproval } from "@/lib/mercadopago";
import { db } from "@/lib/db";
import { orders, orderStatusHistory, subscriptions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

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
