import { describe, it, expect } from "vitest";
import { resolveUnitPrice, type PriceableProduct } from "../product-price";

const base = (o: Partial<PriceableProduct> = {}): PriceableProduct => ({
    webPrice: 1000,
    offerPrice: null,
    isOffer: false,
    subscriptionPrice: null,
    priceTiers: null,
    ...o,
});

describe("resolveUnitPrice", () => {
    describe("cliente normal", () => {
        it("cobra el precio base", () => {
            expect(resolveUnitPrice(base(), 1)).toBe(1000);
        });

        it("la oferta le gana al base", () => {
            expect(resolveUnitPrice(base({ isOffer: true, offerPrice: 800 }), 1)).toBe(800);
        });

        it("isOffer en false ignora el offerPrice", () => {
            expect(resolveUnitPrice(base({ isOffer: false, offerPrice: 800 }), 1)).toBe(1000);
        });

        it("el tramo por cantidad le gana a la oferta", () => {
            const p = base({
                isOffer: true,
                offerPrice: 800,
                priceTiers: [{ minQty: 3, maxQty: null, price: 700 }],
            });
            expect(resolveUnitPrice(p, 3)).toBe(700);
            expect(resolveUnitPrice(p, 2)).toBe(800); // no alcanza el tramo
        });

        it("nunca ve el precio de suscriptor", () => {
            expect(resolveUnitPrice(base({ subscriptionPrice: 600 }), 1)).toBe(1000);
        });
    });

    describe("suscriptor", () => {
        it("paga su precio de socio", () => {
            expect(resolveUnitPrice(base({ subscriptionPrice: 600 }), 1, true)).toBe(600);
        });

        it("si la oferta es más barata que el precio de socio, gana la oferta", () => {
            const p = base({ isOffer: true, offerPrice: 500, subscriptionPrice: 600 });
            expect(resolveUnitPrice(p, 1, true)).toBe(500);
        });

        it("si el precio de socio es más barato que la oferta, gana el de socio", () => {
            const p = base({ isOffer: true, offerPrice: 800, subscriptionPrice: 600 });
            expect(resolveUnitPrice(p, 1, true)).toBe(600);
        });

        it("si el tramo por volumen es más barato, gana el tramo", () => {
            const p = base({
                subscriptionPrice: 600,
                priceTiers: [{ minQty: 10, maxQty: null, price: 450 }],
            });
            expect(resolveUnitPrice(p, 10, true)).toBe(450);
            expect(resolveUnitPrice(p, 9, true)).toBe(600);
        });

        it("nunca paga más que un cliente normal", () => {
            // Precio de socio mal cargado, más caro que el de lista.
            const p = base({ webPrice: 1000, subscriptionPrice: 1500 });
            expect(resolveUnitPrice(p, 1, true)).toBe(1000);
        });

        it("sin precio de socio configurado paga lo mismo que cualquiera", () => {
            expect(resolveUnitPrice(base({ subscriptionPrice: null }), 1, true)).toBe(1000);
            expect(resolveUnitPrice(base({ subscriptionPrice: 0 }), 1, true)).toBe(1000);
        });
    });

    it("un producto sin precio vale 0 y no rompe", () => {
        expect(resolveUnitPrice(base({ webPrice: null }), 1)).toBe(0);
        expect(resolveUnitPrice(base({ webPrice: null }), 1, true)).toBe(0);
    });
});
