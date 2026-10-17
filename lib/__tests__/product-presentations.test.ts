import { describe, it, expect } from "vitest";
import {
    assembledCount,
    cartLineProductId,
    formatPresentationLine,
    maxPresentationBoxes,
    orderItemPresentation,
    orderItemPresentationColumns,
    parsePosPresentations,
    presentationCartId,
    presentationPriceSuggestions,
    presentationsAllowed,
    validatePresentation,
} from "../product-presentations";

describe("validatePresentation", () => {
    it("acepta una caja cuyo precio se divide exacto por las unidades", () => {
        const r = validatePresentation({ name: "  Caja ", units: 30, price: 7500, barcode: " 656885587 " });
        expect(r).toEqual({ ok: true, value: { name: "Caja", units: 30, price: 7500, barcode: "656885587" } });
    });

    it("rechaza un precio que no divide exacto y sugiere los dos más cercanos", () => {
        const r = validatePresentation({ name: "Caja", units: 30, price: 7600 });
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.field).toBe("price");
        expect(r.suggestions).toEqual([7590, 7620]);
        expect(r.error).toContain("$7.590");
        expect(r.error).toContain("$7.620");
    });

    it("unidades: entero de 2 o más", () => {
        expect(validatePresentation({ name: "Caja", units: 1, price: 100 }).ok).toBe(false);
        expect(validatePresentation({ name: "Caja", units: 2.5, price: 100 }).ok).toBe(false);
        expect(validatePresentation({ name: "Caja", units: 2, price: 100 }).ok).toBe(true);
    });

    it("precio: pesos enteros mayores a 0", () => {
        expect(validatePresentation({ name: "Caja", units: 2, price: 0 }).ok).toBe(false);
        expect(validatePresentation({ name: "Caja", units: 2, price: 100.5 }).ok).toBe(false);
    });

    it("pide nombre y código sin espacios; código vacío = sin código", () => {
        expect(validatePresentation({ name: "  ", units: 2, price: 100 }).ok).toBe(false);
        expect(validatePresentation({ name: "Caja", units: 2, price: 100, barcode: "12 34" }).ok).toBe(false);
        const r = validatePresentation({ name: "Caja", units: 2, price: 100, barcode: "" });
        expect(r.ok && r.value.barcode).toBeNull();
    });

    it("las sugerencias no proponen $0", () => {
        expect(presentationPriceSuggestions(20, 30)).toEqual([30]);
    });
});

describe("parsePosPresentations (lo que manda POSVECI)", () => {
    it("acepta snake_case y camelCase", () => {
        const { valid, skipped } = parsePosPresentations([
            { pos_presentation_id: "12", name: "Caja", units: 30, price: 7500, barcode: "656885587", is_active: true },
            { posPresentationId: 15, name: "Bandeja", units: 15, price: 4500, barcode: null, isActive: false },
        ]);
        expect(skipped).toEqual([]);
        expect(valid).toEqual([
            { posPresentationId: "12", name: "Caja", units: 30, price: 7500, barcode: "656885587", isActive: true },
            { posPresentationId: "15", name: "Bandeja", units: 15, price: 4500, barcode: null, isActive: false },
        ]);
    });

    it("salta las inválidas y dice por qué, sin botar las buenas", () => {
        const { valid, skipped } = parsePosPresentations([
            { pos_presentation_id: "1", name: "Caja", units: 30, price: 7600 },
            { pos_presentation_id: "2", name: "Pack", units: 1, price: 500 },
            { name: "Sin id", units: 6, price: 600 },
            { pos_presentation_id: "3", name: "Display", units: 12, price: 1200, barcode: "999" },
            { pos_presentation_id: "3", name: "Display", units: 12, price: 1200 },
            { pos_presentation_id: "4", name: "Otro", units: 6, price: 600, barcode: "999" },
        ]);
        expect(valid.map((v) => v.posPresentationId)).toEqual(["3"]);
        expect(skipped.map((s) => s.pos_presentation_id)).toEqual(["1", "2", null, "3", "4"]);
        expect(skipped[0].error).toContain("no se divide exacto");
    });
});

describe("presentationsAllowed", () => {
    it("solo productos por unidad", () => {
        expect(presentationsAllowed({ unit: "Und" })).toBe(true);
        expect(presentationsAllowed({ unit: "und" })).toBe(true);
        expect(presentationsAllowed({ unit: "Kg" })).toBe(false);
        expect(presentationsAllowed({ unit: "Lt" })).toBe(false);
        expect(presentationsAllowed({ unit: "Und", equivLabel: "Palta", equivWeight: 0.3 })).toBe(false);
    });
});

describe("formato y armadas", () => {
    it("se muestra como en el ticket del POS", () => {
        expect(formatPresentationLine({ qty: 2, name: "Caja", units: 30, price: 7500 })).toBe("2 Caja (30 und) × $7.500");
    });

    it("armadas = stock / unidades, hacia abajo", () => {
        expect(assembledCount(800, 15)).toBe(53);
        expect(assembledCount(800, 30)).toBe(26);
        expect(assembledCount(0, 30)).toBe(0);
    });
});

describe("renglones del carrito", () => {
    it("la caja va en un renglón aparte de las unidades sueltas", () => {
        const id = presentationCartId("prod-1", "pres-9");
        expect(id).not.toBe("prod-1");
        expect(cartLineProductId(id)).toBe("prod-1");
        expect(cartLineProductId("prod-1")).toBe("prod-1");
        expect(cartLineProductId("prod-1__kg")).toBe("prod-1");
    });

    it("las cajas que caben descuentan lo que ya ocupan los otros renglones", () => {
        expect(maxPresentationBoxes(100, 30)).toBe(3);
        expect(maxPresentationBoxes(100, 30, 15)).toBe(2);
        expect(maxPresentationBoxes(20, 30)).toBe(0);
        expect(maxPresentationBoxes(10, 30, 50)).toBe(0);
    });
});

describe("foto en order_items", () => {
    it("ida y vuelta; por unidad queda todo en NULL", () => {
        const p = { id: "x", posPresentationId: "12", name: "Caja", units: 30, qty: 2, price: 7500 };
        expect(orderItemPresentation(orderItemPresentationColumns(p))).toEqual(p);
        const none = orderItemPresentationColumns(null);
        expect(Object.values(none).every((v) => v === null)).toBe(true);
        expect(orderItemPresentation(none)).toBeNull();
    });
});
