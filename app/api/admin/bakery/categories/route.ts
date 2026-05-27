import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { bakeryCategories } from "@/lib/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { slugifyBakeryCategory } from "@/lib/bakery-shared";

export const dynamic = "force-dynamic";

/** GET — lista (incluye inactivas) para el admin. */
export async function GET() {
    try {
        await requireAuth();
        const rows = await db
            .select()
            .from(bakeryCategories)
            .orderBy(asc(bakeryCategories.sortOrder), asc(bakeryCategories.label));
        return NextResponse.json(rows);
    } catch (error) {
        if (error instanceof AuthError) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
        console.error("[ADMIN_BAKERY_CATEGORIES_GET]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}

/** POST — crea una categoría nueva por nombre. Idempotente por slug (si existe, la devuelve). */
export async function POST(req: NextRequest) {
    try {
        await requireAuth();
        const body = await req.json().catch(() => ({}));
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) {
            return NextResponse.json({ message: "Nombre requerido" }, { status: 400 });
        }
        if (name.length > 40) {
            return NextResponse.json({ message: "Máximo 40 caracteres" }, { status: 400 });
        }

        const slug = slugifyBakeryCategory(name);
        if (!slug) {
            return NextResponse.json({ message: "Nombre inválido" }, { status: 400 });
        }

        // Si ya existe, devolverla (idempotente — no duplicar)
        const existing = await db.query.bakeryCategories.findFirst({
            where: eq(bakeryCategories.slug, slug),
        });
        if (existing) {
            return NextResponse.json(existing, { status: 200 });
        }

        // sortOrder = al final
        const maxRow = await db
            .select({ max: sql<number>`COALESCE(MAX(${bakeryCategories.sortOrder}), -1)` })
            .from(bakeryCategories);
        const nextOrder = (maxRow[0]?.max ?? -1) + 1;

        const row = {
            id: `bcat_${randomUUID().slice(0, 12)}`,
            slug,
            label: name,
            sortOrder: nextOrder,
            active: true,
            createdAt: new Date().toISOString(),
        };
        await db.insert(bakeryCategories).values(row);
        return NextResponse.json(row, { status: 201 });
    } catch (error) {
        if (error instanceof AuthError) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
        console.error("[ADMIN_BAKERY_CATEGORIES_POST]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}
