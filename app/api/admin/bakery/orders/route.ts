import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bakeryOrders, bakeryOrderItems, customers } from "@/lib/db/schema";
import { and, asc, desc, eq, gte, inArray, like, lt, or, sql } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { serializeOrder } from "@/lib/bakery";

export async function GET(req: NextRequest) {
    try {
        await requireAuth();

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");
        const date = searchParams.get("date"); // YYYY-MM-DD
        const search = searchParams.get("search");

        const conditions = [];
        if (status) {
            const requested = status.split(",").map((s) => s.trim()).filter(Boolean);
            if (requested.length === 1) conditions.push(eq(bakeryOrders.status, requested[0]));
            else if (requested.length > 1) conditions.push(inArray(bakeryOrders.status, requested));
        }
        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
            const start = `${date}T00:00:00.000Z`;
            const end = `${date}T23:59:59.999Z`;
            conditions.push(and(gte(bakeryOrders.scheduledFor, start), lt(bakeryOrders.scheduledFor, end)));
        }
        if (search) {
            const term = `%${search.toLowerCase()}%`;
            conditions.push(or(
                sql`LOWER(${bakeryOrders.publicCode}) LIKE ${term}`,
                sql`LOWER(${bakeryOrders.address}) LIKE ${term}`,
                sql`LOWER(${bakeryOrders.contactPhone}) LIKE ${term}`,
            ));
        }

        const rows = await db
            .select({
                order: bakeryOrders,
                customerFirstName: customers.firstName,
                customerLastName: customers.lastName,
                customerEmail: customers.email,
                customerPhone: customers.phone,
            })
            .from(bakeryOrders)
            .leftJoin(customers, eq(bakeryOrders.userId, customers.id))
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            // Más nuevos arriba — para que el dueño vea encargos recién entrados al tope.
            // (Independiente de POSVECI que usa scheduledFor ASC para producción.)
            .orderBy(desc(bakeryOrders.createdAt))
            .limit(200);

        const orderIds = rows.map((r) => r.order.id);
        const items = orderIds.length > 0
            ? await db.select().from(bakeryOrderItems).where(inArray(bakeryOrderItems.orderId, orderIds))
            : [];
        const itemsByOrder = new Map<string, typeof items>();
        for (const it of items) {
            const arr = itemsByOrder.get(it.orderId) ?? [];
            arr.push(it);
            itemsByOrder.set(it.orderId, arr);
        }

        const orders = rows.map((r) => {
            // Guest orders (POSVECI presencial sin cuenta aún) no tienen fila en customers:
            // caemos a los identificadores guardados en la propia orden.
            const customerName = r.customerFirstName
                ? `${r.customerFirstName} ${r.customerLastName ?? ""}`.trim()
                : (r.order.guestName ?? null);
            return {
                ...serializeOrder(r.order, itemsByOrder.get(r.order.id) ?? []),
                customer: {
                    name: customerName,
                    email: r.customerEmail ?? r.order.guestEmail,
                    phone: r.customerPhone ?? r.order.guestPhone,
                },
                unclaimed: r.order.unclaimed,
                source: r.order.source,
            };
        });

        // Resumen por estado
        const summaryRows = await db
            .select({ status: bakeryOrders.status, count: sql<number>`count(*)` })
            .from(bakeryOrders)
            .groupBy(bakeryOrders.status);
        const summary = Object.fromEntries(summaryRows.map((s) => [s.status, s.count]));

        return NextResponse.json({ orders, summary });
    } catch (error) {
        if (error instanceof AuthError) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
        console.error("[ADMIN_BAKERY_ORDERS_GET]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}
