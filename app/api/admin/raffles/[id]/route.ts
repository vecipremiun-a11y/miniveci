import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { raffles, rafflePrizes, raffleImages, raffleEntries } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { raffleSchema } from "@/lib/validations/raffle";
import { eq, and, ne, sql } from "drizzle-orm";
import { ZodError } from "zod";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth();
        const { id } = await params;

        const raffle = await db.query.raffles.findFirst({ where: eq(raffles.id, id) });
        if (!raffle) {
            return NextResponse.json({ error: "Sorteo no encontrado" }, { status: 404 });
        }

        const [images, prizes, soldRow] = await Promise.all([
            db.select().from(raffleImages).where(eq(raffleImages.raffleId, id)).orderBy(raffleImages.position),
            db.select().from(rafflePrizes).where(eq(rafflePrizes.raffleId, id)).orderBy(rafflePrizes.position),
            db
                .select({ count: sql<number>`count(*)` })
                .from(raffleEntries)
                .where(and(eq(raffleEntries.raffleId, id), ne(raffleEntries.status, "cancelled"))),
        ]);

        return NextResponse.json({ ...raffle, images, prizes, soldCount: soldRow[0]?.count ?? 0 });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_RAFFLE_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth();
        const { id } = await params;
        const body = await req.json();
        const data = raffleSchema.partial().parse(body);

        const existing = await db.query.raffles.findFirst({ where: eq(raffles.id, id) });
        if (!existing) {
            return NextResponse.json({ error: "Sorteo no encontrado" }, { status: 404 });
        }

        if (data.slug && data.slug !== existing.slug) {
            const slugTaken = await db.query.raffles.findFirst({ where: eq(raffles.slug, data.slug) });
            if (slugTaken) return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
        }

        // No permitir cambiar totalNumbers si ya hay entries activos
        if (data.totalNumbers && data.totalNumbers !== existing.totalNumbers) {
            const activeEntries = await db
                .select({ count: sql<number>`count(*)` })
                .from(raffleEntries)
                .where(and(eq(raffleEntries.raffleId, id), ne(raffleEntries.status, "cancelled")));
            if ((activeEntries[0]?.count ?? 0) > 0) {
                return NextResponse.json({
                    error: "No se puede cambiar el total de números con participantes activos",
                }, { status: 400 });
            }
        }

        const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
        const fields = [
            "name", "slug", "description", "type", "price", "audience",
            "totalNumbers", "status", "startsAt", "endsAt", "drawAt",
            "coverImage", "terms", "featured",
        ] as const;
        for (const f of fields) {
            if (data[f] !== undefined) update[f] = data[f];
        }
        if (data.type === "free" || data.type === "in_store") update.price = null;

        await db.update(raffles).set(update).where(eq(raffles.id, id));

        // Si vinieron premios, reemplazar
        if (data.prizes) {
            await db.delete(rafflePrizes).where(eq(rafflePrizes.raffleId, id));
            if (data.prizes.length > 0) {
                await db.insert(rafflePrizes).values(
                    data.prizes.map((p) => ({
                        id: p.id || crypto.randomUUID(),
                        raffleId: id,
                        position: p.position,
                        name: p.name,
                        description: p.description ?? null,
                        createdAt: new Date().toISOString(),
                    }))
                );
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (error?.name === "ZodError" || error instanceof ZodError) {
            return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
        }
        console.error("[ADMIN_RAFFLE_PUT]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        await requireAuth();
        const { id } = await params;

        const existing = await db.query.raffles.findFirst({ where: eq(raffles.id, id) });
        if (!existing) {
            return NextResponse.json({ error: "Sorteo no encontrado" }, { status: 404 });
        }

        if (existing.status === "drawn") {
            return NextResponse.json({ error: "No se puede eliminar un sorteo ya sorteado" }, { status: 400 });
        }

        await db.delete(raffles).where(eq(raffles.id, id));
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_RAFFLE_DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
