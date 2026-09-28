import { db } from "@/lib/db";
import { products, raffles } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { isRaffleItemId } from "@/lib/raffle-checkout";
import { loadStoreDeliveryConfig, resolveShippingCost } from "@/lib/store-config";
import { resolveUnitPrice, tierQuantities } from "@/lib/product-price";

// La regla de precio vive en lib/product-price.ts (sin dependencias de base,
// para poder testearla sola). Se re-exporta acá para no romper los imports.
export { resolveUnitPrice, type PriceableProduct } from "@/lib/product-price";

// ============================================================
// Recálculo de precios server-side para el checkout WEB.
//
// REGLA DE ORO: nunca confiar en price / subtotal / discount / total
// que envía el navegador. Todo se recalcula contra la base de datos,
// replicando la misma lógica visible en app/checkout/page.tsx.
//
// El flujo MÓVIL (app/api/store/orders/route.ts → handleMobileOrder) ya
// hace su propio recálculo; este módulo cubre los flujos web (preferencia
// MercadoPago y orden web legacy).
// ============================================================

// El costo de envío y el monto para envío gratis viven en `store_config`
// (tabla, editable desde el admin). Ver lib/store-config.ts.

/** Umbral para el descuento automático por monto. */
const AUTO_DISCOUNT_THRESHOLD = 50000;
const AUTO_DISCOUNT_RATE = 0.05;

/**
 * Tope de unidades por línea. Antes solo había piso (`Math.max(1, ...)`), así que
 * se podía mandar `quantity: 999999999` y generar totales absurdos que además
 * viajaban al POS.
 */
export const MAX_ITEM_QUANTITY = 500;

/** Cupones válidos → porcentaje de descuento sobre el subtotal. */
const COUPONS: Record<string, number> = {
    VECI10: 0.1,
    VECI5: 0.05,
};

const RAFFLE_ID_PATTERN = /^raffle:([^:]+):(\d+)$/;

export interface RawCartItem {
    id?: string | null;
    name?: string;
    sku?: string | null;
    price?: number;
    quantity?: number;
}

export interface PricedCartItem {
    id: string | null;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    isRaffle: boolean;
}

export interface StorePricing {
    ok: boolean;
    error?: string;
    items: PricedCartItem[];
    subtotal: number;
    shippingCost: number;
    discount: number;
    total: number;
    appliedCoupon: string | null;
}

function fail(error: string): StorePricing {
    return { ok: false, error, items: [], subtotal: 0, shippingCost: 0, discount: 0, total: 0, appliedCoupon: null };
}

/**
 * Recalcula precios, subtotal, envío, descuento y total server-side.
 * @param cartItems items tal cual los manda el cliente (solo se usan id/quantity/name; el precio se ignora)
 * @param opts deliveryType y couponCode opcionales para envío/cupón; `isSubscriber`
 *   habilita el precio de suscriptor. Ojo: ese flag lo resuelve el handler contra
 *   la base (`hasActiveSubscription`), NUNCA sale del body del request.
 */
export async function recalcStorePricing(
    cartItems: RawCartItem[],
    opts: { deliveryType?: string | null; couponCode?: string | null; isSubscriber?: boolean } = {},
): Promise<StorePricing> {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
        return fail("El carrito está vacío");
    }

    // Separar IDs de producto vs sorteo para cargarlos en lote
    const productIds: string[] = [];
    const raffleIds = new Set<string>();
    for (const it of cartItems) {
        const id = it?.id ? String(it.id) : null;
        if (!id) return fail("Hay un ítem sin identificador en el carrito");
        if (isRaffleItemId(id)) {
            const m = id.match(RAFFLE_ID_PATTERN);
            if (m) raffleIds.add(m[1]);
        } else {
            productIds.push(id);
        }
    }

    const productRows = productIds.length
        ? await db.select().from(products).where(inArray(products.id, productIds))
        : [];
    const productMap = new Map(productRows.map((p) => [p.id, p]));

    const raffleRows = raffleIds.size
        ? await db.select().from(raffles).where(inArray(raffles.id, Array.from(raffleIds)))
        : [];
    const raffleMap = new Map(raffleRows.map((r) => [r.id, r]));

    // Cantidad con la que cada línea busca su tramo de escala: los productos
    // del mismo grupo de escala suman entre ellos (ver tierQuantities).
    const tierQty = tierQuantities(cartItems.map((it) => {
        const p = isRaffleItemId(String(it?.id)) ? undefined : productMap.get(String(it?.id));
        return {
            quantity: Math.max(1, Math.round(Number(it?.quantity) || 0)),
            tierGroup: p?.tierGroup ?? null,
            unit: p?.unit ?? null,
            equivLabel: p?.equivLabel ?? null,
            equivWeight: p?.equivWeight ?? null,
        };
    }));

    const items: PricedCartItem[] = [];

    for (const [index, it] of cartItems.entries()) {
        const id = String(it!.id);
        const requestedQty = Math.round(Number(it?.quantity) || 0);
        if (requestedQty > MAX_ITEM_QUANTITY) {
            return fail(`Cantidad máxima por producto: ${MAX_ITEM_QUANTITY} unidades`);
        }
        const quantity = Math.max(1, requestedQty);

        if (isRaffleItemId(id)) {
            const m = id.match(RAFFLE_ID_PATTERN);
            const raffle = m ? raffleMap.get(m[1]) : undefined;
            if (!raffle) return fail("Sorteo no disponible");
            const unitPrice = raffle.price ?? 0;
            items.push({
                id,
                name: it?.name || raffle.name,
                sku: it?.sku ? String(it.sku) : id,
                quantity,
                unitPrice,
                totalPrice: unitPrice * quantity,
                isRaffle: true,
            });
            continue;
        }

        const p = productMap.get(id);
        if (!p) return fail("Producto no disponible");
        if (!p.isPublished) return fail(`Producto no disponible: ${p.name}`);

        const unitPrice = resolveUnitPrice(p, tierQty[index], opts.isSubscriber ?? false);

        items.push({
            id: p.id,
            name: p.name,
            sku: p.sku ?? p.id,
            quantity,
            unitPrice,
            totalPrice: unitPrice * quantity,
            isRaffle: false,
        });
    }

    const subtotal = items.reduce((s, it) => s + it.totalPrice, 0);

    // Descuento automático por monto + cupón (validado server-side)
    const baseDiscount = subtotal > AUTO_DISCOUNT_THRESHOLD ? Math.round(subtotal * AUTO_DISCOUNT_RATE) : 0;
    const normalizedCoupon = (opts.couponCode || "").trim().toUpperCase();
    const couponRate = COUPONS[normalizedCoupon] ?? 0;
    const appliedCoupon = couponRate > 0 ? normalizedCoupon : null;
    const couponDiscount = couponRate > 0 ? Math.round(subtotal * couponRate) : 0;
    const discount = baseDiscount + couponDiscount;

    // El envío se resuelve al final: el envío gratis se mide contra lo que
    // realmente paga en productos, o sea el subtotal ya con descuentos.
    const deliveryConfig = await loadStoreDeliveryConfig();
    const payableSubtotal = Math.max(0, subtotal - discount);
    const shippingCost = resolveShippingCost({
        deliveryType: opts.deliveryType,
        payableSubtotal,
        config: deliveryConfig,
    });

    const total = Math.max(0, payableSubtotal + shippingCost);

    return { ok: true, items, subtotal, shippingCost, discount, total, appliedCoupon };
}
