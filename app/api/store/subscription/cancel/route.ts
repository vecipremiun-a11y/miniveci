import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { mpPreApproval } from "@/lib/mercadopago";

export async function POST() {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Find the active subscription
        const result = await db.select().from(subscriptions)
            .where(and(
                eq(subscriptions.customerId, session.user.id),
                eq(subscriptions.status, "active")
            ))
            .limit(1);

        const sub = result[0];
        if (!sub) {
            return NextResponse.json({ error: "No tienes suscripción activa" }, { status: 404 });
        }

        // Cancel in Mercado Pago
        if (sub.mpPreApprovalId) {
            try {
                await mpPreApproval.update({
                    id: sub.mpPreApprovalId,
                    body: { status: "cancelled" },
                });
            } catch (mpError) {
                console.error("[SUBSCRIPTION_CANCEL] MP error:", mpError);
                // Continue with DB cancellation even if MP fails
            }
        }

        // Cancel in DB
        const now = new Date().toISOString();
        await db.update(subscriptions)
            .set({
                status: "cancelled",
                cancelledAt: now,
                updatedAt: now,
            })
            .where(eq(subscriptions.id, sub.id));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[SUBSCRIPTION_CANCEL]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
