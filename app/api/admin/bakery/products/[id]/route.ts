import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { db } from "@/lib/db";
import { bakeryProducts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { bakeryProductObjectSchema } from "@/lib/validations/bakery";
import { serializeProduct } from "@/lib/bakery";
import { ZodError } from "zod";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAuth();
        const { id } = await params;
        const body = await req.json().catch(() => ({}));
        const data = bakeryProductObjectSchema.partial().parse(body);

        const existing = await db.query.bakeryProducts.findFirst({ where: eq(bakeryProducts.id, id) });
        if (!existing) return NextResponse.json({ message: "Producto no encontrado" }, { status: 404 });

        // Si cambia a pricingMode='kg', validar gramsPerUnit
        const nextMode = data.pricingMode ?? existing.pricingMode;
        const nextGrams = data.gramsPerUnit ?? existing.gramsPerUnit;
        if (nextMode === "kg" && (!nextGrams || nextGrams <= 0)) {
            return NextResponse.json({ message: "gramsPerUnit es requerido para pricingMode='kg'" }, { status: 400 });
        }

        const update: any = { updatedAt: new Date().toISOString() };
        const fields = ["name", "description", "imageUrl", "category", "pricingMode", "price", "gramsPerUnit", "allowsNotes", "active", "sortOrder"] as const;
        for (const f of fields) if (data[f] !== undefined) update[f] = data[f];

        await db.update(bakeryProducts).set(update).where(eq(bakeryProducts.id, id));
        const refreshed = await db.query.bakeryProducts.findFirst({ where: eq(bakeryProducts.id, id) });
        return NextResponse.json(refreshed ? serializeProduct(refreshed) : { success: true });
    } catch (error: any) {
        if (error instanceof AuthError) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
        if (error instanceof ZodError) {
            return NextResponse.json({ message: error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
        }
        console.error("[ADMIN_BAKERY_PRODUCT_PATCH]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAuth();
        const { id } = await params;

        const existing = await db.query.bakeryProducts.findFirst({ where: eq(bakeryProducts.id, id) });
        if (!existing) return NextResponse.json({ message: "Producto no encontrado" }, { status: 404 });

        // Borrado real (hard delete). El histórico de encargos NO se afecta:
        // bakery_order_items guarda un snapshot del producto y no tiene FK a esta tabla.
        await db.delete(bakeryProducts).where(eq(bakeryProducts.id, id));

        // Limpiar la imagen del blob si era una subida nuestra (evita huérfanos).
        if (existing.imageUrl && existing.imageUrl.includes(".public.blob.vercel-storage.com")) {
            try { await del(existing.imageUrl.split("?")[0]); } catch { /* puede ya no existir */ }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AuthError) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
        console.error("[ADMIN_BAKERY_PRODUCT_DELETE]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}
