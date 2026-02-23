import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { sql, desc, like, or } from "drizzle-orm";

export async function GET(req: Request) {
    try {
        await requireAuth();

        const url = new URL(req.url);
        const search = url.searchParams.get("search")?.toLowerCase() || "";

        // Mapear clientes únicos agrupando por email
        const clientsQuery = db
            .select({
                id: orders.customerEmail, // Usamos el email como ID primario para cada cliente
                email: orders.customerEmail,
                name: sql<string>`MAX(${orders.customerName})`,
                phone: sql<string>`MAX(${orders.customerPhone})`,
                rut: sql<string>`MAX(${orders.customerRut})`,
                totalOrders: sql<number>`COUNT(${orders.id})`,
                totalSpent: sql<number>`SUM(${orders.total})`,
                lastOrderDate: sql<string>`MAX(${orders.createdAt})`,
            })
            .from(orders)
            .groupBy(orders.customerEmail)
            .orderBy(desc(sql`MAX(${orders.createdAt})`));

        let results = await clientsQuery;

        if (search) {
            results = results.filter(
                (c) =>
                    c.email.toLowerCase().includes(search) ||
                    (c.name && c.name.toLowerCase().includes(search)) ||
                    (c.rut && c.rut.toLowerCase().includes(search)) ||
                    (c.phone && c.phone.toLowerCase().includes(search))
            );
        }

        return NextResponse.json({ clients: results || [] });
    } catch (error: any) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[CLIENTS_GET]", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
