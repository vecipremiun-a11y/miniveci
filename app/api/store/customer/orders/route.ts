import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders, orderItems, productImages } from "@/lib/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const url = new URL(req.url);
        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
        const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get("limit") || "5")));
        const offset = (page - 1) * limit;

        const customerOrders = await db.select()
            .from(orders)
            .where(eq(orders.customerId, session.user.id))
            .orderBy(desc(orders.createdAt))
            .limit(limit)
            .offset(offset);

        // Fetch items for each order
        const orderIds = customerOrders.map(o => o.id);
        const allItems = orderIds.length > 0
            ? await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds))
            : [];

        // Fetch primary images for products in items
        const productIds = [...new Set(allItems.map(i => i.productId).filter(Boolean))] as string[];
        const images = productIds.length > 0
            ? await db.select().from(productImages).where(
                and(
                    inArray(productImages.productId, productIds),
                    eq(productImages.isPrimary, true)
                )
            )
            : [];
        const imageMap = new Map(images.map(img => [img.productId, img.url]));

        const ordersWithItems = customerOrders.map(order => ({
            ...order,
            items: allItems
                .filter(item => item.orderId === order.id)
                .map(item => ({
                    ...item,
                    imageUrl: item.productId ? imageMap.get(item.productId) || null : null,
                })),
        }));

        // Get total count for pagination
        const allCustomerOrders = await db.select({ id: orders.id })
            .from(orders)
            .where(eq(orders.customerId, session.user.id));

        return NextResponse.json({
            orders: ordersWithItems,
            pagination: {
                page,
                limit,
                total: allCustomerOrders.length,
                totalPages: Math.ceil(allCustomerOrders.length / limit),
            },
        });
    } catch (error) {
        console.error("[CUSTOMER_ORDERS_GET]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
