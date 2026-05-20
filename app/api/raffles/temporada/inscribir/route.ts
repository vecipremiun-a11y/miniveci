import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { raffles, raffleEntries } from "@/lib/db/schema";
import { releaseExpiredReservations } from "@/lib/raffles";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
    name: z.string().min(2, "Tu nombre es muy corto").max(80),
    address: z.string().min(3, "Ingresa tu dirección").max(160),
    phone: z.string().min(8, "Celular inválido").max(20),
    receiptNumber: z.string().min(1, "Ingresa el N° de boleta").max(40),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = schema.parse(body);

        // Buscar el sorteo de temporada activo
        const raffle = await db.query.raffles.findFirst({
            where: and(eq(raffles.type, "in_store"), eq(raffles.status, "active")),
            orderBy: desc(raffles.createdAt),
        });
        if (!raffle) {
            return NextResponse.json({ error: "No hay un sorteo activo en este momento" }, { status: 404 });
        }

        await releaseExpiredReservations(raffle.id);

        // Verificar que el N° de boleta no esté ya inscrito en este sorteo
        const receipt = data.receiptNumber.trim();
        const phone = data.phone.trim();
        const existing = await db
            .select({ id: raffleEntries.id })
            .from(raffleEntries)
            .where(and(
                eq(raffleEntries.raffleId, raffle.id),
                eq(raffleEntries.receiptNumber, receipt),
                ne(raffleEntries.status, "cancelled"),
            ))
            .limit(1);
        if (existing.length > 0) {
            return NextResponse.json({ error: "Esa boleta ya fue inscrita en este sorteo" }, { status: 409 });
        }

        // Verificar capacidad
        const taken = await db
            .select({ count: sql<number>`count(*)` })
            .from(raffleEntries)
            .where(and(eq(raffleEntries.raffleId, raffle.id), ne(raffleEntries.status, "cancelled")));
        const used = taken[0]?.count ?? 0;
        if (used >= raffle.totalNumbers) {
            return NextResponse.json({ error: "El sorteo está lleno. Sigue nuestras redes para el próximo." }, { status: 409 });
        }

        // Asignación automática: probamos un número aleatorio libre con reintentos
        const takenRows = await db
            .select({ number: raffleEntries.number })
            .from(raffleEntries)
            .where(and(eq(raffleEntries.raffleId, raffle.id), ne(raffleEntries.status, "cancelled")));
        const takenSet = new Set(takenRows.map((r) => r.number));
        const free: number[] = [];
        for (let n = 1; n <= raffle.totalNumbers; n++) if (!takenSet.has(n)) free.push(n);
        if (free.length === 0) {
            return NextResponse.json({ error: "El sorteo está lleno" }, { status: 409 });
        }
        const assigned = free[crypto.randomInt(0, free.length)];

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        try {
            await db.insert(raffleEntries).values({
                id,
                raffleId: raffle.id,
                number: assigned,
                customerId: null,
                guestName: data.name.trim(),
                guestEmail: null,
                guestPhone: phone,
                guestAddress: data.address.trim(),
                receiptNumber: receipt,
                status: "free",
                reservedAt: now,
                paidAt: now,
                createdAt: now,
            });
        } catch (e: any) {
            // colisión por race condition con el índice único parcial
            return NextResponse.json({ error: "Ese número fue tomado al instante. Vuelve a intentar." }, { status: 409 });
        }

        return NextResponse.json({
            success: true,
            number: assigned,
            raffleName: raffle.name,
        });
    } catch (error: any) {
        if (error?.issues) {
            return NextResponse.json({ error: error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
        }
        console.error("[RAFFLE_TEMPORADA_INSCRIBIR]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
