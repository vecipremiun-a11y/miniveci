import { describe, expect, it } from "vitest";
import { formatRut, isValidRut } from "../rut";

describe("isValidRut", () => {
    it("acepta RUT con dígito verificador correcto, con o sin formato", () => {
        expect(isValidRut("12.345.678-5")).toBe(true);
        expect(isValidRut("123456785")).toBe(true);
        expect(isValidRut("76.086.428-5")).toBe(true);
        expect(isValidRut("10.000.013-K")).toBe(true);
        expect(isValidRut("10000013k")).toBe(true);
    });

    it("rechaza un dígito verificador incorrecto", () => {
        expect(isValidRut("12.345.678-9")).toBe(false);
        expect(isValidRut("10.000.013-1")).toBe(false);
    });

    it("rechaza lo que no tiene forma de RUT", () => {
        expect(isValidRut("")).toBe(false);
        expect(isValidRut("5")).toBe(false);
        expect(isValidRut("abc")).toBe(false);
        expect(isValidRut("1234567890123")).toBe(false);
    });
});

describe("formatRut", () => {
    it("pone puntos y guion", () => {
        expect(formatRut("123456785")).toBe("12.345.678-5");
        expect(formatRut("76086428-5")).toBe("76.086.428-5");
        expect(formatRut("10000013k")).toBe("10.000.013-K");
        expect(formatRut("1234567")).toBe("123.456-7");
    });

    it("deja tranquilo lo que todavía no alcanza para formatear", () => {
        expect(formatRut("")).toBe("");
        expect(formatRut("1")).toBe("1");
    });
});
