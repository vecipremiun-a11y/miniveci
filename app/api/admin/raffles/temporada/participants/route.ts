import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { raffles, raffleEntries } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { and, desc, eq } from "drizzle-orm";

/**
 * DELETE /api/admin/raffles/temporada/participants
 *
 * Borra el espejo local de participantes del sorteo de temporada.
 *   ?id=<entryId>  → borra solo esa inscripción.
 *   (sin id)       → vacía la lista completa del sorteo.
 *
 * Nota: solo afecta la copia local de miniveci. POSVECI mantiene su propia lista.
 */
export async function DELETE(req: NextRequest) {
    try {
        await requireAuth();

        const raffle = await db.query.raffles.findFirst({
            where: eq(raffles.type, "in_store"),
            orderBy: desc(raffles.createdAt),
            columns: { id: true },
        });
        if (!raffle) {
            return NextResponse.json({ error: "No hay sorteo de temporada" }, { status: 404 });
        }

        const id = new URL(req.url).searchParams.get("id");

        if (id) {
            await db
                .delete(raffleEntries)
                .where(and(eq(raffleEntries.raffleId, raffle.id), eq(raffleEntries.id, id)));
            return NextResponse.json({ ok: true, scope: "one" });
        }

        await db.delete(raffleEntries).where(eq(raffleEntries.raffleId, raffle.id));
        return NextResponse.json({ ok: true, scope: "all" });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_RAFFLE_TEMPORADA_PARTICIPANTS_DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
