import { db } from "@/lib/db";
import { raffles, raffleEntries } from "@/lib/db/schema";
import { and, eq, ne, lt } from "drizzle-orm";

export const RAFFLE_RESERVE_MINUTES = 15;

export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

/**
 * Genera un slug único para un raffle. Si el base ya existe, agrega -2, -3, ...
 */
export async function uniqueRaffleSlug(name: string): Promise<string> {
    const base = slugify(name) || `sorteo-${Date.now()}`;
    let candidate = base;
    let i = 2;
    while (true) {
        const existing = await db.query.raffles.findFirst({ where: eq(raffles.slug, candidate) });
        if (!existing) return candidate;
        candidate = `${base}-${i}`;
        i += 1;
    }
}

/**
 * Libera reservas expiradas (status="reserved" con expires_at < now) marcándolas
 * como "cancelled". Se llama perezosamente antes de leer o reservar.
 */
export async function releaseExpiredReservations(raffleId?: string) {
    const now = new Date().toISOString();
    const conditions = [
        eq(raffleEntries.status, "reserved"),
        lt(raffleEntries.expiresAt, now),
    ];
    if (raffleId) conditions.push(eq(raffleEntries.raffleId, raffleId));
    await db
        .update(raffleEntries)
        .set({ status: "cancelled" })
        .where(and(...conditions));
}

/**
 * Devuelve el set de números NO disponibles para un raffle (status no cancelled).
 */
export async function getTakenNumbers(raffleId: string): Promise<Set<number>> {
    const rows = await db
        .select({ number: raffleEntries.number, status: raffleEntries.status })
        .from(raffleEntries)
        .where(and(
            eq(raffleEntries.raffleId, raffleId),
            ne(raffleEntries.status, "cancelled"),
        ));
    return new Set(rows.map(r => r.number));
}
