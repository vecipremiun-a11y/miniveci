import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, orderItems, products, orderStatusHistory } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { emitProductChange } from "@/lib/product-live-updates";
import { syncPaidOrderToPos } from "@/services/pos-sync";
import { eq, sql } from "drizzle-orm";

// Basic state machine logic for order transitions
const validTransitions: Record<string, string[]> = {
    "new": ["paid", "preparing", "cancelled"],
    "paid": ["preparing", "cancelled", "refunded"],
    "preparing": ["ready", "cancelled"],
    "ready": ["shipped", "delivered", "cancelled"],
    "shipped": ["delivered", "cancelled", "refunded"],
    "delivered": ["refunded"],
    "cancelled": [],
    "refunded": []
};

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
        const orderItemsForUpdate = await db.select({
            productId: orderItems.productId,
            productSlug: products.slug,
        })
            .from(orderItems)
            .leftJoin(products, eq(orderItems.productId, products.id))
            .where(eq(orderItems.orderId, id));

        if (!validTransitions[currentStatus]?.includes(newStatus)) {
            return NextResponse.json({
                error: `Transición inválida de ${currentStatus} a ${newStatus}`
            }, { status: 400 });
        }

        // Handle stock logic based on transitions
        // This requires executing a transaction Ideally, but Drizzle/LibSQL transactions 
        // are supported via db.transaction()

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

            // 3. Stock Management
            const activeStates = ["paid", "preparing", "ready", "shipped", "delivered"];

            if (currentStatus === "new" && activeStates.includes(newStatus)) {
                // Deduct stock
                const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
                for (const item of items) {
                    if (item.productId) {
                        await tx.update(products)
                            .set({ webStock: sql`${products.webStock} - ${item.quantity}` })
                            .where(eq(products.id, item.productId));
                    }
                }
            } else if ((newStatus === "cancelled" || newStatus === "refunded") && currentStatus !== "new") {
                // If it was paid or further, we return the stock back
                const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
                for (const item of items) {
                    if (item.productId) {
                        await tx.update(products)
                            .set({ webStock: sql`${products.webStock} + ${item.quantity}` })
                            .where(eq(products.id, item.productId));
                    }
                }
            }
        });

        const changedProducts = Array.from(new Map(orderItemsForUpdate
            .filter((item) => !!item.productId)
            .map((item) => [item.productId as string, item.productSlug ?? null])).entries());

        await Promise.all(changedProducts.map(([productId, slug]) => emitProductChange(productId, {
            slug,
            reason: `order-status:${newStatus}`,
            changedFields: ["stock"],
        })));

        if (newStatus === "paid" && currentStatus !== "paid") {
            try {
                await syncPaidOrderToPos(id);
            } catch (syncError) {
                console.error("[ORDER_STATUS_PUT][POS_SYNC]", syncError);
            }
        }

        return NextResponse.json({ success: true, newStatus });

    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ORDER_STATUS_PUT]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
