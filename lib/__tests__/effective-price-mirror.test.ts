/**
 * El front (getEffectivePrice, en components/cart/CartProvider) y el servidor
 * (resolveUnitPrice, en lib/product-price) tienen que dar SIEMPRE el mismo
 * precio. Si se separan, el carrito muestra un total y el checkout cobra otro.
 *
 * Este test replica la función del front y la contrasta con la del servidor
 * sobre una grilla de casos. Se copia en vez de importarse porque el módulo del
 * front es un componente 'use client' con React adentro.
 */
import { describe, it, expect } from "vitest";
import { resolveUnitPrice, type PriceableProduct } from "../product-price";

interface PriceTier { minQty: number; maxQty: number | null; price: number }

// --- Copia exacta de components/cart/CartProvider.tsx ---
function getTieredPrice(basePrice: number, priceTiers: PriceTier[] | undefined, quantity: number): number {
    if (!priceTiers || priceTiers.length === 0) return basePrice;
    const tier = priceTiers.find(t => quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty));
    return tier ? tier.price : basePrice;
}

function getEffectivePrice(
    basePrice: number,
    priceTiers: PriceTier[] | undefined,
    quantity: number,
    subscriptionPrice?: number | null,
): number {
    const tiered = getTieredPrice(basePrice, priceTiers, quantity);
    if (!subscriptionPrice || subscriptionPrice <= 0) return tiered;
    return Math.min(tiered, subscriptionPrice);
}
// --- fin de la copia ---

const TIERS: (PriceTier[] | undefined)[] = [
    undefined,
    [{ minQty: 3, maxQty: 5, price: 700 }],
    [{ minQty: 10, maxQty: null, price: 450 }],
];
const SUBS = [null, 0, 450, 600, 1500];
const OFFERS: { isOffer: boolean; offerPrice: number | null }[] = [
    { isOffer: false, offerPrice: null },
    { isOffer: true, offerPrice: 800 },
    { isOffer: true, offerPrice: 400 },
];
const QTYS = [1, 3, 5, 9, 10, 20];

describe("el front y el servidor cobran lo mismo", () => {
    it("coinciden en toda la grilla de ofertas, tramos, cantidades y membresía", () => {
        const mismatches: string[] = [];

        for (const tiers of TIERS) {
            for (const sub of SUBS) {
                for (const offer of OFFERS) {
                    for (const qty of QTYS) {
                        for (const isSubscriber of [false, true]) {
                            const product: PriceableProduct = {
                                webPrice: 1000,
                                isOffer: offer.isOffer,
                                offerPrice: offer.offerPrice,
                                subscriptionPrice: sub,
                                priceTiers: tiers ?? null,
                            };

                            const server = resolveUnitPrice(product, qty, isSubscriber);

                            // El front arranca del precio que ya muestra la ficha
                            // (oferta aplicada) y solo recibe subscriptionPrice si
                            // quien mira es suscriptor.
                            const rawPrice = offer.isOffer && offer.offerPrice ? offer.offerPrice : 1000;
                            const client = getEffectivePrice(
                                rawPrice,
                                tiers,
                                qty,
                                isSubscriber ? sub : null,
                            );

                            if (server !== client) {
                                mismatches.push(
                                    `tiers=${JSON.stringify(tiers)} sub=${sub} offer=${JSON.stringify(offer)} ` +
                                    `qty=${qty} suscriptor=${isSubscriber} → servidor ${server} vs front ${client}`,
                                );
                            }
                        }
                    }
                }
            }
        }

        expect(mismatches).toEqual([]);
    });
});
