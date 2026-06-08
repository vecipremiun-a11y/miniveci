import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { raffles, raffleEntries } from "@/lib/db/schema";
import { releaseExpiredReservations } from "@/lib/raffles";
import { parseEntryFields, RAFFLE_ENTRY_FIELD_META, type RaffleEntryFieldKey } from "@/lib/raffle-entry-fields";
import { and, desc, eq, ne, sql } from "drizzle-orm";

// Largo mínimo razonable por campo para una validación básica.
const MIN_LEN: Partial<Record<RaffleEntryFieldKey, number>> = {
    name: 2, phone: 8, rut: 7, email: 5, receiptNumber: 1, address: 3,
};
const MAX_LEN = 160;

const POSVECI_REGISTER_URL =
    process.env.POSVECI_SORTEO_REGISTER_URL || "https://app.posveci.com/api/sorteo/register";

/**
 * Reenvía la inscripción a POSVECI (validación fuente de verdad). El token va en el
 * servidor, nunca se expone al cliente. Si POSVECI aprueba, guardamos también un
 * espejo local en miniveci (best-effort) para que el admin vea los participantes.
 * Solo relayamos al cliente el error/ticket que devuelve POSVECI.
 */
async function registerWithPosveci(
    raffle: { id: string; name: string; sorteoToken: string | null },
    values: Partial<Record<RaffleEntryFieldKey, string>>,
) {
    // POSVECI usa la llave "boleta" para el N° de boleta (interno: receiptNumber).
    const payload: Record<string, string> = { token: raffle.sorteoToken! };
    if (values.name) payload.name = values.name;
    if (values.phone) payload.phone = values.phone;
    if (values.receiptNumber) payload.boleta = values.receiptNumber;
    if (values.rut) payload.rut = values.rut;
    if (values.email) payload.email = values.email;
    if (values.address) payload.address = values.address;

    let resp: Response;
    try {
        resp = await fetch(POSVECI_REGISTER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
    } catch (err) {
        console.error("[RAFFLE_TEMPORADA_POSVECI] fetch falló:", err);
        return NextResponse.json(
            { error: "No pudimos conectar con el sorteo. Intenta de nuevo en un momento." },
            { status: 502 },
        );
    }

    const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; ticket_number?: number; error?: string };

    if (!resp.ok || !data.ok) {
        // Relayamos textual el error de POSVECI; status válido o 400 por defecto.
        const status = resp.status >= 400 && resp.status < 600 ? resp.status : 400;
        return NextResponse.json({ error: data.error || "No se pudo inscribir" }, { status });
    }

    const ticketNumber = data.ticket_number ?? null;

    // Espejo local (best-effort): POSVECI ya validó/aprobó. Si la inserción local falla
    // (ej. colisión de número), NO rompemos la respuesta — la inscripción ya es válida.
    try {
        const now = new Date().toISOString();
        await db.insert(raffleEntries).values({
            id: crypto.randomUUID(),
            raffleId: raffle.id,
            number: ticketNumber ?? 0,
            customerId: null,
            guestName: values.name ?? null,
            guestEmail: values.email ?? null,
            guestPhone: values.phone ?? null,
            guestAddress: values.address ?? null,
            guestRut: values.rut ?? null,
            receiptNumber: values.receiptNumber ?? null,
            status: "free",
            reservedAt: now,
            paidAt: now,
            createdAt: now,
        });
    } catch (err) {
        console.error("[RAFFLE_TEMPORADA_POSVECI] espejo local falló (POSVECI ok):", err);
    }

    return NextResponse.json({
        success: true,
        ticketNumber,
        raffleName: raffle.name,
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = (await req.json()) as Record<string, unknown>;

        // Buscar el sorteo de temporada activo
        const raffle = await db.query.raffles.findFirst({
            where: and(eq(raffles.type, "in_store"), eq(raffles.status, "active")),
            orderBy: desc(raffles.createdAt),
        });
        if (!raffle) {
            return NextResponse.json({ error: "No hay un sorteo activo en este momento" }, { status: 404 });
        }

        const entryFields = parseEntryFields(raffle.entryFields);
        const activeKeys = RAFFLE_ENTRY_FIELD_META.map((f) => f.key).filter((k) => entryFields[k]);

        // Validar y recoger solo los campos activos
        const values: Partial<Record<RaffleEntryFieldKey, string>> = {};
        for (const meta of RAFFLE_ENTRY_FIELD_META) {
            if (!entryFields[meta.key]) continue;
            const raw = body[meta.key];
            const val = typeof raw === "string" ? raw.trim() : "";
            if (val.length < (MIN_LEN[meta.key] ?? 1)) {
                return NextResponse.json({ error: `Completa el campo: ${meta.label}` }, { status: 400 });
            }
            if (meta.key === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
                return NextResponse.json({ error: "Correo electrónico inválido" }, { status: 400 });
            }
            values[meta.key] = val.slice(0, MAX_LEN);
        }
        if (activeKeys.length === 0) {
            return NextResponse.json({ error: "Este sorteo no tiene campos configurados" }, { status: 400 });
        }

        // Si el sorteo es gestionado por POSVECI (tiene token), reenviamos la inscripción.
        // POSVECI valida monto/fecha/boleta contra las ventas reales y devuelve el ticket.
        if (raffle.sorteoToken) {
            return await registerWithPosveci(raffle, values);
        }

        await releaseExpiredReservations(raffle.id);

        // Anti-duplicado: por N° de boleta si está activo; si no, por celular.
        const dedupReceipt = entryFields.receiptNumber ? values.receiptNumber : undefined;
        const dedupPhone = !entryFields.receiptNumber && entryFields.phone ? values.phone : undefined;
        if (dedupReceipt) {
            const existing = await db
                .select({ id: raffleEntries.id })
                .from(raffleEntries)
                .where(and(
                    eq(raffleEntries.raffleId, raffle.id),
                    eq(raffleEntries.receiptNumber, dedupReceipt),
                    ne(raffleEntries.status, "cancelled"),
                ))
                .limit(1);
            if (existing.length > 0) {
                return NextResponse.json({ error: "Esa boleta ya fue inscrita en este sorteo" }, { status: 409 });
            }
        } else if (dedupPhone) {
            const existing = await db
                .select({ id: raffleEntries.id })
                .from(raffleEntries)
                .where(and(
                    eq(raffleEntries.raffleId, raffle.id),
                    eq(raffleEntries.guestPhone, dedupPhone),
                    ne(raffleEntries.status, "cancelled"),
                ))
                .limit(1);
            if (existing.length > 0) {
                return NextResponse.json({ error: "Ese celular ya está inscrito en este sorteo" }, { status: 409 });
            }
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

        // Asignación automática: número aleatorio libre
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
                guestName: values.name ?? null,
                guestEmail: values.email ?? null,
                guestPhone: values.phone ?? null,
                guestAddress: values.address ?? null,
                guestRut: values.rut ?? null,
                receiptNumber: values.receiptNumber ?? null,
                status: "free",
                reservedAt: now,
                paidAt: now,
                createdAt: now,
            });
        } catch {
            // colisión por race condition con el índice único parcial
            return NextResponse.json({ error: "Ese número fue tomado al instante. Vuelve a intentar." }, { status: 409 });
        }

        return NextResponse.json({
            success: true,
            number: assigned,
            // Si el sorteo pide boleta, esa es la "número de la suerte" que ve el cliente.
            receiptNumber: values.receiptNumber ?? null,
            raffleName: raffle.name,
        });
    } catch (error) {
        console.error("[RAFFLE_TEMPORADA_INSCRIBIR]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
