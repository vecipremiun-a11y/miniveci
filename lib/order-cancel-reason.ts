/**
 * Motivo de cancelación que el local le da al cliente.
 *
 * Cuando POSVECI cancela un pedido de tienda (por ejemplo, "La transferencia no
 * llegó") manda un `reason` que hay que mostrarle al cliente. Se guarda como
 * nota de la fila `cancelled` del historial, escrita por POSVECI; si no mandó
 * motivo, la nota queda vacía.
 */

import { db } from "@/lib/db";
import { orderStatusHistory } from "@/lib/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

/** `changedBy` de las filas de historial que escribe el callback de POSVECI. */
export const POSVECI_ACTOR = "posveci";

// Antes la cancelación sin motivo guardaba este texto interno; no es para el cliente.
const LEGACY_GENERIC_NOTE = /^POSVECI cambió el estado de /;

/** Motivo de cancelación de POSVECI por pedido (solo los que tienen uno). */
export async function getPosCancelReasons(orderIds: string[]): Promise<Map<string, string>> {
    const reasons = new Map<string, string>();
    if (orderIds.length === 0) return reasons;

    const rows = await db.select({ orderId: orderStatusHistory.orderId, notes: orderStatusHistory.notes })
        .from(orderStatusHistory)
        .where(and(
            inArray(orderStatusHistory.orderId, orderIds),
            eq(orderStatusHistory.status, "cancelled"),
            eq(orderStatusHistory.changedBy, POSVECI_ACTOR),
        ))
        .orderBy(desc(orderStatusHistory.createdAt));

    for (const row of rows) {
        if (!row.orderId || reasons.has(row.orderId)) continue;
        const note = row.notes?.trim();
        if (note && !LEGACY_GENERIC_NOTE.test(note)) reasons.set(row.orderId, note);
    }
    return reasons;
}
