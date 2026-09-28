import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { isNotNull, sql } from "drizzle-orm";

/**
 * Grupos de escala en uso, con cuántos productos tiene cada uno. Alimenta el
 * autocompletado del campo "Grupo de escala" en la ficha del producto.
 */
export async function loadTierGroups(): Promise<{ name: string; count: number }[]> {
    const rows = await db
        .select({ name: products.tierGroup, count: sql<number>`count(*)`.mapWith(Number) })
        .from(products)
        .where(isNotNull(products.tierGroup))
        .groupBy(products.tierGroup)
        .orderBy(products.tierGroup);
    return rows.filter((r): r is { name: string; count: number } => Boolean(r.name));
}
