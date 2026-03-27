import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subscriptions, customers } from "@/lib/db/schema";
import { eq, sql, desc, count } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "admin") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        // Get all subscriptions with customer data
        const allSubs = await db
            .select({
                id: subscriptions.id,
                customerId: subscriptions.customerId,
                plan: subscriptions.plan,
                status: subscriptions.status,
                startDate: subscriptions.startDate,
                endDate: subscriptions.endDate,
                price: subscriptions.price,
                paymentMethod: subscriptions.paymentMethod,
                mpPreApprovalId: subscriptions.mpPreApprovalId,
                paymentHistory: subscriptions.paymentHistory,
                cancelledAt: subscriptions.cancelledAt,
                createdAt: subscriptions.createdAt,
                customerFirstName: customers.firstName,
                customerLastName: customers.lastName,
                customerEmail: customers.email,
                customerPhone: customers.phone,
            })
            .from(subscriptions)
            .leftJoin(customers, eq(subscriptions.customerId, customers.id))
            .orderBy(desc(subscriptions.createdAt));

        // Map to include customerName
        const mappedSubs = allSubs.map(s => ({
            ...s,
            customerName: [s.customerFirstName, s.customerLastName].filter(Boolean).join(" ") || null,
        }));

        // Calculate stats
        const activeSubs = mappedSubs.filter(s => s.status === "active");
        const cancelledSubs = mappedSubs.filter(s => s.status === "cancelled");
        const expiredSubs = mappedSubs.filter(s => s.status === "expired");

        const totalActive = activeSubs.length;
        const totalCancelled = cancelledSubs.length;
        const totalExpired = expiredSubs.length;
        const totalAll = mappedSubs.length;

        // Monthly revenue (active subs * price)
        const monthlyRevenue = activeSubs.reduce((sum, s) => sum + (s.price || 0), 0);

        // Total revenue from payment history
        let totalRevenue = 0;
        for (const sub of mappedSubs) {
            const history = typeof sub.paymentHistory === 'string'
                ? JSON.parse(sub.paymentHistory || '[]')
                : (sub.paymentHistory || []);
            for (const p of history) {
                if (p.status === 'approved') {
                    totalRevenue += p.amount || 0;
                }
            }
        }
        // If no payment history yet, at least count active * price
        if (totalRevenue === 0) {
            totalRevenue = monthlyRevenue;
        }

        // Churn rate
        const churnRate = totalAll > 0 ? Math.round((totalCancelled / totalAll) * 100) : 0;

        return NextResponse.json({
            stats: {
                totalActive,
                totalCancelled,
                totalExpired,
                totalAll,
                monthlyRevenue,
                totalRevenue,
                churnRate,
            },
            subscriptions: mappedSubs,
        });
    } catch (error) {
        console.error("[ADMIN_SUBSCRIPTIONS_GET]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
