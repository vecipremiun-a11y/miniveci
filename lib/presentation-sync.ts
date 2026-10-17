/**
 * Sync de unidades de medida POSVECI → miniveci (campo `presentations` de
 * POST /api/pos/products/sync y del webhook poskem).
 *
 * Semántica (igual que tier_group y las direcciones de clientes):
 * - Ausente (o null) = no tocar nada. Eso lo decide quien llama.
 * - Array (aunque sea []) = la lista COMPLETA de presentaciones del POS para el
 *   producto: upsert por (producto, pos_presentation_id); las filas 'pos' que no
 *   vengan (o que vengan inválidas) se borran, para no vender una versión que el
 *   POS ya no tiene.
 * - Las filas 'store' (creadas en el admin) y `hidden_in_store` NUNCA se tocan.
 * - Idempotente: mandar lo mismo dos veces no escribe nada.
 *
 * Recibe la conexión por parámetro (sin importar lib/db) para poder testearlo
 * contra una base en memoria (lib/__tests__/presentation-sync.test.ts).
 */

import { and, eq, inArray } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "./db/schema";
import { productPresentations } from "./db/schema";
import {
    parsePosPresentations,
    presentationsAllowed,
    type PosPresentationInput,
    type SkippedPresentation,
} from "./product-presentations";

type Conn = LibSQLDatabase<typeof schema>;

export interface PresentationSyncResult {
    /** Creadas o cambiadas. */
    upserted: number;
    /** Ya estaban iguales (no se escribió nada). */
    unchanged: number;
    /** Filas 'pos' de este producto borradas porque no vinieron (o vinieron inválidas). */
    deleted: number;
    skipped: SkippedPresentation[];
}

type PosRow = typeof productPresentations.$inferSelect;

/**
 * Lo que trae el campo `presentations` de un sync: undefined = no tocar nada
 * (ausente o null); un array (aunque sea []) = la lista completa del POS.
 */
export function readSyncPresentations(value: unknown): unknown[] | undefined {
    return Array.isArray(value) ? value : undefined;
}

function sameData(row: PosRow, incoming: PosPresentationInput): boolean {
    return row.name === incoming.name
        && row.units === incoming.units
        && row.price === incoming.price
        && (row.barcode ?? null) === incoming.barcode
        && Boolean(row.isActive) === incoming.isActive;
}

export async function syncPosPresentations(
    conn: Conn,
    product: { id: string; unit?: string | null; equivLabel?: string | null; equivWeight?: number | null },
    raw: unknown[],
): Promise<PresentationSyncResult> {
    const skipped: SkippedPresentation[] = [];
    let valid: PosPresentationInput[] = [];

    if (presentationsAllowed(product)) {
        const parsed = parsePosPresentations(raw);
        valid = parsed.valid;
        skipped.push(...parsed.skipped);
    } else {
        for (const entry of raw) {
            const item = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
            const id = item.pos_presentation_id ?? item.posPresentationId;
            skipped.push({
                pos_presentation_id: id === null || id === undefined ? null : String(id),
                error: `Las unidades de medida son solo para productos por unidad (este es "${product.unit ?? ""}")`,
            });
        }
    }

    // Un código de barras no puede repetirse entre presentaciones. Las filas
    // 'pos' de este mismo producto no cuentan: se reescriben en este envío.
    const barcodes = valid.map((v) => v.barcode).filter((b): b is string => !!b);
    if (barcodes.length > 0) {
        const taken = await conn
            .select({ barcode: productPresentations.barcode, productId: productPresentations.productId, source: productPresentations.source })
            .from(productPresentations)
            .where(inArray(productPresentations.barcode, barcodes));
        const takenElsewhere = new Set(
            taken.filter((t) => !(t.productId === product.id && t.source === "pos")).map((t) => t.barcode),
        );
        if (takenElsewhere.size > 0) {
            valid = valid.filter((v) => {
                if (!v.barcode || !takenElsewhere.has(v.barcode)) return true;
                skipped.push({ pos_presentation_id: v.posPresentationId, error: `El código ${v.barcode} ya lo usa otra unidad de medida` });
                return false;
            });
        }
    }

    const existing = await conn
        .select()
        .from(productPresentations)
        .where(and(eq(productPresentations.productId, product.id), eq(productPresentations.source, "pos")));
    const byPosId = new Map(existing.map((row) => [row.posPresentationId ?? "", row]));
    const incomingIds = new Set(valid.map((v) => v.posPresentationId));

    const toDelete = existing.filter((row) => !incomingIds.has(row.posPresentationId ?? ""));
    const toInsert = valid.filter((v) => !byPosId.has(v.posPresentationId));
    const toUpdate = valid.filter((v) => {
        const row = byPosId.get(v.posPresentationId);
        return row !== undefined && !sameData(row, v);
    });
    const unchanged = valid.length - toInsert.length - toUpdate.length;

    if (toDelete.length > 0 || toInsert.length > 0 || toUpdate.length > 0) {
        const now = new Date().toISOString();
        await conn.transaction(async (tx) => {
            if (toDelete.length > 0) {
                await tx.delete(productPresentations).where(inArray(productPresentations.id, toDelete.map((r) => r.id)));
            }
            // Los códigos que cambian se sueltan primero: así dos presentaciones
            // pueden intercambiarse el código en un mismo envío.
            const releasing = toUpdate
                .map((v) => byPosId.get(v.posPresentationId)!)
                .filter((row, i) => row.barcode && row.barcode !== toUpdate[i].barcode);
            if (releasing.length > 0) {
                await tx.update(productPresentations)
                    .set({ barcode: null })
                    .where(inArray(productPresentations.id, releasing.map((r) => r.id)));
            }
            for (const v of toUpdate) {
                const row = byPosId.get(v.posPresentationId)!;
                await tx.update(productPresentations)
                    .set({ name: v.name, units: v.units, price: v.price, barcode: v.barcode, isActive: v.isActive, updatedAt: now })
                    .where(eq(productPresentations.id, row.id));
            }
            if (toInsert.length > 0) {
                await tx.insert(productPresentations).values(toInsert.map((v) => ({
                    id: crypto.randomUUID(),
                    productId: product.id,
                    source: "pos",
                    posPresentationId: v.posPresentationId,
                    name: v.name,
                    units: v.units,
                    price: v.price,
                    barcode: v.barcode,
                    isActive: v.isActive,
                    hiddenInStore: false,
                    createdAt: now,
                    updatedAt: now,
                })));
            }
        });
    }

    return {
        upserted: toInsert.length + toUpdate.length,
        unchanged,
        deleted: toDelete.length,
        skipped,
    };
}
