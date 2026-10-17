import { describe, it, expect } from "vitest";
import { priceProductLines, type LineProduct } from "../order-lines";
import type { PresentationRecord } from "../product-presentations";

// Huevo: $300 suelto, oferta $280 (quedan 5 en oferta), escala 10+ a $260,
// socio $240. Caja de 30 a $8.100 ($270 c/u). Stock: 100 unidades.
const huevo: LineProduct = {
    id: "huevo",
    name: "Huevo Extra",
    unit: "Und",
    webPrice: 300,
    isOffer: true,
    offerPrice: 280,
    offerStock: 5,
    priceTiers: [{ minQty: 10, maxQty: null, price: 260 }],
    subscriptionPrice: 240,
    tierGroup: "huevos",
    webStock: 100,
    stockSource: "manual",
};
// Mismo grupo de escala que el huevo.
const huevoColor: LineProduct = {
    id: "huevo-color",
    name: "Huevo Color",
    unit: "Und",
    webPrice: 300,
    priceTiers: [{ minQty: 10, maxQty: null, price: 260 }],
    tierGroup: "huevos",
    webStock: 100,
    stockSource: "manual",
};
const harina: LineProduct = { id: "harina", name: "Harina", unit: "Kg", webPrice: 1200, webStock: 50, stockSource: "manual" };

const caja: PresentationRecord = {
    id: "caja", productId: "huevo", source: "pos", posPresentationId: "12",
    name: "Caja", units: 30, price: 8100, barcode: null, isActive: true, hiddenInStore: false,
};

const products = new Map([huevo, huevoColor, harina].map((p) => [p.id, p]));
const presentations = (...list: PresentationRecord[]) => new Map(list.map((p) => [p.id, p]));

function price(lines: Parameters<typeof priceProductLines>[0], opts: { isSubscriber?: boolean } = {}, pres = presentations(caja), map = products) {
    return priceProductLines(lines, map, pres, opts);
}

describe("caja: precio fijo", () => {
    it("sin escala, sin oferta y sin precio de socio; cantidad en unidades", () => {
        const r = price([{ productId: "huevo", quantity: 2, presentationId: "caja" }], { isSubscriber: true });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.lines[0]).toEqual({
            productId: "huevo",
            quantity: 60,
            unitPrice: 270,
            totalPrice: 16200,
            presentation: { id: "caja", posPresentationId: "12", name: "Caja", units: 30, qty: 2, price: 8100 },
        });
        expect(r.lines[0].unitPrice * r.lines[0].quantity).toBe(r.lines[0].totalPrice);
    });

    it("una propia de miniveci viaja sin pos_presentation_id", () => {
        const propia = { ...caja, id: "propia", source: "store", posPresentationId: null };
        const r = price([{ productId: "huevo", quantity: 1, presentationId: "propia" }], {}, presentations(propia));
        expect(r.ok && r.lines[0].presentation?.posPresentationId).toBeNull();
    });
});

describe("renglones separados: cajas y sueltas del mismo producto", () => {
    it("la caja no suma a la escala de las sueltas (ni a su grupo)", () => {
        const r = price([
            { productId: "huevo", quantity: 1, presentationId: "caja" },
            { productId: "huevo", quantity: 5 },
            { productId: "huevo-color", quantity: 4 },
        ]);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        // 5 + 4 = 9 sueltas del grupo: no llegan al tramo de 10 aunque la caja traiga 30.
        expect(r.lines.map((l) => l.unitPrice)).toEqual([270, 280, 300]);
        expect(r.lines.map((l) => l.presentation?.name ?? null)).toEqual(["Caja", null, null]);
    });

    it("las sueltas siguen igual que siempre (escala por grupo y socio)", () => {
        const r = price([
            { productId: "huevo", quantity: 5 },
            { productId: "huevo-color", quantity: 5 },
        ], { isSubscriber: true });
        expect(r.ok && r.lines.map((l) => l.unitPrice)).toEqual([240, 260]);
    });

    it("la caja no gasta el tope de la oferta por stock", () => {
        expect(price([
            { productId: "huevo", quantity: 2, presentationId: "caja" },
            { productId: "huevo", quantity: 5 },
        ]).ok).toBe(true);
        const r = price([{ productId: "huevo", quantity: 6 }]);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain("en oferta");
    });
});

describe("stock en unidades", () => {
    it("suma sueltas + cajas × unidades contra el stock", () => {
        // 3 cajas (90) + 10 sueltas = 100 ≤ 100. Sin oferta, para no topar con offerStock.
        const sinOferta = new Map(products);
        sinOferta.set("huevo", { ...huevo, isOffer: false });
        expect(price([
            { productId: "huevo", quantity: 3, presentationId: "caja" },
            { productId: "huevo", quantity: 10 },
        ], {}, presentations(caja), sinOferta).ok).toBe(true);

        const r = price([
            { productId: "huevo", quantity: 3, presentationId: "caja" },
            { productId: "huevo", quantity: 11 },
        ], {}, presentations(caja), sinOferta);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error).toContain("quedan 100 unidades y el pedido lleva 101");
    });

    it("una caja necesita el stock de la caja entera", () => {
        const r = price([{ productId: "huevo", quantity: 4, presentationId: "caja" }]);
        expect(r.ok).toBe(false);
    });

    it("sin cajas el stock no se revisa acá, como siempre", () => {
        const sinOferta = new Map(products);
        sinOferta.set("huevo", { ...huevo, isOffer: false });
        expect(price([{ productId: "huevo", quantity: 150 }], {}, presentations(caja), sinOferta).ok).toBe(true);
    });
});

describe("la presentación tiene que poder venderse", () => {
    it("de otro producto, inactiva, oculta o en un producto por peso: no", () => {
        const otra = { ...caja, id: "otra", productId: "huevo-color" };
        const inactiva = { ...caja, id: "inactiva", isActive: false };
        const oculta = { ...caja, id: "oculta", hiddenInStore: true };
        const deHarina = { ...caja, id: "harina-caja", productId: "harina" };
        const pres = presentations(otra, inactiva, oculta, deHarina);
        for (const [productId, presentationId] of [["huevo", "otra"], ["huevo", "inactiva"], ["huevo", "oculta"], ["harina", "harina-caja"], ["huevo", "no-existe"]]) {
            const r = price([{ productId, quantity: 1, presentationId }], {}, pres);
            expect(r.ok, presentationId).toBe(false);
        }
    });
});
