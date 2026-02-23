import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth();

        const resolvedParams = await params;
        const email = decodeURIComponent(resolvedParams.id);

        if (!email) {
            return NextResponse.json({ error: "Email is required" }, { status: 400 });
        }

        // Obtener historial completo de pedidos para este cliente
        const clientOrders = await db
            .select()
            .from(orders)
            .where(eq(orders.customerEmail, email))
            .orderBy(desc(orders.createdAt));

        if (clientOrders.length === 0) {
            return NextResponse.json({ error: "Client not found" }, { status: 404 });
        }

        // Construir el perfil del cliente en base al historial
        const client = {
            id: clientOrders[0].customerEmail,
            email: clientOrders[0].customerEmail,
            name: clientOrders[0].customerName, // Preferimos el nombre del último pedido
            phone: clientOrders.find(o => o.customerPhone)?.customerPhone || null,
            rut: clientOrders.find(o => o.customerRut)?.customerRut || null,
            shippingAddress: clientOrders.find(o => o.shippingAddress)?.shippingAddress || null,
            shippingComuna: clientOrders.find(o => o.shippingComuna)?.shippingComuna || null,
            shippingCity: clientOrders.find(o => o.shippingCity)?.shippingCity || null,
            totalOrders: clientOrders.length,
            totalSpent: clientOrders.reduce((sum, order) => sum + order.total, 0),
            lastOrderDate: clientOrders[0].createdAt,
            orders: clientOrders
        };

        return NextResponse.json(client);
    } catch (error: any) {
        console.error("[CLIENT_GET]", error);
        if (error.message === "UNAUTHORIZED") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
