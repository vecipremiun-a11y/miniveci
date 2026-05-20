import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { raffles, raffleEntries } from "@/lib/db/schema";
import { and, desc, eq, ne, or, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const includeAll = searchParams.get("all") === "1";

        // Sorteos in_store NO aparecen en el listado público — solo accesibles vía /sorteos/temporada con QR.
        const conditions: any[] = [ne(raffles.type, "in_store")];
        if (!includeAll) {
            conditions.push(or(eq(raffles.status, "active"), eq(raffles.status, "drawn")));
        }

        const rows = await db
            .select({
                raffle: raffles,
                soldCount: sql<number>`(
                    SELECT COUNT(*) FROM raffle_entries
                    WHERE raffle_entries.raffle_id = ${raffles.id}
                    AND raffle_entries.status IN ('paid', 'free')
                )`,
            })
            .from(raffles)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(raffles.featured), desc(raffles.createdAt));

        return NextResponse.json({
            raffles: rows.map((r) => ({
                id: r.raffle.id,
                slug: r.raffle.slug,
                name: r.raffle.name,
                description: r.raffle.description,
                type: r.raffle.type,
                price: r.raffle.price,
                audience: r.raffle.audience,
                totalNumbers: r.raffle.totalNumbers,
                status: r.raffle.status,
                startsAt: r.raffle.startsAt,
                endsAt: r.raffle.endsAt,
                drawAt: r.raffle.drawAt,
                coverImage: r.raffle.coverImage,
                featured: r.raffle.featured,
                soldCount: r.soldCount,
            })),
        });
    } catch (error) {
        console.error("[PUBLIC_RAFFLES_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
