import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { orders, customers } from "@/lib/db/schema";
import { sql, desc } from "drizzle-orm";

export async function GET(req: Request) {
    try {
        await requireAuth();

        const url = new URL(req.url);
        const search = url.searchParams.get("search")?.toLowerCase() || "";

        // 1. Obtener todos los clientes registrados
        const registeredCustomers = await db.select().from(customers);

        // 2. Obtener datos de pedidos agrupados por email
        const orderStats = await db
            .select({
                email: orders.customerEmail,
                name: sql<string>`MAX(${orders.customerName})`,
                phone: sql<string>`MAX(${orders.customerPhone})`,
                rut: sql<string>`MAX(${orders.customerRut})`,
                totalOrders: sql<number>`COUNT(${orders.id})`,
                totalSpent: sql<number>`SUM(${orders.total})`,
                lastOrderDate: sql<string>`MAX(${orders.createdAt})`,
            })
            .from(orders)
            .groupBy(orders.customerEmail);

        // Indexar stats de pedidos por email
        const ordersByEmail = new Map(orderStats.map(o => [o.email, o]));

        // 3. Combinar: clientes registrados + clientes solo de pedidos
        const clientMap = new Map<string, {
            id: string;
            email: string;
            name: string | null;
            phone: string | null;
            rut: string | null;
            totalOrders: number;
            totalSpent: number;
            lastOrderDate: string | null;
            registeredAt: string | null;
        }>();

        // Agregar clientes registrados
        for (const c of registeredCustomers) {
            const stats = ordersByEmail.get(c.email);
            clientMap.set(c.email, {
                id: c.id,
                email: c.email,
                name: `${c.firstName} ${c.lastName}`,
                phone: c.phone,
                rut: c.rut,
                totalOrders: stats?.totalOrders || 0,
                totalSpent: stats?.totalSpent || 0,
                lastOrderDate: stats?.lastOrderDate || null,
                registeredAt: c.createdAt,
            });
        }

        // Agregar clientes que solo tienen pedidos (no registrados)
        for (const o of orderStats) {
            if (!clientMap.has(o.email)) {
                clientMap.set(o.email, {
                    id: o.email,
                    email: o.email,
                    name: o.name,
                    phone: o.phone,
                    rut: o.rut,
                    totalOrders: o.totalOrders,
                    totalSpent: o.totalSpent,
                    lastOrderDate: o.lastOrderDate,
                    registeredAt: null,
                });
            }
        }

        let results = Array.from(clientMap.values());

        // Filtrar por búsqueda
        if (search) {
            results = results.filter(
                (c) =>
                    c.email.toLowerCase().includes(search) ||
                    (c.name && c.name.toLowerCase().includes(search)) ||
                    (c.rut && c.rut.toLowerCase().includes(search)) ||
                    (c.phone && c.phone.toLowerCase().includes(search))
            );
        }

        // Ordenar: registrados primero, luego por última actividad
        results.sort((a, b) => {
            const dateA = a.lastOrderDate || a.registeredAt || '';
            const dateB = b.lastOrderDate || b.registeredAt || '';
            return dateB.localeCompare(dateA);
        });

        return NextResponse.json({ clients: results });
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
