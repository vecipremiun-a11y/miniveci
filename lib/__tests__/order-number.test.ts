import { describe, expect, it } from "vitest";
import { generateOrderNumber } from "../order-number";

describe("generateOrderNumber", () => {
    it("respeta el formato MV-YYMMDD-XXXXXX", () => {
        expect(generateOrderNumber()).toMatch(/^MV-\d{6}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    });

    it("usa el prefijo de la fecha actual", () => {
        const now = new Date();
        const y = now.getFullYear().toString().slice(-2);
        const m = String(now.getMonth() + 1).padStart(2, "0");
        const d = String(now.getDate()).padStart(2, "0");
        expect(generateOrderNumber().startsWith(`MV-${y}${m}${d}-`)).toBe(true);
    });

    it("no usa caracteres ambiguos (O/0/1/I) en el sufijo", () => {
        for (let i = 0; i < 500; i++) {
            const suffix = generateOrderNumber().split("-")[2];
            expect(suffix).not.toMatch(/[O01I]/);
        }
    });

    it("no colisiona en 20.000 generaciones (el formato viejo tenía 9000 combinaciones por día)", () => {
        const seen = new Set<string>();
        for (let i = 0; i < 20_000; i++) seen.add(generateOrderNumber());
        expect(seen.size).toBe(20_000);
    });
});
