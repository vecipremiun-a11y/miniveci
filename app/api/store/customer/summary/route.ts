import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const result = await db.select({
            totalOrders: sql<number>`count(*)`,
            totalSpent: sql<number>`coalesce(sum(${orders.total}), 0)`,
        })
            .from(orders)
            .where(eq(orders.customerId, session.user.id));

        return NextResponse.json({
            totalOrders: result[0]?.totalOrders || 0,
            totalSpent: result[0]?.totalSpent || 0,
            favorites: 0, // Placeholder until favorites feature is built
        });
    } catch (error) {
        console.error("[CUSTOMER_SUMMARY_GET]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
