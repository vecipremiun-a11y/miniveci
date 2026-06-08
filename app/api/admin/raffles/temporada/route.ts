import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { raffles, raffleEntries } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { uniqueRaffleSlug } from "@/lib/raffles";
import { parseEntryFields, type RaffleEntryFields } from "@/lib/raffle-entry-fields";
import { and, desc, eq, ne } from "drizzle-orm";

const DEFAULT_TOTAL = 9999;

/** Devuelve el sorteo de temporada (in_store) más reciente, su config y participantes. */
export async function GET() {
    try {
        await requireAuth();

        const raffle = await db.query.raffles.findFirst({
            where: eq(raffles.type, "in_store"),
            orderBy: desc(raffles.createdAt),
        });

        if (!raffle) {
            return NextResponse.json({ raffle: null, participants: [] });
        }

        const entries = await db
            .select()
            .from(raffleEntries)
            .where(and(eq(raffleEntries.raffleId, raffle.id), ne(raffleEntries.status, "cancelled")))
            .orderBy(desc(raffleEntries.createdAt));

        const participants = entries.map((e) => ({
            id: e.id,
            number: e.number,
            name: e.guestName,
            phone: e.guestPhone,
            rut: e.guestRut,
            email: e.guestEmail,
            address: e.guestAddress,
            receiptNumber: e.receiptNumber,
            createdAt: e.createdAt,
        }));

        return NextResponse.json({
            raffle: {
                id: raffle.id,
                name: raffle.name,
                status: raffle.status,
                drawAt: raffle.drawAt,
                coverImage: raffle.coverImage,
                entryFields: parseEntryFields(raffle.entryFields),
            },
            participants,
        });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_RAFFLE_TEMPORADA_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

/** Crea o actualiza el sorteo de temporada (nombre, estado, fecha y campos de inscripción). */
export async function PUT(req: NextRequest) {
    try {
        await requireAuth();
        const body = (await req.json()) as {
            name?: string;
            status?: "active" | "closed" | "draft";
            drawAt?: string | null;
            coverImage?: string | null;
            entryFields?: RaffleEntryFields;
        };

        const name = (body.name ?? "").trim();
        if (!name) {
            return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
        }
        const entryFields = parseEntryFields(body.entryFields);
        if (!Object.values(entryFields).some(Boolean)) {
            return NextResponse.json({ error: "Marca al menos un campo de inscripción" }, { status: 400 });
        }
        const status = body.status ?? "active";
        const drawAt = body.drawAt ?? null;
        const coverImage = body.coverImage ?? null;
        const now = new Date().toISOString();

        const existing = await db.query.raffles.findFirst({
            where: eq(raffles.type, "in_store"),
            orderBy: desc(raffles.createdAt),
        });

        if (!existing) {
            const id = crypto.randomUUID();
            const slug = await uniqueRaffleSlug(name);
            await db.insert(raffles).values({
                id,
                slug,
                name,
                type: "in_store",
                price: null,
                audience: "all",
                totalNumbers: DEFAULT_TOTAL,
                status,
                drawAt,
                coverImage,
                entryFields: JSON.stringify(entryFields),
                createdAt: now,
                updatedAt: now,
            });
            return NextResponse.json({ id, created: true });
        }

        await db
            .update(raffles)
            .set({ name, status, drawAt, coverImage, entryFields: JSON.stringify(entryFields), updatedAt: now })
            .where(eq(raffles.id, existing.id));

        return NextResponse.json({ id: existing.id, created: false });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_RAFFLE_TEMPORADA_PUT]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
