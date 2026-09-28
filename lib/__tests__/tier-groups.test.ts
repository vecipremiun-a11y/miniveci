import { describe, it, expect } from "vitest";
import { cleanTierGroup, resolveUnitPrice, tierGroupKey, tierQuantities } from "../product-price";

// Tintura Ilicit: $2.700 c/u, $2.500 desde 3.
const ilicitTiers = [
    { minQty: 1, maxQty: 2, price: 2700 },
    { minQty: 3, maxQty: null, price: 2500 },
];
const ilicit = { webPrice: 2700, priceTiers: ilicitTiers };

describe("tierGroupKey", () => {
    it("ignora mayúsculas, tildes y espacios de más", () => {
        expect(tierGroupKey("Ilicit Tintura")).toBe("ilicit tintura");
        expect(tierGroupKey("  ilicit   TINTURA ")).toBe("ilicit tintura");
        expect(tierGroupKey("Tintúra")).toBe(tierGroupKey("tintura"));
    });

    it("vacío o nulo es sin grupo", () => {
        expect(tierGroupKey("")).toBeNull();
        expect(tierGroupKey("   ")).toBeNull();
        expect(tierGroupKey(null)).toBeNull();
    });
});

describe("cleanTierGroup", () => {
    it("recorta espacios y deja null si queda vacío", () => {
        expect(cleanTierGroup("  Ilicit   tintura ")).toBe("Ilicit tintura");
        expect(cleanTierGroup("")).toBeNull();
        expect(cleanTierGroup(undefined)).toBeNull();
    });
});

describe("tierQuantities", () => {
    it("3 tinturas distintas del mismo grupo cuentan 3 cada una", () => {
        const qty = tierQuantities([
            { quantity: 1, tierGroup: "Ilicit tintura" },
            { quantity: 1, tierGroup: "ilicit TINTURA" },
            { quantity: 1, tierGroup: "Ilicit  tintura" },
        ]);
        expect(qty).toEqual([3, 3, 3]);
        expect(qty.map((q) => resolveUnitPrice(ilicit, q))).toEqual([2500, 2500, 2500]);
    });

    it("sin grupo cada línea cuenta lo suyo", () => {
        expect(tierQuantities([
            { quantity: 1, tierGroup: null },
            { quantity: 2 },
        ])).toEqual([1, 2]);
    });

    it("grupos distintos no se mezclan", () => {
        expect(tierQuantities([
            { quantity: 2, tierGroup: "Ilicit tintura" },
            { quantity: 1, tierGroup: "Shampoo" },
            { quantity: 1, tierGroup: "Ilicit tintura" },
        ])).toEqual([3, 1, 3]);
    });

    it("productos por kg o por unidad equivalente no se agrupan", () => {
        expect(tierQuantities([
            { quantity: 2, tierGroup: "Carne", unit: "Kg" },
            { quantity: 1, tierGroup: "Carne", equivLabel: "Pechuga", equivWeight: 0.4 },
            { quantity: 1, tierGroup: "Carne", unit: "Und" },
        ])).toEqual([2, 1, 1]);
    });
});
