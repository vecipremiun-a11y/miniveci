import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subscriptions, customers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { mpPreApproval } from "@/lib/mercadopago";

export async function POST() {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Check if user already has an active subscription
        const existing = await db.select().from(subscriptions)
            .where(and(
                eq(subscriptions.customerId, session.user.id),
                eq(subscriptions.status, "active")
            ))
            .limit(1);

        if (existing.length > 0) {
            return NextResponse.json({ error: "Ya tienes una suscripción activa" }, { status: 400 });
        }

        // Get customer email
        const customer = await db.select().from(customers)
            .where(eq(customers.id, session.user.id))
            .limit(1);

        if (!customer[0]) {
            return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
        }

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.miniveci.cl";
        const externalReference = `SUB-${session.user.id}-${Date.now()}`;

        // Create Mercado Pago PreApproval (subscription)
        const preApproval = await mpPreApproval.create({
            body: {
                reason: "MiniVeci Premium - Suscripción Mensual",
                external_reference: externalReference,
                payer_email: customer[0].email,
                auto_recurring: {
                    frequency: 1,
                    frequency_type: "months",
                    transaction_amount: 9990,
                    currency_id: "CLP",
                },
                back_url: `${baseUrl}/cuenta/membresia?mp_status=subscribed`,
                status: "pending",
            },
        });

        if (!preApproval?.init_point) {
            console.error("[SUBSCRIPTION_CREATE] No init_point in response:", preApproval);
            return NextResponse.json({ error: "Error al crear suscripción en MP" }, { status: 500 });
        }

        // Don't create DB record yet — webhook will create it when MP confirms payment
        return NextResponse.json({
            initPoint: preApproval.init_point,
            preApprovalId: preApproval.id,
        });
    } catch (error) {
        console.error("[SUBSCRIPTION_CREATE]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
