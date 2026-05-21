import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { bakeryOrders, bakeryOrderItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canTransition, serializeOrder } from "@/lib/bakery";
import { publishBakeryEvent } from "@/lib/bakery-live-updates";
import { notifyOrderStatusChanged } from "@/lib/fcm";
import { bakeryUpdateStatusSchema, type BakeryStatus } from "@/lib/validations/bakery";
import { ZodError } from "zod";
import { requirePosCredentials, withPosCors } from "@/lib/pos-auth";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
    return withPosCors(new NextResponse(null, { status: 204 }));
}

/**
 * PATCH /api/pos/bakery/orders/:id/status
 *
 * Body: { "status": "confirmed" | "preparing" | "ready" | "delivered" | "cancelled" }
 *
 * Valida transición permitida (pending→confirmed→preparing→ready→delivered).
 * Publica evento SSE para que admin /admin/encargos refleje el cambio en vivo.
 * Acepta id interno o publicCode MV-XXXXX (igual que GET /:id).
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denial = await requirePosCredentials(req);
    if (denial) return denial;

    try {
        const { id: idOrCode } = await params;
        const body = await req.json().catch(() => ({}));
        const { status } = bakeryUpdateStatusSchema.parse(body);

        const isPublicCode = /^MV-/i.test(idOrCode);
        const order = await db.query.bakeryOrders.findFirst({
            where: isPublicCode
                ? eq(bakeryOrders.publicCode, idOrCode.toUpperCase())
                : eq(bakeryOrders.id, idOrCode),
        });
        if (!order) {
            return withPosCors(NextResponse.json({ error: "Order not found" }, { status: 404 }));
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
            .set({ status, updatedAt: now })
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
        const refreshed = { ...order, status, updatedAt: now };
        return withPosCors(NextResponse.json(serializeOrder(refreshed, items)));
    } catch (error: any) {
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
