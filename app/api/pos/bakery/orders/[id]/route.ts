import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bakeryOrders, bakeryOrderItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { serializeOrder } from "@/lib/bakery";
import { requirePosCredentials, withPosCors } from "@/lib/pos-auth";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
    return withPosCors(new NextResponse(null, { status: 204 }));
}

/**
 * GET /api/pos/bakery/orders/:id
 *
 * Devuelve un encargo único. Acepta el `id` interno (uuid prefijado "ord_...")
 * o el `publicCode` MV-XXXXX (más útil para POS Veci si solo tienen el código).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denial = await requirePosCredentials(req);
    if (denial) return denial;

    try {
        const { id: idOrCode } = await params;

        // Detectar si es publicCode (empieza con "MV-") o id interno
        const isPublicCode = /^MV-/i.test(idOrCode);
        const order = await db.query.bakeryOrders.findFirst({
            where: isPublicCode
                ? eq(bakeryOrders.publicCode, idOrCode.toUpperCase())
                : eq(bakeryOrders.id, idOrCode),
        });
        if (!order) {
            return withPosCors(NextResponse.json({ error: "Order not found" }, { status: 404 }));
        }

        const items = await db
            .select()
            .from(bakeryOrderItems)
            .where(eq(bakeryOrderItems.orderId, order.id));

        return withPosCors(NextResponse.json(serializeOrder(order, items)));
    } catch (error) {
        console.error("[POS_BAKERY_ORDER_GET]", error);
        return withPosCors(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
    }
}
