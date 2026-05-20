import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { raffleEntries, raffles, raffleWinners, rafflePrizes } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { and, eq, inArray, desc } from "drizzle-orm";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const customerId = session.user.id;

        const entries = await db
            .select({ entry: raffleEntries, raffle: raffles })
            .from(raffleEntries)
            .innerJoin(raffles, eq(raffleEntries.raffleId, raffles.id))
            .where(and(
                eq(raffleEntries.customerId, customerId),
                inArray(raffleEntries.status, ["reserved", "paid", "free"]),
            ))
            .orderBy(desc(raffleEntries.createdAt));

        const entryIds = entries.map((e) => e.entry.id);
        const myWins = entryIds.length > 0
            ? await db
                .select({ winner: raffleWinners, prize: rafflePrizes })
                .from(raffleWinners)
                .innerJoin(rafflePrizes, eq(raffleWinners.prizeId, rafflePrizes.id))
                .where(inArray(raffleWinners.entryId, entryIds))
            : [];
        const winsByEntry = new Map(myWins.map((w) => [w.winner.entryId, w]));

        return NextResponse.json({
            entries: entries.map((e) => ({
                id: e.entry.id,
                number: e.entry.number,
                status: e.entry.status,
                expiresAt: e.entry.expiresAt,
                paidAt: e.entry.paidAt,
                raffle: {
                    id: e.raffle.id,
                    slug: e.raffle.slug,
                    name: e.raffle.name,
                    coverImage: e.raffle.coverImage,
                    type: e.raffle.type,
                    status: e.raffle.status,
                    drawAt: e.raffle.drawAt,
                },
                won: winsByEntry.has(e.entry.id)
                    ? {
                        prizeName: winsByEntry.get(e.entry.id)!.prize.name,
                        prizePosition: winsByEntry.get(e.entry.id)!.prize.position,
                    }
                    : null,
            })),
        });
    } catch (error) {
        console.error("[MY_RAFFLES_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
