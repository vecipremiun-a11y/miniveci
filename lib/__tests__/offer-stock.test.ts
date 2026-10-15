import { describe, it, expect } from "vitest";
import {
    isOfferActive,
    normalizeOfferStock,
    offerCapError,
    offerQuantityCap,
    offerStockAfterPosUpdate,
    resolveUnitPrice,
} from "../product-price";

const harina = { name: "Harina", unit: "Und", webPrice: 16500, offerPrice: 15000, isOffer: true };

describe("oferta por stock", () => {
    it("sin límite (null) la oferta sigue; con stock está vigente; en 0 se acaba", () => {
        expect(isOfferActive({ ...harina, offerStock: null })).toBe(true);
        expect(isOfferActive({ ...harina, offerStock: 3 })).toBe(true);
        expect(isOfferActive({ ...harina, offerStock: 0 })).toBe(false);
    });

    it("agotada se cobra al precio normal", () => {
        expect(resolveUnitPrice({ ...harina, offerStock: 0 }, 1)).toBe(16500);
        expect(resolveUnitPrice({ ...harina, offerStock: 5 }, 1)).toBe(15000);
    });

    it("se vence por fecha aunque quede stock en oferta", () => {
        expect(isOfferActive({ ...harina, offerStock: 5, offerEndsAt: "2000-01-01T00:00:00.000Z" })).toBe(false);
    });
});

describe("offerQuantityCap / offerCapError (tope en el carrito)", () => {
    it("solo hay tope con oferta vigente y límite de stock", () => {
        expect(offerQuantityCap({ ...harina, offerStock: 3 })).toBe(3);
        expect(offerQuantityCap({ ...harina, offerStock: null })).toBeNull();
        expect(offerQuantityCap({ ...harina, isOffer: false, offerStock: 3 })).toBeNull();
    });

    it("rechaza pedir más de lo que queda, sumando las líneas del mismo producto", () => {
        const map = new Map([["h", { ...harina, offerStock: 3 }]]);
        expect(offerCapError([{ productId: "h", quantity: 3 }], map)).toBeNull();
        expect(offerCapError([{ productId: "h", quantity: 2 }, { productId: "h", quantity: 2 }], map))
            .toBe("Harina: solo quedan 3 unidades en oferta");
    });

    it("en los de peso compara kilos con decimales", () => {
        const map = new Map([["p", { ...harina, name: "Palta", unit: "Kg", offerStock: 2.5 }]]);
        expect(offerCapError([{ productId: "p", quantity: 2.5 }], map)).toBeNull();
        expect(offerCapError([{ productId: "p", quantity: 2.6 }], map)).toBe("Palta: solo quedan 2.5 kg en oferta");
    });
});

describe("offerStockAfterPosUpdate", () => {
    const existing = { isOffer: true, offerPrice: 15000, unit: "Und" };

    it("si POSVECI manda el stock en oferta, manda él", () => {
        expect(offerStockAfterPosUpdate(existing, { offerStock: 12 })).toBe(12);
        expect(offerStockAfterPosUpdate(existing, { offerStock: null })).toBeNull();
        expect(offerStockAfterPosUpdate(existing, { offerStock: 0 })).toBe(0);
    });

    it("si no lo manda: repetir la oferta no revive una agotada; una oferta nueva limpia el límite", () => {
        expect(offerStockAfterPosUpdate(existing, { isOffer: true, offerPrice: 15000 })).toBeUndefined();
        expect(offerStockAfterPosUpdate(existing, { offerPrice: 14000 })).toBeNull();
        expect(offerStockAfterPosUpdate(existing, { isOffer: false })).toBeNull();
    });
});

describe("normalizeOfferStock", () => {
    it("enteros en unidades, 3 decimales en kg/lt, negativos a 0", () => {
        expect(normalizeOfferStock(4.7, "Und")).toBe(4);
        expect(normalizeOfferStock(2.34567, "kg")).toBe(2.346);
        expect(normalizeOfferStock(-3, "Und")).toBe(0);
        expect(normalizeOfferStock(null, "Und")).toBeNull();
    });
});
