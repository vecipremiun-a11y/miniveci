import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { raffles, raffleEntries, subscriptions } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { releaseExpiredReservations, RAFFLE_RESERVE_MINUTES } from "@/lib/raffles";
import { and, eq, ne } from "drizzle-orm";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "Debes iniciar sesión para participar" }, { status: 401 });
        }
        const customerId = session.user.id;

        const { slug } = await params;
        const body = await req.json();
        const numberRaw = Number(body.number);
        if (!Number.isInteger(numberRaw) || numberRaw < 1) {
            return NextResponse.json({ error: "Número inválido" }, { status: 400 });
        }

        const raffle = await db.query.raffles.findFirst({ where: eq(raffles.slug, slug) });
        if (!raffle) return NextResponse.json({ error: "Sorteo no encontrado" }, { status: 404 });
        if (raffle.status !== "active") {
            return NextResponse.json({ error: "El sorteo no está activo" }, { status: 400 });
        }
        if (numberRaw > raffle.totalNumbers) {
            return NextResponse.json({ error: "Número fuera de rango" }, { status: 400 });
        }

        // Validar audiencia
        if (raffle.audience === "subscribers") {
            const sub = await db.query.subscriptions.findFirst({
                where: and(eq(subscriptions.customerId, customerId), eq(subscriptions.status, "active")),
            });
            if (!sub) {
                return NextResponse.json({ error: "Este sorteo es solo para suscriptores" }, { status: 403 });
            }
        }

        await releaseExpiredReservations(raffle.id);

        // Verificar que el número esté libre
        const taken = await db
            .select({ id: raffleEntries.id })
            .from(raffleEntries)
            .where(and(
                eq(raffleEntries.raffleId, raffle.id),
                eq(raffleEntries.number, numberRaw),
                ne(raffleEntries.status, "cancelled"),
            ))
            .limit(1);
        if (taken.length > 0) {
            return NextResponse.json({ error: "Ese número ya no está disponible" }, { status: 409 });
        }

        const now = new Date();
        const id = crypto.randomUUID();

        if (raffle.type === "free") {
            // Inscripción directa, sin reserva
            try {
                await db.insert(raffleEntries).values({
                    id,
                    raffleId: raffle.id,
                    number: numberRaw,
                    customerId,
                    status: "free",
                    reservedAt: now.toISOString(),
                    paidAt: now.toISOString(),
                    createdAt: now.toISOString(),
                });
            } catch (e: any) {
                return NextResponse.json({ error: "Ese número ya no está disponible" }, { status: 409 });
            }
            return NextResponse.json({
                id,
                number: numberRaw,
                status: "free",
            });
        }

        // Sorteo pagado: reservar 15 min
        const expiresAt = new Date(now.getTime() + RAFFLE_RESERVE_MINUTES * 60 * 1000).toISOString();
        try {
            await db.insert(raffleEntries).values({
                id,
                raffleId: raffle.id,
                number: numberRaw,
                customerId,
                status: "reserved",
                reservedAt: now.toISOString(),
                expiresAt,
                createdAt: now.toISOString(),
            });
        } catch (e: any) {
            return NextResponse.json({ error: "Ese número ya no está disponible" }, { status: 409 });
        }

        return NextResponse.json({
            id,
            number: numberRaw,
            status: "reserved",
            expiresAt,
            price: raffle.price,
        });
    } catch (error) {
        console.error("[RAFFLE_RESERVE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ slug: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const customerId = session.user.id;
        const { slug } = await params;
        const { searchParams } = new URL(req.url);
        const number = Number(searchParams.get("number"));
        if (!Number.isInteger(number)) {
            return NextResponse.json({ error: "Número inválido" }, { status: 400 });
        }

        const raffle = await db.query.raffles.findFirst({ where: eq(raffles.slug, slug) });
        if (!raffle) return NextResponse.json({ error: "Sorteo no encontrado" }, { status: 404 });

        await db.update(raffleEntries)
            .set({ status: "cancelled" })
            .where(and(
                eq(raffleEntries.raffleId, raffle.id),
                eq(raffleEntries.number, number),
                eq(raffleEntries.customerId, customerId),
                eq(raffleEntries.status, "reserved"),
            ));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[RAFFLE_RESERVE_CANCEL]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
