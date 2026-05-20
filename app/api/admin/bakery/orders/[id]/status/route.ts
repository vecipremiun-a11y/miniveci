import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bakeryOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { canTransition } from "@/lib/bakery";
import { publishBakeryEvent } from "@/lib/bakery-live-updates";
import { publishPreorderCancelled } from "@/lib/posveci-publisher";
import { notifyOrderStatusChanged } from "@/lib/fcm";
import { bakeryUpdateStatusSchema, type BakeryStatus } from "@/lib/validations/bakery";
import { ZodError } from "zod";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAuth();
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const { status } = bakeryUpdateStatusSchema.parse(body);

        const order = await db.query.bakeryOrders.findFirst({ where: eq(bakeryOrders.id, id) });
        if (!order) return NextResponse.json({ message: "Encargo no encontrado" }, { status: 404 });

        const from = order.status as BakeryStatus;
        if (!canTransition(from, status)) {
            return NextResponse.json({
                message: `Transición no permitida: ${from} → ${status}`,
            }, { status: 400 });
        }

        const now = new Date().toISOString();
        await db.update(bakeryOrders)
            .set({ status, updatedAt: now })
            .where(eq(bakeryOrders.id, id));

        publishBakeryEvent({
            type: "order.status_changed",
            orderId: id,
            publicCode: order.publicCode,
            status,
            previousStatus: from,
            occurredAt: now,
        });

        // Si admin canceló desde miniveci, avisar a POSVECI.
        // (No publicamos los otros estados porque POSVECI es la fuente de esos cambios.
        //  No publicamos cuando POSVECI cancela vía /api/pos/... — eso evita el loop.)
        if (status === "cancelled") {
            void publishPreorderCancelled(id, "Cancelado por admin desde miniveci");
        }

        // Push FCM al cliente del encargo
        void notifyOrderStatusChanged({
            userId: order.userId,
            status,
            source: "bakery",
            publicCode: order.publicCode,
            orderId: id,
        });

        return NextResponse.json({ success: true, status });
    } catch (error: any) {
        if (error instanceof AuthError) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
        if (error instanceof ZodError) {
            return NextResponse.json({ message: error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
        }
        console.error("[ADMIN_BAKERY_ORDER_STATUS]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}
