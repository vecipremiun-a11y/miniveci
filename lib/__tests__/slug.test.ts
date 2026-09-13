import { describe, it, expect } from "vitest";
import { slugify } from "../slug";

describe("slugify", () => {
    it("quita las tildes en vez de convertirlas en guiones", () => {
        expect(slugify("Estantería")).toBe("estanteria");
        expect(slugify("Pan de Canapé 1kg")).toBe("pan-de-canape-1kg");
        expect(slugify("Cafés")).toBe("cafes");
    });

    it("la ñ pasa a n", () => {
        expect(slugify("Niños")).toBe("ninos");
        expect(slugify("Mundo Pequeño")).toBe("mundo-pequeno");
    });

    it("no deja guiones sueltos en los bordes ni repetidos", () => {
        expect(slugify("  ¡Rápidos!  ")).toBe("rapidos");
        expect(slugify("Jugos y // Sobres")).toBe("jugos-y-sobres");
    });

    it("un nombre sin letras ni números da vacío", () => {
        expect(slugify("***")).toBe("");
    });
});
