import { sql, type SQL } from "drizzle-orm";
import { products } from "@/lib/db/schema";
import { COMERCIAL_VECI_BADGE } from "@/lib/store-product-types";

/**
 * Oferta vigente en SQL: espejo de `isOfferActive` (lib/product-price.ts).
 * `offer_ends_at` se guarda como ISO en UTC, así que comparar strings sirve.
 */
export function activeOfferCondition(now: Date = new Date()): SQL {
    return sql`(${products.isOffer} = 1 AND ${products.offerPrice} IS NOT NULL AND ${products.offerPrice} > 0 AND (${products.offerEndsAt} IS NULL OR ${products.offerEndsAt} > ${now.toISOString()}) AND (${products.offerStock} IS NULL OR ${products.offerStock} > 0))`;
}

/**
 * Nuevo stock en oferta cuando se descuenta (o repone) el stock de una venta
 * web. Solo cuenta si la línea se vendió a precio oferta: una línea cobrada a
 * precio normal (oferta ya agotada, tramo de escala, precio de socio) no gastó
 * unidades de la oferta, y al cancelarla tampoco debe revivirla.
 */
export function offerStockAfterSale(line: { quantity: number; unitPrice: number | null }, action: "deduct" | "restore"): SQL {
    const delta = action === "deduct"
        ? sql`MAX(${products.offerStock} - ${line.quantity}, 0)`
        : sql`${products.offerStock} + ${line.quantity}`;
    return sql`CASE WHEN ${products.offerStock} IS NOT NULL AND ${products.offerPrice} = ${line.unitPrice ?? -1} THEN ${delta} ELSE ${products.offerStock} END`;
}

/**
 * Filtros rápidos de la tienda ("Ofertas" y "Comercial Veci").
 *
 * Los usan el listado de productos y el conteo de categorías, para que el
 * número al lado de cada sección sea el mismo que trae al elegirla.
 */
export function quickFilterConditions(params: { onlyOffer: boolean; onlyVeciSeal: boolean }): SQL[] {
    const conditions: SQL[] = [];
    if (params.onlyOffer) {
        conditions.push(activeOfferCondition());
    }
    // `badges` es un arreglo JSON guardado como texto; se busca la clave con
    // comillas para no calzar por error con otra que la contenga.
    if (params.onlyVeciSeal) {
        conditions.push(sql`instr(COALESCE(${products.badges}, ''), ${`"${COMERCIAL_VECI_BADGE}"`}) > 0`);
    }
    return conditions;
}
