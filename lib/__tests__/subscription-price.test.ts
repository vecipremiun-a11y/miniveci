import { describe, it, expect } from "vitest";
import { costPlusTax, DEFAULT_SUBSCRIPTION_MARGIN, subscriptionPriceFor } from "../product-price";

describe("precio suscriptor automático", () => {
    it("(costo + IVA) × (1 + utilidad), con la de todos por defecto", () => {
        expect(DEFAULT_SUBSCRIPTION_MARGIN).toBe(5);
        expect(costPlusTax(5500, 19)).toBe(6545);
        expect(subscriptionPriceFor(5500, 19, null)).toBe(6872);
        expect(subscriptionPriceFor(958, 0, null)).toBe(1006);
    });

    it("un producto con su propia utilidad usa la suya", () => {
        expect(subscriptionPriceFor(5500, 19, 6)).toBe(6938);
    });

    it("si cambia el costo, sube o baja con él", () => {
        expect(subscriptionPriceFor(6000, 19, null)).toBe(7497);
        expect(subscriptionPriceFor(5100, 19, null)).toBe(6372);
    });

    it("sin costo no hay con qué calcularlo", () => {
        expect(subscriptionPriceFor(null, 19, null)).toBeNull();
        expect(subscriptionPriceFor(0, 19, null)).toBeNull();
    });
});
