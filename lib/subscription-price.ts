/**
 * Precio suscriptor calculado en la base, para que se mantenga al día venga de
 * donde venga el cambio de costo: el admin, el sync de POSVECI o el webhook.
 * Espejo SQL de `subscriptionPriceFor` (lib/product-price.ts).
 */

import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq, sql, type SQL } from "drizzle-orm";
import { DEFAULT_SUBSCRIPTION_MARGIN } from "@/lib/product-price";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbLike = typeof db | Tx;

/**
 * (costo + IVA) × (1 + utilidad), con los dos redondeos de `subscriptionPriceFor`.
 * Sin costo deja el precio que había: no hay con qué calcularlo.
 */
export function subscriptionPriceSql(): SQL {
    const tax = sql`CASE WHEN ${products.taxRate} > 0 THEN ${products.taxRate} ELSE 0 END`;
    const margin = sql`COALESCE(${products.subscriptionMargin}, ${DEFAULT_SUBSCRIPTION_MARGIN})`;
    return sql`CASE WHEN ${products.costPrice} > 0
        THEN CAST(ROUND(ROUND(${products.costPrice} * (1 + ${tax} / 100.0)) * (1 + ${margin} / 100.0)) AS INTEGER)
        ELSE ${products.subscriptionPrice} END`;
}

/** Recalcula el precio suscriptor de un producto después de guardarlo. */
export async function recomputeSubscriptionPrice(conn: DbLike, productId: string): Promise<void> {
    await conn.update(products)
        .set({ subscriptionPrice: subscriptionPriceSql() })
        .where(eq(products.id, productId));
}
