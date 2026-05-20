import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { raffles, rafflePrizes, raffleEntries, raffleWinners, customers } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { releaseExpiredReservations } from "@/lib/raffles";
import { notifyRaffleWinner } from "@/lib/raffle-notifications";
import { and, eq, inArray } from "drizzle-orm";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth();
        const { id } = await params;

        const raffle = await db.query.raffles.findFirst({ where: eq(raffles.id, id) });
        if (!raffle) return NextResponse.json({ error: "Sorteo no encontrado" }, { status: 404 });
        if (raffle.status === "drawn") {
            return NextResponse.json({ error: "El sorteo ya fue realizado" }, { status: 400 });
        }

        await releaseExpiredReservations(id);

        const prizes = await db
            .select()
            .from(rafflePrizes)
            .where(eq(rafflePrizes.raffleId, id))
            .orderBy(rafflePrizes.position);
        if (prizes.length === 0) {
            return NextResponse.json({ error: "El sorteo no tiene premios configurados" }, { status: 400 });
        }

        const eligible = await db
            .select()
            .from(raffleEntries)
            .where(and(
                eq(raffleEntries.raffleId, id),
                inArray(raffleEntries.status, ["paid", "free"]),
            ));

        if (eligible.length < prizes.length) {
            return NextResponse.json({
                error: `Solo hay ${eligible.length} participantes para ${prizes.length} premios`,
            }, { status: 400 });
        }

        // Selección sin reposición usando crypto.randomInt
        const pool = [...eligible];
        const winners: typeof raffleWinners.$inferInsert[] = [];
        const now = new Date().toISOString();
        const winnerEntries: { prize: typeof prizes[number]; entry: typeof pool[number] }[] = [];

        for (const prize of prizes) {
            const idx = crypto.randomInt(0, pool.length);
            const chosen = pool.splice(idx, 1)[0];
            winners.push({
                id: crypto.randomUUID(),
                raffleId: id,
                prizeId: prize.id,
                entryId: chosen.id,
                drawnAt: now,
                notified: false,
                createdAt: now,
            });
            winnerEntries.push({ prize, entry: chosen });
        }

        await db.insert(raffleWinners).values(winners);
        await db.update(raffles)
            .set({ status: "drawn", updatedAt: now })
            .where(eq(raffles.id, id));

        // Notificar a los ganadores vía chat de soporte
        for (let i = 0; i < winnerEntries.length; i++) {
            const w = winnerEntries[i];
            const winnerRecord = winners[i];
            if (w.entry.customerId) {
                await notifyRaffleWinner({
                    customerId: w.entry.customerId,
                    raffleName: raffle.name,
                    prizeName: w.prize.name,
                    prizePosition: w.prize.position,
                    number: w.entry.number,
                    winnerId: winnerRecord.id!,
                });
            }
        }

        // Obtener datos de ganadores
        const customerIds = winnerEntries
            .map((w) => w.entry.customerId)
            .filter((x): x is string => !!x);
        const winnerCustomers = customerIds.length > 0
            ? await db.select().from(customers).where(inArray(customers.id, customerIds))
            : [];
        const customerMap = new Map(winnerCustomers.map((c) => [c.id, c]));

        return NextResponse.json({
            success: true,
            winners: winnerEntries.map((w) => ({
                prize: { id: w.prize.id, position: w.prize.position, name: w.prize.name },
                entry: { id: w.entry.id, number: w.entry.number },
                customer: w.entry.customerId
                    ? (() => {
                        const c = customerMap.get(w.entry.customerId!);
                        return c ? { id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), email: c.email } : null;
                    })()
                    : null,
            })),
        });
    } catch (error) {
        if (error instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        console.error("[RAFFLE_DRAW]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
