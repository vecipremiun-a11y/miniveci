import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { raffles, rafflePrizes, raffleEntries } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { raffleSchema } from "@/lib/validations/raffle";
import { uniqueRaffleSlug, slugify } from "@/lib/raffles";
import { desc, eq, and, or, sql, ne } from "drizzle-orm";
import { ZodError } from "zod";

export async function GET(req: NextRequest) {
    try {
        await requireAuth();
        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search");
        const status = searchParams.get("status");

        const conditions = [];
        if (search) {
            const term = search.trim().toLowerCase();
            conditions.push(
                or(
                    sql`LOWER(${raffles.name}) LIKE ${"%" + term + "%"}`,
                    sql`LOWER(${raffles.slug}) LIKE ${"%" + term + "%"}`,
                )
            );
        }
        if (status && status !== "all") {
            conditions.push(eq(raffles.status, status));
        }

        const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

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
            .where(whereCondition)
            .orderBy(desc(raffles.createdAt));

        return NextResponse.json({
            raffles: rows.map((r) => ({ ...r.raffle, soldCount: r.soldCount })),
        });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_RAFFLES_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await requireAuth();
        const body = await req.json();
        const data = raffleSchema.parse(body);

        const slug = data.slug ? slugify(data.slug) : await uniqueRaffleSlug(data.name);

        const existing = await db.query.raffles.findFirst({ where: eq(raffles.slug, slug) });
        if (existing) {
            return NextResponse.json({ error: "El slug ya existe" }, { status: 409 });
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        await db.insert(raffles).values({
            id,
            slug,
            name: data.name,
            description: data.description ?? null,
            type: data.type,
            price: data.type === "paid" ? data.price ?? null : null,
            audience: data.audience,
            totalNumbers: data.totalNumbers,
            status: data.status,
            startsAt: data.startsAt ?? null,
            endsAt: data.endsAt ?? null,
            drawAt: data.drawAt ?? null,
            coverImage: data.coverImage || null,
            terms: data.terms ?? null,
            featured: data.featured,
            createdAt: now,
            updatedAt: now,
        });

        if (data.prizes && data.prizes.length > 0) {
            await db.insert(rafflePrizes).values(
                data.prizes.map((p) => ({
                    id: crypto.randomUUID(),
                    raffleId: id,
                    position: p.position,
                    name: p.name,
                    description: p.description ?? null,
                    createdAt: now,
                }))
            );
        }

        const created = await db.query.raffles.findFirst({ where: eq(raffles.id, id) });
        return NextResponse.json(created, { status: 201 });
    } catch (error: any) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (error?.name === "ZodError" || error instanceof ZodError) {
            return NextResponse.json({ error: "Validation Error", details: error.errors }, { status: 400 });
        }
        console.error("[ADMIN_RAFFLES_POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
