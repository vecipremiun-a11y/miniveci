import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { raffles, raffleImages, rafflePrizes, raffleEntries, raffleWinners, customers } from "@/lib/db/schema";
import { releaseExpiredReservations } from "@/lib/raffles";
import { and, eq, ne, inArray } from "drizzle-orm";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const { slug } = await params;

        const raffle = await db.query.raffles.findFirst({ where: eq(raffles.slug, slug) });
        if (!raffle) return NextResponse.json({ error: "Sorteo no encontrado" }, { status: 404 });
        if (raffle.status === "draft") {
            return NextResponse.json({ error: "Sorteo no disponible" }, { status: 404 });
        }

        await releaseExpiredReservations(raffle.id);

        const [images, prizes, takenEntries] = await Promise.all([
            db.select().from(raffleImages).where(eq(raffleImages.raffleId, raffle.id)).orderBy(raffleImages.position),
            db.select().from(rafflePrizes).where(eq(rafflePrizes.raffleId, raffle.id)).orderBy(rafflePrizes.position),
            db
                .select({
                    number: raffleEntries.number,
                    status: raffleEntries.status,
                    customerId: raffleEntries.customerId,
                })
                .from(raffleEntries)
                .where(and(eq(raffleEntries.raffleId, raffle.id), ne(raffleEntries.status, "cancelled"))),
        ]);

        // Ganadores si ya se sorteó
        let winners: Array<{
            position: number;
            prizeName: string;
            number: number;
            winnerName: string | null;
        }> = [];
        if (raffle.status === "drawn") {
            const winnerRows = await db
                .select({
                    prizeId: raffleWinners.prizeId,
                    entryId: raffleWinners.entryId,
                })
                .from(raffleWinners)
                .where(eq(raffleWinners.raffleId, raffle.id));

            if (winnerRows.length > 0) {
                const entryIds = winnerRows.map((w) => w.entryId);
                const entries = await db
                    .select()
                    .from(raffleEntries)
                    .where(inArray(raffleEntries.id, entryIds));
                const entryMap = new Map(entries.map((e) => [e.id, e]));

                const customerIds = entries
                    .map((e) => e.customerId)
                    .filter((x): x is string => !!x);
                const cs = customerIds.length > 0
                    ? await db.select().from(customers).where(inArray(customers.id, customerIds))
                    : [];
                const customerMap = new Map(cs.map((c) => [c.id, c]));
                const prizeMap = new Map(prizes.map((p) => [p.id, p]));

                winners = winnerRows.map((w) => {
                    const entry = entryMap.get(w.entryId);
                    const prize = prizeMap.get(w.prizeId);
                    const c = entry?.customerId ? customerMap.get(entry.customerId) : null;
                    return {
                        position: prize?.position ?? 0,
                        prizeName: prize?.name ?? "",
                        number: entry?.number ?? 0,
                        winnerName: c
                            ? `${c.firstName} ${(c.lastName ?? "").charAt(0)}.`.trim()
                            : null,
                    };
                }).sort((a, b) => a.position - b.position);
            }
        }

        return NextResponse.json({
            id: raffle.id,
            slug: raffle.slug,
            name: raffle.name,
            description: raffle.description,
            type: raffle.type,
            price: raffle.price,
            audience: raffle.audience,
            totalNumbers: raffle.totalNumbers,
            status: raffle.status,
            startsAt: raffle.startsAt,
            endsAt: raffle.endsAt,
            drawAt: raffle.drawAt,
            coverImage: raffle.coverImage,
            terms: raffle.terms,
            featured: raffle.featured,
            images,
            prizes,
            // Cada número con su estado (sin filtrar info sensible)
            takenNumbers: takenEntries.map((e) => ({ number: e.number, status: e.status })),
            winners,
        });
    } catch (error) {
        console.error("[PUBLIC_RAFFLE_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
