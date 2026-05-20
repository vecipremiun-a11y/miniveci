import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bakeryOrders, bakeryOrderItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getBakeryUser, isAdminRole } from "@/lib/bakery-auth";
import { serializeOrder } from "@/lib/bakery";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getBakeryUser(req);
        if (!user) return NextResponse.json({ message: "No autorizado" }, { status: 401 });

        const { id } = await params;
        const order = await db.query.bakeryOrders.findFirst({ where: eq(bakeryOrders.id, id) });
        if (!order) return NextResponse.json({ message: "Encargo no encontrado" }, { status: 404 });
        if (order.userId !== user.id && !isAdminRole(user.role)) {
            return NextResponse.json({ message: "No autorizado" }, { status: 403 });
        }

        const items = await db.select().from(bakeryOrderItems).where(eq(bakeryOrderItems.orderId, id));
        return NextResponse.json(serializeOrder(order, items));
    } catch (error) {
        console.error("[BAKERY_ORDER_GET]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}
