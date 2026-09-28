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

/** Lo que hace falta de un producto para ponerle precio. */
export interface PriceableProduct {
    webPrice?: number | null;
    offerPrice?: number | null;
    isOffer?: boolean | null;
    subscriptionPrice?: number | null;
    priceTiers?: unknown;
}

interface PriceTier {
    minQty: number;
    maxQty: number | null;
    price: number;
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
    const tiers = (product.priceTiers as PriceTier[] | null) ?? [];
    const matchedTier = tiers.find((t) => quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty));
    const offerPrice = product.isOffer && product.offerPrice ? product.offerPrice : null;
    const regularPrice = matchedTier ? matchedTier.price : (offerPrice ?? basePrice);

    if (!isSubscriber) return regularPrice;

    const subscriberPrice = product.subscriptionPrice ?? 0;
    if (subscriberPrice <= 0) return regularPrice;

    return Math.min(regularPrice, subscriberPrice);
}
