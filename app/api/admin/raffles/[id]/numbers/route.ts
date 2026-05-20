import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { raffles, raffleEntries, customers } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { releaseExpiredReservations } from "@/lib/raffles";
import { eq, ne, and } from "drizzle-orm";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth();
        const { id } = await params;

        const raffle = await db.query.raffles.findFirst({ where: eq(raffles.id, id) });
        if (!raffle) return NextResponse.json({ error: "Sorteo no encontrado" }, { status: 404 });

        await releaseExpiredReservations(id);

        const rows = await db
            .select({
                entry: raffleEntries,
                customerFirstName: customers.firstName,
                customerLastName: customers.lastName,
                customerEmail: customers.email,
                customerPhone: customers.phone,
            })
            .from(raffleEntries)
            .leftJoin(customers, eq(raffleEntries.customerId, customers.id))
            .where(and(eq(raffleEntries.raffleId, id), ne(raffleEntries.status, "cancelled")));

        const entriesByNumber = new Map<number, any>();
        for (const r of rows) {
            entriesByNumber.set(r.entry.number, {
                ...r.entry,
                customerName: r.customerFirstName ? `${r.customerFirstName} ${r.customerLastName ?? ""}`.trim() : null,
                customerEmail: r.customerEmail,
                customerPhone: r.customerPhone,
            });
        }

        const numbers = Array.from({ length: raffle.totalNumbers }, (_, i) => {
            const n = i + 1;
            const entry = entriesByNumber.get(n);
            return {
                number: n,
                status: entry?.status ?? "available",
                entry: entry ?? null,
            };
        });

        return NextResponse.json({
            totalNumbers: raffle.totalNumbers,
            sold: numbers.filter((n) => n.status === "paid" || n.status === "free").length,
            reserved: numbers.filter((n) => n.status === "reserved").length,
            available: numbers.filter((n) => n.status === "available").length,
            numbers,
        });
    } catch (error) {
        if (error instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        console.error("[RAFFLE_NUMBERS_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
