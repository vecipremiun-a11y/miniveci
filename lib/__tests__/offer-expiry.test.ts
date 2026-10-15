import { describe, it, expect } from "vitest";
import { isOfferActive, normalizeOfferEndsAt, offerEndsAtAfterPosUpdate, resolveUnitPrice } from "../product-price";

const NOW = Date.parse("2026-10-02T15:00:00.000Z");
const harina = { webPrice: 16500, offerPrice: 15000, isOffer: true };

describe("isOfferActive", () => {
    it("sin fecha de término la oferta sigue vigente", () => {
        expect(isOfferActive({ ...harina, offerEndsAt: null }, NOW)).toBe(true);
    });

    it("antes del término está vigente; desde el término ya no", () => {
        expect(isOfferActive({ ...harina, offerEndsAt: "2026-10-02T15:00:01.000Z" }, NOW)).toBe(true);
        expect(isOfferActive({ ...harina, offerEndsAt: "2026-10-02T15:00:00.000Z" }, NOW)).toBe(false);
        expect(isOfferActive({ ...harina, offerEndsAt: "2026-10-01T23:59:00.000Z" }, NOW)).toBe(false);
    });

    it("sin isOffer o sin precio de oferta no hay oferta", () => {
        expect(isOfferActive({ ...harina, isOffer: false }, NOW)).toBe(false);
        expect(isOfferActive({ ...harina, offerPrice: null }, NOW)).toBe(false);
    });
});

describe("resolveUnitPrice con oferta vencida", () => {
    it("cobra el precio normal cuando la oferta terminó", () => {
        expect(resolveUnitPrice({ ...harina, offerEndsAt: "2000-01-01T00:00:00.000Z" }, 1)).toBe(16500);
        expect(resolveUnitPrice({ ...harina, offerEndsAt: "2999-01-01T00:00:00.000Z" }, 1)).toBe(15000);
    });
});

describe("offerEndsAtAfterPosUpdate", () => {
    const existing = { isOffer: true, offerPrice: 15000 };

    it("POSVECI repitiendo la misma oferta no revive una vencida (no toca la fecha)", () => {
        expect(offerEndsAtAfterPosUpdate(existing, { isOffer: true, offerPrice: 15000 })).toBeUndefined();
        expect(offerEndsAtAfterPosUpdate(existing, {})).toBeUndefined();
    });

    it("una oferta nueva o apagada limpia la fecha", () => {
        expect(offerEndsAtAfterPosUpdate(existing, { offerPrice: 14000 })).toBeNull();
        expect(offerEndsAtAfterPosUpdate(existing, { isOffer: false })).toBeNull();
        expect(offerEndsAtAfterPosUpdate({ isOffer: false, offerPrice: 15000 }, { isOffer: true })).toBeNull();
    });

    it("si POSVECI manda la fecha de término, manda ella", () => {
        expect(offerEndsAtAfterPosUpdate(existing, { isOffer: true, offerPrice: 15000, offerEndsAt: "2026-10-10T23:59:00-03:00" }))
            .toBe("2026-10-11T02:59:00.000Z");
        expect(offerEndsAtAfterPosUpdate(existing, { offerPrice: 14000, offerEndsAt: "2026-10-10T23:59:00Z" }))
            .toBe("2026-10-10T23:59:00.000Z");
        expect(offerEndsAtAfterPosUpdate(existing, { offerEndsAt: null })).toBeNull();
    });
});

describe("normalizeOfferEndsAt", () => {
    it("deja la fecha en ISO UTC y vacío/ inválido en null", () => {
        expect(normalizeOfferEndsAt("2026-10-04T23:59:00-03:00")).toBe("2026-10-05T02:59:00.000Z");
        expect(normalizeOfferEndsAt("")).toBeNull();
        expect(normalizeOfferEndsAt(null)).toBeNull();
        expect(normalizeOfferEndsAt("no es fecha")).toBeNull();
    });
});
