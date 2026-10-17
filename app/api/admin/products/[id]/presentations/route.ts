import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { productPresentations, products } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { emitProductChange } from "@/lib/product-live-updates";
import { presentationsAllowed, validatePresentation } from "@/lib/product-presentations";
import { barcodeConflict, listProductPresentations } from "@/lib/product-presentations-db";
import { eq } from "drizzle-orm";

/**
 * Unidades de medida de un producto (admin).
 * GET: todas (las del POS y las propias). POST: crea una propia (source 'store').
 * Las del POS no se crean acá: llegan en el sync de POSVECI.
 */

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
    try {
        await requireAuth();
        const { id } = await params;
        return NextResponse.json({ presentations: await listProductPresentations(id) });
    } catch (error) {
        if (error instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        console.error("[PRESENTATIONS_GET]", error);
        return NextResponse.json({ error: "Error al cargar las unidades de medida" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: Params) {
    try {
        await requireAuth();
        const { id } = await params;
        const body = await req.json().catch(() => ({}));

        const product = await db.query.products.findFirst({
            where: eq(products.id, id),
            columns: { id: true, slug: true, unit: true, equivLabel: true, equivWeight: true },
        });
        if (!product) return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
        if (!presentationsAllowed(product)) {
            return NextResponse.json({
                error: "Las unidades de medida son solo para productos que se venden por unidad (Und). Guarda primero el producto como Und.",
            }, { status: 400 });
        }

        const check = validatePresentation(body);
        if (!check.ok) {
            return NextResponse.json({ error: check.error, field: check.field, suggestions: check.suggestions }, { status: 400 });
        }
        if (check.value.barcode) {
            const conflict = await barcodeConflict(check.value.barcode);
            if (conflict) return NextResponse.json({ error: conflict, field: "barcode" }, { status: 409 });
        }

        const now = new Date().toISOString();
        const [created] = await db.insert(productPresentations).values({
            id: crypto.randomUUID(),
            productId: id,
            source: "store",
            posPresentationId: null,
            ...check.value,
            isActive: body.isActive === undefined ? true : Boolean(body.isActive),
            hiddenInStore: Boolean(body.hiddenInStore),
            createdAt: now,
            updatedAt: now,
        }).returning();

        await emitProductChange(id, { slug: product.slug, reason: "presentation-created", changedFields: ["presentations"] });

        return NextResponse.json({ presentation: created }, { status: 201 });
    } catch (error) {
        if (error instanceof AuthError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        console.error("[PRESENTATIONS_POST]", error);
        return NextResponse.json({ error: "Error al crear la unidad de medida" }, { status: 500 });
    }
}
