/**
 * Lecturas de product_presentations para la tienda, el checkout y el admin.
 * Las reglas viven en lib/product-presentations.ts.
 */

import { db } from "@/lib/db";
import { productPresentations, products } from "@/lib/db/schema";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import {
    isPresentationVisible,
    sortPresentations,
    toStorePresentation,
    type PresentationRecord,
    type StorePresentation,
} from "@/lib/product-presentations";

export type PresentationRow = typeof productPresentations.$inferSelect;

function toRecord(row: PresentationRow): PresentationRecord {
    return {
        id: row.id,
        productId: row.productId,
        source: row.source,
        posPresentationId: row.posPresentationId,
        name: row.name,
        units: row.units,
        price: row.price,
        barcode: row.barcode,
        isActive: Boolean(row.isActive),
        hiddenInStore: Boolean(row.hiddenInStore),
    };
}

/**
 * Presentaciones que se venden en la tienda (activas y no ocultas), por
 * producto. Quien llama decide si el producto las admite (presentationsAllowed).
 *
 * Si la tabla todavía no existe (migración 0029 sin correr) devuelve vacío: el
 * catálogo sigue funcionando igual que antes.
 */
export async function loadStorePresentations(productIds: string[]): Promise<Map<string, StorePresentation[]>> {
    const out = new Map<string, StorePresentation[]>();
    if (productIds.length === 0) return out;
    try {
        const rows = await db.select().from(productPresentations)
            .where(inArray(productPresentations.productId, productIds));
        for (const row of sortPresentations(rows)) {
            if (!isPresentationVisible(row)) continue;
            const list = out.get(row.productId) ?? [];
            list.push(toStorePresentation(row));
            out.set(row.productId, list);
        }
    } catch (err) {
        console.error("[PRESENTATIONS] no se pudieron leer las unidades de medida:", (err as Error).message);
    }
    return out;
}

/** Las presentaciones que pide un carrito, por id (sin filtrar: lo valida resolvePresentationLine). */
export async function loadPresentationsByIds(ids: string[]): Promise<Map<string, PresentationRecord>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return new Map();
    const rows = await db.select().from(productPresentations).where(inArray(productPresentations.id, unique));
    return new Map(rows.map((row) => [row.id, toRecord(row)]));
}

/** Todas las del producto, para el admin (de la más chica a la más grande). */
export async function listProductPresentations(productId: string): Promise<PresentationRow[]> {
    const rows = await db.select().from(productPresentations).where(eq(productPresentations.productId, productId));
    return sortPresentations(rows);
}

/**
 * ¿El código de barras ya está tomado? Tiene que ser único entre
 * presentaciones y distinto del SKU de cualquier producto (igual que en
 * POSVECI, donde se escanea en la caja). Devuelve el motivo o null.
 */
export async function barcodeConflict(barcode: string, exceptPresentationId?: string): Promise<string | null> {
    const [presentation] = await db
        .select({ name: productPresentations.name, productName: products.name })
        .from(productPresentations)
        .innerJoin(products, eq(productPresentations.productId, products.id))
        .where(and(
            eq(productPresentations.barcode, barcode),
            exceptPresentationId ? ne(productPresentations.id, exceptPresentationId) : undefined,
        ))
        .limit(1);
    if (presentation) return `El código ${barcode} ya lo usa "${presentation.name}" de ${presentation.productName}`;

    const [product] = await db
        .select({ name: products.name })
        .from(products)
        .where(sql`UPPER(TRIM(${products.sku})) = ${barcode.toUpperCase()}`)
        .limit(1);
    if (product) return `El código ${barcode} es el SKU de ${product.name}`;

    return null;
}
