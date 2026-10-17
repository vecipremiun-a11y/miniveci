/**
 * Precio de los renglones de producto de un pedido. Lo usan el checkout web
 * (lib/store-pricing.ts) y el de la app (POST /api/store/orders con Bearer), que
 * antes repetían esta lógica cada uno por su lado.
 *
 * - Por unidad: escala por cantidad (sumando el grupo de escala), oferta con su
 *   tope de stock en oferta y precio de socio. Igual que siempre.
 * - Por presentación (Caja, Bandeja…): precio fijo de la presentación. No suma
 *   a la escala ni al grupo, no gasta la oferta y no tiene precio de socio. La
 *   cantidad del renglón queda en unidades (cajas × units).
 * - Stock: en los productos que llevan cajas, el total en unidades de todos sus
 *   renglones (sueltas + cajas × units) tiene que caber en el stock.
 *
 * Sin base ni React: se testea sola (lib/__tests__/order-lines.test.ts). Quien
 * llama ya comprobó que cada producto existe y está publicado.
 */

import { offerCapError, resolveUnitPrice, tierQuantities, type PriceableProduct } from "./product-price";
import {
    presentationStockError,
    resolvePresentationLine,
    type OrderLinePresentation,
    type PresentationRecord,
} from "./product-presentations";
import { resolveProductStock, type ProductInput } from "./services/product-resolver";

export type LineProduct = PriceableProduct & ProductInput & {
    id: string;
    name: string;
    unit?: string | null;
    equivLabel?: string | null;
    equivWeight?: number | null;
    tierGroup?: string | null;
};

export interface ProductLineInput {
    productId: string;
    /** Unidades; si trae `presentationId`, cuántas presentaciones (cajas). */
    quantity: number;
    /** Cantidad contra el tope de oferta, si no es `quantity` (el web la mide sin redondear). */
    offerCapQuantity?: number;
    presentationId?: string | null;
}

export interface PricedProductLine {
    productId: string;
    /** Siempre en unidades. */
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    presentation: OrderLinePresentation | null;
}

export type PricedProductLines =
    | { ok: true; lines: PricedProductLine[] }
    | { ok: false; error: string };

export function priceProductLines(
    lines: ProductLineInput[],
    productMap: Map<string, LineProduct>,
    presentationMap: Map<string, PresentationRecord>,
    opts: { isSubscriber?: boolean } = {},
): PricedProductLines {
    // Tramo de escala de cada renglón por unidad: los del mismo grupo suman.
    // Las cajas tienen precio fijo: no suman ni buscan tramo.
    const tierQty = tierQuantities(lines.map((line) => {
        if (line.presentationId) return { quantity: 0, tierGroup: null };
        const p = productMap.get(line.productId);
        return {
            quantity: line.quantity,
            tierGroup: p?.tierGroup ?? null,
            unit: p?.unit ?? null,
            equivLabel: p?.equivLabel ?? null,
            equivWeight: p?.equivWeight ?? null,
        };
    }));

    // Oferta por stock: no más de lo que queda en oferta. Solo los renglones
    // por unidad; la caja no se cobra a precio oferta.
    const capError = offerCapError(
        lines
            .filter((line) => !line.presentationId)
            .map((line) => ({ productId: line.productId, quantity: line.offerCapQuantity ?? line.quantity })),
        productMap,
    );
    if (capError) return { ok: false, error: capError };

    const priced: PricedProductLine[] = [];
    for (const [index, line] of lines.entries()) {
        const p = productMap.get(line.productId);
        if (!p) return { ok: false, error: "Producto no disponible" };

        if (line.presentationId) {
            const result = resolvePresentationLine(p, presentationMap.get(line.presentationId), line.quantity);
            if (!result.ok) return { ok: false, error: result.error };
            priced.push({
                productId: p.id,
                quantity: result.quantity,
                unitPrice: result.unitPrice,
                totalPrice: result.totalPrice,
                presentation: result.presentation,
            });
            continue;
        }

        const unitPrice = resolveUnitPrice(p, tierQty[index], opts.isSubscriber ?? false);
        priced.push({
            productId: p.id,
            quantity: line.quantity,
            unitPrice,
            totalPrice: unitPrice * line.quantity,
            presentation: null,
        });
    }

    const stockError = presentationStockError(
        priced.map((line) => ({ productId: line.productId, units: line.quantity, byPresentation: line.presentation !== null })),
        new Map([...productMap.values()].map((p) => [p.id, { name: p.name, stock: resolveProductStock(p).stock }])),
    );
    if (stockError) return { ok: false, error: stockError };

    return { ok: true, lines: priced };
}
