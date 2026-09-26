import { eq, sql, type SQL } from "drizzle-orm";
import { products } from "@/lib/db/schema";
import { COMERCIAL_VECI_BADGE } from "@/lib/store-product-types";

/**
 * Filtros rápidos de la tienda ("Ofertas" y "Comercial Veci").
 *
 * Los usan el listado de productos y el conteo de categorías, para que el
 * número al lado de cada sección sea el mismo que trae al elegirla.
 */
export function quickFilterConditions(params: { onlyOffer: boolean; onlyVeciSeal: boolean }): SQL[] {
    const conditions: SQL[] = [];
    if (params.onlyOffer) {
        conditions.push(eq(products.isOffer, true));
    }
    // `badges` es un arreglo JSON guardado como texto; se busca la clave con
    // comillas para no calzar por error con otra que la contenga.
    if (params.onlyVeciSeal) {
        conditions.push(sql`instr(COALESCE(${products.badges}, ''), ${`"${COMERCIAL_VECI_BADGE}"`}) > 0`);
    }
    return conditions;
}
