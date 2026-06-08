import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { raffles, raffleImages, rafflePrizes, raffleEntries, raffleWinners, customers } from "@/lib/db/schema";
import { and, eq, desc, ne, inArray } from "drizzle-orm";
import { parseEntryFields } from "@/lib/raffle-entry-fields";

/**
 * Devuelve el sorteo de temporada activo (tipo "in_store").
 * Si hay varios activos, retorna el más reciente.
 */
export async function GET() {
    try {
        const raffle = await db.query.raffles.findFirst({
            where: and(eq(raffles.type, "in_store"), eq(raffles.status, "active")),
            orderBy: desc(raffles.createdAt),
        });

        if (!raffle) {
            // Buscar uno ya sorteado para mostrar ganadores
            const drawn = await db.query.raffles.findFirst({
                where: and(eq(raffles.type, "in_store"), eq(raffles.status, "drawn")),
                orderBy: desc(raffles.updatedAt),
            });
            if (!drawn) return NextResponse.json({ raffle: null });

            const winners = await fetchWinners(drawn.id);
            return NextResponse.json({
                raffle: serializeRaffle(drawn, [], [], 0, winners),
            });
        }

        const [images, prizes, entriesCount] = await Promise.all([
            db.select().from(raffleImages).where(eq(raffleImages.raffleId, raffle.id)).orderBy(raffleImages.position),
            db.select().from(rafflePrizes).where(eq(rafflePrizes.raffleId, raffle.id)).orderBy(rafflePrizes.position),
            db
                .select({ id: raffleEntries.id })
                .from(raffleEntries)
                .where(and(eq(raffleEntries.raffleId, raffle.id), ne(raffleEntries.status, "cancelled"))),
        ]);

        return NextResponse.json({
            raffle: serializeRaffle(raffle, images, prizes, entriesCount.length, []),
        });
    } catch (error) {
        console.error("[PUBLIC_RAFFLE_TEMPORADA_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

async function fetchWinners(raffleId: string) {
    const winnerRows = await db.select().from(raffleWinners).where(eq(raffleWinners.raffleId, raffleId));
    if (winnerRows.length === 0) return [];

    const entryIds = winnerRows.map((w) => w.entryId);
    const entries = await db.select().from(raffleEntries).where(inArray(raffleEntries.id, entryIds));
    const prizes = await db.select().from(rafflePrizes).where(eq(rafflePrizes.raffleId, raffleId));
    const customerIds = entries.map((e) => e.customerId).filter((x): x is string => !!x);
    const cs = customerIds.length > 0 ? await db.select().from(customers).where(inArray(customers.id, customerIds)) : [];

    const entryMap = new Map(entries.map((e) => [e.id, e]));
    const prizeMap = new Map(prizes.map((p) => [p.id, p]));
    const cMap = new Map(cs.map((c) => [c.id, c]));

    return winnerRows
        .map((w) => {
            const entry = entryMap.get(w.entryId);
            const prize = prizeMap.get(w.prizeId);
            const name = entry?.customerId
                ? (() => {
                    const c = cMap.get(entry.customerId!);
                    return c ? `${c.firstName} ${(c.lastName ?? "").charAt(0)}.`.trim() : null;
                })()
                : entry?.guestName ?? null;
            return {
                position: prize?.position ?? 0,
                prizeName: prize?.name ?? "",
                number: entry?.number ?? 0,
                winnerName: name,
            };
        })
        .sort((a, b) => a.position - b.position);
}

function serializeRaffle(
    raffle: any,
    images: any[],
    prizes: any[],
    entriesCount: number,
    winners: any[],
) {
    return {
        id: raffle.id,
        slug: raffle.slug,
        name: raffle.name,
        description: raffle.description,
        type: raffle.type,
        totalNumbers: raffle.totalNumbers,
        status: raffle.status,
        endsAt: raffle.endsAt,
        drawAt: raffle.drawAt,
        coverImage: raffle.coverImage,
        terms: raffle.terms,
        entryFields: parseEntryFields(raffle.entryFields),
        boletaMinAmount: raffle.boletaMinAmount ?? 0,
        images,
        prizes,
        entriesCount,
        winners,
    };
}
