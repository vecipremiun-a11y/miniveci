/**
 * Regla de precio de un producto. **Única fuente de verdad** del backend: la
 * usan el checkout web, el móvil y la preferencia de MercadoPago, que antes
 * repetían esta misma lógica cada uno por su lado.
 *
 * Vive en su propio módulo, sin tocar la base, para que se pueda testear sola.
 * Su espejo en el front es `getEffectivePrice` (components/cart/CartProvider):
 * si las dos se separan, el carrito muestra un total y el checkout cobra otro.
 */

/**
 * Grupo de escala: productos distintos que suman cantidad para la escala de
 * precios (ej. todas las tinturas "Ilicit tintura": 1 negro + 1 castaño +
 * 1 cobrizo = 3 unidades → cada una paga el tramo de 3).
 *
 * El nombre se compara sin mayúsculas, tildes ni espacios de más, para que
 * "Ilicit Tintura" e "ilicit  tintura" caigan en el mismo grupo.
 */
export function tierGroupKey(group?: string | null): string | null {
    const key = (group ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
    return key || null;
}

/**
 * Normaliza el fin de oferta que manda el admin a ISO en UTC ("...Z"), que es
 * como se compara en SQL (activeOfferCondition). Vacío o inválido = sin fin.
 */
export function normalizeOfferEndsAt(value?: string | null): string | null {
    if (!value) return null;
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/** Limpia el nombre de grupo que escribe el admin: sin espacios de más; vacío = sin grupo. */
export function cleanTierGroup(group?: string | null): string | null {
    const clean = (group ?? "").replace(/\s+/g, " ").trim();
    return clean ? clean.slice(0, 60) : null;
}

/**
 * Solo se agrupan productos que se venden por unidad. Los de kg/lt y los que
 * se venden por unidad equivalente de peso cuentan kilos, no piezas, y
 * mezclarlos con unidades daría tramos sin sentido.
 */
export function isTierGroupable(product: {
    unit?: string | null;
    equivLabel?: string | null;
    equivWeight?: number | null;
}): boolean {
    const unit = (product.unit ?? "").toLowerCase();
    if (unit === "kg" || unit === "lt") return false;
    if (product.equivLabel && product.equivWeight && product.equivWeight > 0) return false;
    return true;
}

export interface TierLine {
    quantity: number;
    tierGroup?: string | null;
    unit?: string | null;
    equivLabel?: string | null;
    equivWeight?: number | null;
}

/**
 * Cantidad con la que cada línea busca su tramo de escala: la suma de todas
 * las líneas de su mismo grupo, o su propia cantidad si no tiene grupo.
 * Devuelve un número por línea, en el mismo orden.
 *
 * La usan el carrito (front) y el recálculo del checkout (servidor), así las
 * dos llegan siempre al mismo tramo.
 */
export function tierQuantities(lines: TierLine[]): number[] {
    const keys = lines.map((line) => (isTierGroupable(line) ? tierGroupKey(line.tierGroup) : null));
    const totals = new Map<string, number>();
    lines.forEach((line, i) => {
        const key = keys[i];
        if (key) totals.set(key, (totals.get(key) ?? 0) + line.quantity);
    });
    return lines.map((line, i) => {
        const key = keys[i];
        return key ? totals.get(key)! : line.quantity;
    });
}

/**
 * Normaliza el stock en oferta: null/vacío = sin límite; negativo = 0.
 * Unidades enteras salvo kg/lt (3 decimales), igual que el stock web.
 */
export function normalizeOfferStock(value?: number | null, unit?: string | null): number | null {
    if (value === null || value === undefined || Number.isNaN(value)) return null;
    const v = Math.max(0, value);
    const u = (unit ?? "").toLowerCase();
    return u === "kg" || u === "lt" ? Math.round(v * 1000) / 1000 : Math.floor(v);
}

/**
 * ¿La oferta está vigente ahora?
 *
 * Además de `isOffer` y un `offerPrice`, la oferta puede tener dos límites
 * (los pone el admin o POSVECI):
 * - `offerEndsAt` (ISO en UTC): desde ese momento el producto se vende a precio
 *   normal aunque `isOffer` siga en true (POSVECI puede volver a mandarlo así).
 * - `offerStock`: unidades que quedan a precio oferta. En 0 la oferta se acaba.
 *   null = sin límite de stock.
 * Su espejo en SQL es `activeOfferCondition` (lib/store-filters.ts).
 */
export function isOfferActive(
    product: { isOffer?: boolean | null; offerPrice?: number | null; offerEndsAt?: string | null; offerStock?: number | null },
    now: number = Date.now(),
): boolean {
    if (!product.isOffer || !product.offerPrice) return false;
    if (product.offerStock !== null && product.offerStock !== undefined && product.offerStock <= 0) return false;
    if (!product.offerEndsAt) return true;
    const ends = Date.parse(product.offerEndsAt);
    return Number.isNaN(ends) || ends > now;
}

/**
 * POSVECI (versiones que no mandan los límites) empezó una oferta nueva (pasa a
 * true, o cambia el precio de oferta) o la apagó: los límites de la anterior
 * ya no corresponden.
 */
function posReplacedOffer(
    existing: { isOffer: boolean | null; offerPrice: number | null },
    incoming: { isOffer?: boolean; offerPrice?: number | null },
): boolean {
    if (incoming.isOffer === false && existing.isOffer) return true;
    if (incoming.isOffer === true && !existing.isOffer) return true;
    return incoming.offerPrice !== undefined && incoming.offerPrice !== existing.offerPrice;
}

/**
 * Qué hacer con el fin programado cuando POSVECI actualiza la oferta.
 *
 * Si POSVECI manda `offerEndsAt` (fecha o null), esa es la verdad: se guarda tal
 * cual. Si no lo manda (versiones viejas del POS), puede volver a mandar
 * `is_offer: true` con el mismo precio en cada sync: eso NO debe revivir una
 * oferta vencida. Pero si empieza una oferta nueva o la apaga, el fin
 * programado de la anterior se limpia.
 *
 * Devuelve la fecha (ISO UTC) o null para guardarla, o undefined para no tocarla.
 */
export function offerEndsAtAfterPosUpdate(
    existing: { isOffer: boolean | null; offerPrice: number | null },
    incoming: { isOffer?: boolean; offerPrice?: number | null; offerEndsAt?: string | null },
): string | null | undefined {
    if (incoming.offerEndsAt !== undefined) return normalizeOfferEndsAt(incoming.offerEndsAt);
    return posReplacedOffer(existing, incoming) ? null : undefined;
}

/**
 * Lo mismo para el stock en oferta: si POSVECI lo manda (número o null), manda
 * él; si no, una oferta repetida no revive una agotada, pero una oferta nueva o
 * apagada limpia el límite de la anterior.
 */
export function offerStockAfterPosUpdate(
    existing: { isOffer: boolean | null; offerPrice: number | null; unit?: string | null },
    incoming: { isOffer?: boolean; offerPrice?: number | null; offerStock?: number | null; unit?: string | null },
): number | null | undefined {
    if (incoming.offerStock !== undefined) return normalizeOfferStock(incoming.offerStock, incoming.unit ?? existing.unit);
    return posReplacedOffer(existing, incoming) ? null : undefined;
}

/**
 * Cuántas unidades se pueden pedir a precio oferta, o null si no hay tope
 * (sin oferta vigente o sin límite de stock). Con oferta por stock, el carrito
 * no deja pedir más de lo que queda en oferta: para llevar más hay que esperar
 * a que se acabe. Se mide en la unidad del producto (kg para los de peso).
 */
export function offerQuantityCap(
    product: { isOffer?: boolean | null; offerPrice?: number | null; offerEndsAt?: string | null; offerStock?: number | null },
    now: number = Date.now(),
): number | null {
    if (product.offerStock === null || product.offerStock === undefined) return null;
    return isOfferActive(product, now) ? product.offerStock : null;
}

/**
 * Oferta por stock: no se puede pedir más de lo que queda a precio oferta (ver
 * `offerQuantityCap`). El carrito ya pone ese tope; esto lo hace cumplir en el
 * checkout por si el carrito quedó viejo o el pedido viene de la app. Suma las
 * líneas del mismo producto. Devuelve el mensaje de error, o null si está bien.
 */
export function offerCapError(
    lines: { productId: string; quantity: number }[],
    productMap: Map<string, { name: string; unit?: string | null } & Parameters<typeof offerQuantityCap>[0]>,
    now: number = Date.now(),
): string | null {
    const totals = new Map<string, number>();
    for (const line of lines) totals.set(line.productId, (totals.get(line.productId) ?? 0) + line.quantity);
    for (const [productId, quantity] of totals) {
        const p = productMap.get(productId);
        if (!p) continue;
        const cap = offerQuantityCap(p, now);
        // Margen para los decimales de los productos por peso.
        if (cap !== null && quantity > cap + 1e-6) {
            const unit = (p.unit ?? "").toLowerCase();
            const amount = unit === "kg" || unit === "lt" ? `${cap} ${unit}` : `${cap} ${cap === 1 ? "unidad" : "unidades"}`;
            return `${p.name}: solo quedan ${amount} en oferta`;
        }
    }
    return null;
}

/**
 * Utilidad del precio suscriptor para todos los productos, en %. Cada producto
 * puede tener la suya (`subscriptionMargin`); null = usa esta.
 */
export const DEFAULT_SUBSCRIPTION_MARGIN = 5;

/** Costo + IVA, o null si no hay costo. */
export function costPlusTax(cost?: number | null, taxRate?: number | null): number | null {
    if (!cost || cost <= 0) return null;
    const tax = taxRate && taxRate > 0 ? taxRate : 0;
    return Math.round(cost * (1 + tax / 100));
}

/**
 * Precio suscriptor = (costo + IVA) × (1 + utilidad). Siempre se calcula, nunca
 * se escribe a mano: si cambia el costo (en el admin o desde POSVECI), el IVA o
 * la utilidad, cambia el precio. Su espejo en SQL es `subscriptionPriceSql`
 * (lib/subscription-price.ts). null si no hay costo para calcularlo.
 */
export function subscriptionPriceFor(
    cost?: number | null,
    taxRate?: number | null,
    margin?: number | null,
): number | null {
    const base = costPlusTax(cost, taxRate);
    if (base === null) return null;
    return Math.round(base * (1 + (margin ?? DEFAULT_SUBSCRIPTION_MARGIN) / 100));
}

/** Lo que hace falta de un producto para ponerle precio. */
export interface PriceableProduct {
    webPrice?: number | null;
    offerPrice?: number | null;
    isOffer?: boolean | null;
    offerEndsAt?: string | null;
    offerStock?: number | null;
    subscriptionPrice?: number | null;
    priceTiers?: unknown;
}

export interface PriceTier {
    minQty: number;
    maxQty: number | null;
    price: number;
}

/**
 * Escala limpia: tramos ordenados por "desde", cada uno "hasta" el siguiente
 * menos 1 y el último sin tope. Cada tramo es más barato que el anterior.
 *
 * Arregla las escalas mal cargadas (en POSVECI o en el admin) para que llevar
 * más nunca salga más caro:
 * - Un hueco ("3–9" y después "19–29") dejaba de 10 a 18 sin tramo, a precio
 *   normal. Ahora el tramo de abajo sigue hasta donde empieza el siguiente.
 * - Un último tramo cerrado ("3–11") mandaba las 12 a precio normal. Ahora el
 *   último no tiene tope.
 * - Un tramo sin precio ($0) regalaba el producto: se descarta.
 * - Un tramo que no es más barato que uno anterior no sirve: se descarta. Si
 *   dos empiezan en la misma cantidad, queda el más barato.
 *
 * Las cantidades son enteras (unidades). Se usa para cobrar (`findPriceTier`),
 * al guardar (admin y POSVECI) y en lo que mandan las APIs de la tienda.
 */
export function normalizePriceTiers(tiers: unknown): PriceTier[] {
    if (!Array.isArray(tiers)) return [];
    const valid = tiers
        .map((t) => ({ minQty: Number(t?.minQty), price: Number(t?.price) }))
        .filter((t) => Number.isFinite(t.minQty) && t.minQty > 0 && Number.isFinite(t.price) && t.price > 0)
        .sort((a, b) => a.minQty - b.minQty || a.price - b.price);

    const kept: { minQty: number; price: number }[] = [];
    for (const tier of valid) {
        const prev = kept[kept.length - 1];
        if (prev && (tier.minQty === prev.minQty || tier.price >= prev.price)) continue;
        kept.push(tier);
    }
    return kept.map((tier, i) => ({
        minQty: tier.minQty,
        maxQty: i < kept.length - 1 ? kept[i + 1].minQty - 1 : null,
        price: tier.price,
    }));
}

/** Tramo que le toca a una cantidad: el más alto que alcanza, o null (precio normal). */
export function findPriceTier(tiers: unknown, quantity: number): PriceTier | null {
    let match: PriceTier | null = null;
    for (const tier of normalizePriceTiers(tiers)) {
        if (quantity >= tier.minQty) match = tier;
    }
    return match;
}

/**
 * Dónde va el cliente en la escala, para la tarjeta y la ficha. Recibe la
 * escala ya normalizada.
 *
 * - `current`: tramo de lo que YA hay en el carrito (-1 = ninguno). Es el que
 *   se marca: no se adelanta a lo que todavía no agrega.
 * - `afterAdd`: tramo al agregar `adding` más (-1 = ninguno). Es el precio que
 *   se muestra en el botón.
 * - `next`: el tramo siguiente al del carrito, y `missing`: cuánto le falta.
 */
export function tierProgress(tiers: PriceTier[], inCart: number, adding: number) {
    const indexFor = (quantity: number) => tiers.reduce((found, tier, i) => (quantity >= tier.minQty ? i : found), -1);
    const current = inCart > 0 ? indexFor(inCart) : -1;
    const next = tiers[current + 1] ?? null;
    return {
        current,
        afterAdd: indexFor(inCart + adding),
        next,
        missing: next ? Math.round((next.minQty - inCart) * 100) / 100 : 0,
    };
}

/**
 * Precio unitario efectivo de un producto.
 *
 * `quantity` es la cantidad con la que se busca el tramo de escala. Si el
 * producto tiene grupo de escala, pasar la cantidad del grupo entero
 * (`tierQuantities`), no la de la línea.
 *
 * Orden normal: tramo por cantidad > oferta > precio base.
 *
 * Si el cliente es suscriptor y el producto tiene `subscriptionPrice`, paga el
 * **menor** entre ese precio y el que le tocaría igual. Así el suscriptor nunca
 * paga más que un cliente normal, y tampoco pierde una oferta o un precio por
 * volumen que sea todavía más barato que su precio de socio.
 *
 * Un `subscriptionPrice` en 0 o nulo se trata como "no configurado": el producto
 * simplemente no tiene precio de suscriptor y se cobra el normal.
 *
 * `isSubscriber` lo resuelve el handler contra la base (`hasActiveSubscription`),
 * NUNCA sale del body del request.
 */
export function resolveUnitPrice(
    product: PriceableProduct,
    quantity: number,
    isSubscriber = false,
): number {
    const basePrice = product.webPrice ?? 0;
    const matchedTier = findPriceTier(product.priceTiers, quantity);
    const offerPrice = isOfferActive(product) ? product.offerPrice! : null;
    const regularPrice = matchedTier ? matchedTier.price : (offerPrice ?? basePrice);

    if (!isSubscriber) return regularPrice;

    const subscriberPrice = product.subscriptionPrice ?? 0;
    if (subscriberPrice <= 0) return regularPrice;

    return Math.min(regularPrice, subscriberPrice);
}
