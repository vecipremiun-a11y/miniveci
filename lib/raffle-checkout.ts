import { db } from "@/lib/db";
import { raffleEntries } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export interface RaffleCartItem {
    raffleId: string;
    number: number;
}

const RAFFLE_ID_PATTERN = /^raffle:([^:]+):(\d+)$/;

/** Extrae los items de sorteo del array de items del carrito */
export function extractRaffleItems(items: Array<{ id?: string | null }>): RaffleCartItem[] {
    const out: RaffleCartItem[] = [];
    for (const it of items) {
        if (!it?.id) continue;
        const m = String(it.id).match(RAFFLE_ID_PATTERN);
        if (m) out.push({ raffleId: m[1], number: parseInt(m[2], 10) });
    }
    return out;
}

export function isRaffleItemId(id: string | null | undefined): boolean {
    return !!id && RAFFLE_ID_PATTERN.test(id);
}

/**
 * Vincula las entries reservadas de un cliente al `orderId`. Se llama al crear la orden.
 * Solo afecta entries en estado "reserved" del cliente que coincidan con los items.
 */
export async function linkRaffleEntriesToOrder(
    orderId: string,
    customerId: string,
    items: RaffleCartItem[],
): Promise<void> {
    if (items.length === 0) return;
    for (const item of items) {
        await db.update(raffleEntries)
            .set({ orderId })
            .where(and(
                eq(raffleEntries.raffleId, item.raffleId),
                eq(raffleEntries.number, item.number),
                eq(raffleEntries.customerId, customerId),
                eq(raffleEntries.status, "reserved"),
            ));
    }
}

/** Marca todas las entries vinculadas a la orden como `paid`. Llamado desde webhook MP. */
export async function confirmRaffleEntriesForOrder(orderId: string): Promise<void> {
    const now = new Date().toISOString();
    await db.update(raffleEntries)
        .set({ status: "paid", paidAt: now })
        .where(and(eq(raffleEntries.orderId, orderId), eq(raffleEntries.status, "reserved")));
}

/** Cancela las entries vinculadas a la orden cuando el pago falla o se reembolsa. */
export async function cancelRaffleEntriesForOrder(orderId: string): Promise<void> {
    await db.update(raffleEntries)
        .set({ status: "cancelled" })
        .where(and(
            eq(raffleEntries.orderId, orderId),
            inArray(raffleEntries.status, ["reserved", "paid"]),
        ));
}
