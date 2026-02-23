import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, orderItems, orderStatusHistory } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { eq, desc } from "drizzle-orm";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth();
        const { id } = await params;

        const order = await db.query.orders.findFirst({
            where: eq(orders.id, id),
        });

        if (!order) {
            return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
        }

        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));

        // It's possible we want to join product data to get images, 
        // but the actual product info is snapshotted in orderItems. 
        // We can fetch product images if needed on the client or here if we join products.
        // For now, orderItems has productName, etc.

        const history = await db.select().from(orderStatusHistory)
            .where(eq(orderStatusHistory.orderId, id))
            .orderBy(desc(orderStatusHistory.createdAt));

        return NextResponse.json({ ...order, items, history });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ORDER_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth();
        const { id } = await params;
        const body = await req.json();

        const existingResult = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
        const existingOrder = existingResult[0];
        if (!existingOrder) {
            return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
        }

        // Validate paymentStatus
        const validPaymentStatuses = ["pending", "paid", "failed", "refunded"];
        const { internalNotes, paymentStatus } = body;

        const updateData: Record<string, unknown> = {};
        if (internalNotes !== undefined) updateData.internalNotes = String(internalNotes);
        if (paymentStatus && validPaymentStatuses.includes(paymentStatus)) {
            updateData.paymentStatus = paymentStatus;
        } else if (paymentStatus) {
            return NextResponse.json({ error: "Estado de pago inválido" }, { status: 400 });
        }

        if (Object.keys(updateData).length > 0) {
            updateData.updatedAt = new Date().toISOString();
            await db.update(orders).set(updateData).where(eq(orders.id, id));
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ORDER_PUT]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
