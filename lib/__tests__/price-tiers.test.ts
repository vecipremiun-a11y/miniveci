import { describe, it, expect } from "vitest";
import { findPriceTier, normalizePriceTiers, resolveUnitPrice, tierProgress, tierQuantities } from "../product-price";

// Escalas tal como estaban en producción (22-oct-2026).
const masDetergente = [
    { minQty: 3, maxQty: 9, price: 2750 },
    { minQty: 10, maxQty: 29, price: 2600 },
    { minQty: 30, maxQty: null, price: 2500 },
];
// El Delicado vino de POSVECI con "desde 19" en el tramo 2: de 10 a 18 no tenía tramo.
const masDelicado = [
    { minQty: 3, maxQty: 9, price: 2750 },
    { minQty: 19, maxQty: 29, price: 2600 },
    { minQty: 30, maxQty: null, price: 2500 },
];

describe("normalizePriceTiers", () => {
    it("deja igual una escala bien cargada", () => {
        expect(normalizePriceTiers(masDetergente)).toEqual(masDetergente);
    });

    it("tapa los huecos: el tramo de abajo sigue hasta donde empieza el siguiente", () => {
        expect(normalizePriceTiers(masDelicado)).toEqual([
            { minQty: 3, maxQty: 18, price: 2750 },
            { minQty: 19, maxQty: 29, price: 2600 },
            { minQty: 30, maxQty: null, price: 2500 },
        ]);
    });

    it("el último tramo no tiene tope (\"3–11\" y \"12–999\" son \"desde\")", () => {
        expect(normalizePriceTiers([{ minQty: 3, maxQty: 11, price: 167 }])).toEqual([
            { minQty: 3, maxQty: null, price: 167 },
        ]);
        expect(normalizePriceTiers([
            { minQty: 3, maxQty: 5, price: 1700 },
            { minQty: 12, maxQty: 999, price: 1550 },
        ])).toEqual([
            { minQty: 3, maxQty: 11, price: 1700 },
            { minQty: 12, maxQty: null, price: 1550 },
        ]);
    });

    it("descarta los tramos sin precio (regalaban el producto)", () => {
        expect(normalizePriceTiers([
            { minQty: 1, maxQty: null, price: 0 },
            { minQty: 1, maxQty: null, price: 0 },
        ])).toEqual([]);
        expect(normalizePriceTiers([
            { minQty: 3, maxQty: 8, price: 780 },
            { minQty: 9, maxQty: null, price: 750 },
            { minQty: 1, maxQty: null, price: 0 },
        ])).toEqual([
            { minQty: 3, maxQty: 8, price: 780 },
            { minQty: 9, maxQty: null, price: 750 },
        ]);
    });

    it("ordena, y en un solape gana el tramo que empieza después", () => {
        expect(normalizePriceTiers([
            { minQty: 9, maxQty: null, price: 1550 },
            { minQty: 3, maxQty: 11, price: 1620 },
        ])).toEqual([
            { minQty: 3, maxQty: 8, price: 1620 },
            { minQty: 9, maxQty: null, price: 1550 },
        ]);
    });

    it("un tramo que no es más barato que uno anterior no se usa", () => {
        expect(normalizePriceTiers([
            { minQty: 3, maxQty: 8, price: 1980 },
            { minQty: 9, maxQty: null, price: 1990 },
        ])).toEqual([{ minQty: 3, maxQty: null, price: 1980 }]);
    });

    it("si dos empiezan en la misma cantidad queda el más barato", () => {
        expect(normalizePriceTiers([
            { minQty: 3, maxQty: 5, price: 900 },
            { minQty: 3, maxQty: null, price: 850 },
        ])).toEqual([{ minQty: 3, maxQty: null, price: 850 }]);
    });

    it("lo que no es una escala queda vacío", () => {
        expect(normalizePriceTiers(null)).toEqual([]);
        expect(normalizePriceTiers(undefined)).toEqual([]);
        expect(normalizePriceTiers("[]")).toEqual([]);
        expect(normalizePriceTiers([null, { minQty: "x", price: 10 }])).toEqual([]);
    });
});

describe("findPriceTier / resolveUnitPrice", () => {
    it("llevar más nunca sale más caro, aunque la escala tenga hueco", () => {
        const delicado = { webPrice: 2900, priceTiers: masDelicado };
        let previous = Infinity;
        for (let qty = 1; qty <= 40; qty++) {
            const price = resolveUnitPrice(delicado, qty);
            expect(price).toBeLessThanOrEqual(previous);
            previous = price;
        }
        expect(resolveUnitPrice(delicado, 10)).toBe(2750);
        expect(resolveUnitPrice(delicado, 19)).toBe(2600);
    });

    it("con un último tramo cerrado, 12 unidades no vuelven al precio normal", () => {
        const aji = { webPrice: 190, priceTiers: [{ minQty: 3, maxQty: 11, price: 167 }] };
        expect(resolveUnitPrice(aji, 11)).toBe(167);
        expect(resolveUnitPrice(aji, 12)).toBe(167);
    });

    it("un tramo en $0 no regala el producto", () => {
        const pilot = { webPrice: 1400, priceTiers: [{ minQty: 1, maxQty: null, price: 0 }] };
        expect(resolveUnitPrice(pilot, 1)).toBe(1400);
    });

    it("bajo el primer tramo no hay tramo", () => {
        expect(findPriceTier(masDetergente, 2)).toBeNull();
        expect(findPriceTier(masDetergente, 3)?.price).toBe(2750);
    });

    it("el grupo \"Mas con 5lt\": 3 + 2 + 1 + 2 + 2 = 10, todos a $2.600", () => {
        const lines = [3, 2, 1, 2, 2].map((quantity) => ({ quantity, tierGroup: "Mas con 5lt" }));
        const qty = tierQuantities(lines);
        expect(qty).toEqual([10, 10, 10, 10, 10]);
        expect(resolveUnitPrice({ webPrice: 2900, priceTiers: masDetergente }, qty[0])).toBe(2600);
    });
});

describe("tierProgress", () => {
    const tiers = normalizePriceTiers(masDetergente);

    it("con 9 en el carrito marca 3–9, aunque al agregar 1 más se llegue a 10–29", () => {
        expect(tierProgress(tiers, 9, 1)).toEqual({ current: 0, afterAdd: 1, next: tiers[1], missing: 1 });
    });

    it("con 10 en el carrito marca 10–29 y faltan 20 para el siguiente", () => {
        expect(tierProgress(tiers, 10, 1)).toEqual({ current: 1, afterAdd: 1, next: tiers[2], missing: 20 });
    });

    it("sin nada en el carrito no marca ningún tramo", () => {
        expect(tierProgress(tiers, 0, 1)).toEqual({ current: -1, afterAdd: -1, next: tiers[0], missing: 3 });
        expect(tierProgress(tiers, 0, 3).afterAdd).toBe(0);
    });

    it("en el último tramo no hay siguiente", () => {
        expect(tierProgress(tiers, 30, 1)).toEqual({ current: 2, afterAdd: 2, next: null, missing: 0 });
    });
});
