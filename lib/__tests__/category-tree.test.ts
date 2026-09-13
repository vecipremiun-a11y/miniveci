import { describe, it, expect } from "vitest";
import { orderAsTree, branchIds, branchCounts, type FlatCategory } from "../category-tree";

// La forma real que manda POSVECI: tres niveles.
const CATS: FlatCategory[] = [
    { id: "amasanderia", name: "Amasanderia", parentId: null },
    { id: "panes", name: "Panes", parentId: "amasanderia" },
    { id: "empanadas", name: "Empanadas", parentId: "amasanderia" },
    { id: "integrales", name: "Integrales", parentId: "panes" },
    { id: "mascota", name: "Mascota", parentId: null },
    { id: "granel", name: "Granel", parentId: "mascota" },
];

describe("orderAsTree", () => {
    it("pone cada categoría seguida de sus hijas, no en orden alfabético plano", () => {
        expect(orderAsTree(CATS).map((c) => c.name)).toEqual([
            "Amasanderia", "Empanadas", "Panes", "Integrales", "Mascota", "Granel",
        ]);
    });

    it("marca el nivel y la ruta de cada una", () => {
        const byName = Object.fromEntries(orderAsTree(CATS).map((c) => [c.name, c]));
        expect(byName["Amasanderia"].level).toBe(0);
        expect(byName["Panes"].level).toBe(1);
        expect(byName["Integrales"].level).toBe(2);
        expect(byName["Integrales"].path).toEqual(["Amasanderia", "Panes", "Integrales"]);
    });

    it("respeta sortOrder antes que el nombre", () => {
        const conOrden: FlatCategory[] = [
            { id: "b", name: "Bebidas", parentId: null, sortOrder: 2 },
            { id: "a", name: "Aguas", parentId: null, sortOrder: 5 },
        ];
        expect(orderAsTree(conOrden).map((c) => c.name)).toEqual(["Bebidas", "Aguas"]);
    });

    it("no se cae con datos torcidos y no pierde ninguna categoría", () => {
        expect(orderAsTree([])).toEqual([]);

        const huerfana = orderAsTree([{ id: "x", name: "Perdida", parentId: "no-existe" }]);
        expect(huerfana).toHaveLength(1);
        expect(huerfana[0].level).toBe(0);

        const ciclo = orderAsTree([
            { id: "a", name: "A", parentId: "b" },
            { id: "b", name: "B", parentId: "a" },
        ]);
        expect(ciclo.map((c) => c.name).sort()).toEqual(["A", "B"]);

        const propioPadre = orderAsTree([{ id: "a", name: "A", parentId: "a" }]);
        expect(propioPadre).toHaveLength(1);
        expect(propioPadre[0].level).toBe(0);
    });
});

describe("branchIds", () => {
    it("trae la categoría más toda su descendencia", () => {
        expect(branchIds(CATS, "amasanderia").sort()).toEqual(
            ["amasanderia", "empanadas", "integrales", "panes"]
        );
        expect(branchIds(CATS, "panes").sort()).toEqual(["integrales", "panes"]);
        expect(branchIds(CATS, "empanadas")).toEqual(["empanadas"]);
    });

    it("un ciclo no cuelga la búsqueda de la rama", () => {
        const ciclo: FlatCategory[] = [
            { id: "a", name: "A", parentId: "b" },
            { id: "b", name: "B", parentId: "a" },
        ];
        expect(branchIds(ciclo, "a").sort()).toEqual(["a", "b"]);
    });
});

describe("branchCounts", () => {
    it("suma lo propio más lo de las hijas y nietas", () => {
        const propios = { amasanderia: 1, panes: 2, empanadas: 1, integrales: 1, mascota: 12, granel: 0 };
        const totales = branchCounts(CATS, propios);
        expect(totales.amasanderia).toBe(5);
        expect(totales.panes).toBe(3);
        expect(totales.empanadas).toBe(1);
        expect(totales.mascota).toBe(12);
        expect(totales.granel).toBe(0);
    });

    it("una categoría sin productos cuenta 0, no undefined", () => {
        expect(branchCounts(CATS, {}).amasanderia).toBe(0);
    });
});
