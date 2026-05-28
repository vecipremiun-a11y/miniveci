import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { bakeryProducts } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { bakeryProductSchema } from "@/lib/validations/bakery";
import { serializeProduct } from "@/lib/bakery";
import { ZodError } from "zod";

export async function GET() {
    try {
        await requireAuth();
        const rows = await db
            .select()
            .from(bakeryProducts)
            .orderBy(asc(bakeryProducts.sortOrder), desc(bakeryProducts.createdAt));
        return NextResponse.json(rows.map(serializeProduct));
    } catch (error) {
        if (error instanceof AuthError) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
        console.error("[ADMIN_BAKERY_PRODUCTS_GET]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        await requireAuth();
        const body = await req.json().catch(() => ({}));
        const data = bakeryProductSchema.parse(body);

        const id = randomUUID();
        const now = new Date().toISOString();
        await db.insert(bakeryProducts).values({
            id,
            name: data.name.trim(),
            description: data.description?.trim() || null,
            imageUrl: data.imageUrl || null,
            category: data.category,
            pricingMode: data.pricingMode,
            price: data.price,
            gramsPerUnit: data.gramsPerUnit ?? null,
            leadTimeHours: data.leadTimeHours ?? null,
            allowsNotes: data.allowsNotes,
            active: data.active,
            sortOrder: data.sortOrder,
            createdAt: now,
            updatedAt: now,
        });

        const created = await db.query.bakeryProducts.findFirst({ where: eq(bakeryProducts.id, id) });
        return NextResponse.json(created ? serializeProduct(created) : { id }, { status: 201 });
    } catch (error: any) {
        if (error instanceof AuthError) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
        if (error instanceof ZodError) {
            return NextResponse.json({ message: error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
        }
        console.error("[ADMIN_BAKERY_PRODUCTS_POST]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}
