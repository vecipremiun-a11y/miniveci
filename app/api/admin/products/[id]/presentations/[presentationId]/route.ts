import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productPresentations, products } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { emitProductChange } from "@/lib/product-live-updates";
import { validatePresentation } from "@/lib/product-presentations";
import { barcodeConflict } from "@/lib/product-presentations-db";
import { and, eq } from "drizzle-orm";

/**
 * Editar o borrar una unidad de medida (admin).
 *
 * Las propias (source 'store') se editan enteras. Las que vienen del POS solo
 * admiten "Mostrar en la tienda" (hiddenInStore): lo demás lo pisa el próximo
 * sync de POSVECI, así que se cambia en el POS.
 */

type Params = { params: Promise<{ id: string; presentationId: string }> };

const FROM_POS = "Esta unidad de medida viene del POS. Para cambiarla, edítala en el POS.";

async function findPresentation(productId: string, presentationId: string) {
    const [row] = await db.select().from(productPresentations)
        .where(and(eq(productPresentations.id, presentationId), eq(productPresentations.productId, productId)))
        .limit(1);
    return row;
}

async function productSlug(productId: string) {
    const product = await db.query.products.findFirst({ where: eq(products.id, productId), columns: { slug: true } });
    return product?.slug ?? null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
    try {
        await requireAuth();
        const { id, presentationId } = await params;
        const body = await req.json().catch(() => ({}));

        const row = await findPresentation(id, presentationId);
        if (!row) return NextResponse.json({ error: "Unidad de medida no encontrada" }, { status: 404 });

        const updates: Partial<typeof productPresentations.$inferInsert> = {};
        if (body.hiddenInStore !== undefined) updates.hiddenInStore = Boolean(body.hiddenInStore);

        const editsData = ["name", "units", "price", "barcode", "isActive"].some((key) => body[key] !== undefined);
        if (editsData) {
            if (row.source === "pos") return NextResponse.json({ error: FROM_POS }, { status: 409 });

            const check = validatePresentation({
                name: body.name !== undefined ? body.name : row.name,
                units: body.units !== undefined ? body.units : row.units,
                price: body.price !== undefined ? body.price : row.price,
                barcode: body.barcode !== undefined ? body.barcode : row.barcode,
            });
            if (!check.ok) {
                return NextResponse.json({ error: check.error, field: check.field, suggestions: check.suggestions }, { status: 400 });
            }
            if (check.value.barcode && check.value.barcode !== row.barcode) {
                const conflict = await barcodeConflict(check.value.barcode, row.id);
                if (conflict) return NextResponse.json({ error: conflict, field: "barcode" }, { status: 409 });
            }
            Object.assign(updates, check.value);
            if (body.isActive !== undefined) updates.isActive = Boolean(body.isActive);
        }

        if (Object.keys(updates).length === 0) return NextResponse.json({ presentation: row });

        const [updated] = await db.update(productPresentations)
            .set({ ...updates, updatedAt: new Date().toISOString() })
            .where(eq(productPresentations.id, row.id))
            .returning();

        await emitProductChange(id, { slug: await productSlug(id), reason: "presentation-updated", changedFields: ["presentations"] });

        return NextResponse.json({ presentation: updated });
    } catch (error) {
        if (error instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        console.error("[PRESENTATION_PATCH]", error);
        return NextResponse.json({ error: "Error al guardar la unidad de medida" }, { status: 500 });
    }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
    try {
        await requireAuth();
        const { id, presentationId } = await params;

        const row = await findPresentation(id, presentationId);
        if (!row) return NextResponse.json({ error: "Unidad de medida no encontrada" }, { status: 404 });
        if (row.source === "pos") return NextResponse.json({ error: FROM_POS }, { status: 409 });

        // Los pedidos guardan su propia foto de la presentación: borrarla no los toca.
        await db.delete(productPresentations).where(eq(productPresentations.id, row.id));

        await emitProductChange(id, { slug: await productSlug(id), reason: "presentation-deleted", changedFields: ["presentations"] });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        console.error("[PRESENTATION_DELETE]", error);
        return NextResponse.json({ error: "Error al borrar la unidad de medida" }, { status: 500 });
    }
}
