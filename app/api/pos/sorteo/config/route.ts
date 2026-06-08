import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { raffles } from "@/lib/db/schema";
import { requirePosCredentials, withPosCors } from "@/lib/pos-auth";
import { uniqueRaffleSlug } from "@/lib/raffles";
import { chileLocalToUtcISO } from "@/lib/timezone";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const DEFAULT_TOTAL = 9999;

interface SorteoConfigBody {
    source?: string;
    sorteo_token?: string;
    active?: boolean;
    name?: string;
    draw_date?: string | null;
    bg_image?: string | null; // data URI base64, o null
    fields?: {
        name?: boolean;
        phone?: boolean;
        rut?: boolean;
        email?: boolean;
        boleta?: boolean;
        address?: boolean;
    };
    boleta_min_amount?: number | null;
    boleta_from_date?: string | null;
    updated_at?: string;
}

export async function OPTIONS() {
    return withPosCors(new NextResponse(null, { status: 204 }));
}

/**
 * POST /api/pos/sorteo/config
 *
 * POSVECI empuja la configuración del sorteo de temporada (fuente de verdad).
 * Se guarda como upsert en el registro `in_store` — igual que si se hubiera
 * editado desde el admin de miniveci (last-write-wins, sin bloquear el editor local).
 *
 * Auth: mismas credenciales POS que el resto (x-api-key / x-api-secret).
 */
export async function POST(req: NextRequest) {
    const denial = await requirePosCredentials(req);
    if (denial) return denial;

    try {
        const body = (await req.json().catch(() => ({}))) as SorteoConfigBody;

        const name = (body.name ?? "").trim();
        if (!name) {
            return withPosCors(NextResponse.json({ ok: false, error: "name requerido" }, { status: 400 }));
        }

        // fields de POSVECI usa "boleta"; internamente es "receiptNumber".
        const f = body.fields ?? {};
        const entryFields = {
            name: !!f.name,
            phone: !!f.phone,
            rut: !!f.rut,
            email: !!f.email,
            receiptNumber: !!f.boleta,
            address: !!f.address,
        };

        const status = body.active ? "active" : "closed";
        const drawAt = chileLocalToUtcISO(body.draw_date ?? null);
        const sorteoToken = body.sorteo_token?.trim() || null;
        const boletaMinAmount = typeof body.boleta_min_amount === "number" ? body.boleta_min_amount : 0;
        const boletaFromDate = body.boleta_from_date?.trim() || null;
        const now = new Date().toISOString();

        // bg_image: solo lo actualizamos si POSVECI manda una imagen válida (data URI).
        // Si viene null/omitido, NO tocamos coverImage (el local se gestiona manualmente).
        let coverImage: string | undefined;
        if (body.bg_image && body.bg_image.startsWith("data:image/")) {
            const match = body.bg_image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
            if (match) {
                const contentType = match[1];
                const ext = contentType.split("/")[1] || "jpg";
                const buffer = Buffer.from(match[2], "base64");
                const blob = await put(`raffles/temporada-fondo-${Date.now()}.${ext}`, buffer, {
                    access: "public",
                    addRandomSuffix: true,
                    contentType,
                });
                coverImage = blob.url;
            }
        }

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
                coverImage: coverImage ?? null,
                entryFields: JSON.stringify(entryFields),
                sorteoToken,
                boletaMinAmount,
                boletaFromDate,
                createdAt: now,
                updatedAt: now,
            });
            console.log(`[POS_SORTEO_CONFIG] creado "${name}" token=${sorteoToken} active=${body.active}`);
            return withPosCors(NextResponse.json({ ok: true }));
        }

        await db
            .update(raffles)
            .set({
                name,
                status,
                drawAt,
                entryFields: JSON.stringify(entryFields),
                sorteoToken,
                boletaMinAmount,
                boletaFromDate,
                // coverImage solo si llegó imagen nueva.
                ...(coverImage !== undefined ? { coverImage } : {}),
                updatedAt: now,
            })
            .where(eq(raffles.id, existing.id));

        console.log(`[POS_SORTEO_CONFIG] actualizado "${name}" token=${sorteoToken} active=${body.active}`);
        return withPosCors(NextResponse.json({ ok: true }));
    } catch (error) {
        console.error("[POS_SORTEO_CONFIG]", error);
        return withPosCors(NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 }));
    }
}
