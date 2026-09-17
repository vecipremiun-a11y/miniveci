/**
 * Regla de precio de un producto. **Única fuente de verdad** del backend: la
 * usan el checkout web, el móvil y la preferencia de MercadoPago, que antes
 * repetían esta misma lógica cada uno por su lado.
 *
 * Vive en su propio módulo, sin tocar la base, para que se pueda testear sola.
 * Su espejo en el front es `getEffectivePrice` (components/cart/CartProvider):
 * si las dos se separan, el carrito muestra un total y el checkout cobra otro.
 */

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
