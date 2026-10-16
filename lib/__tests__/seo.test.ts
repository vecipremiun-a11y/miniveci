import { describe, it, expect } from "vitest";
import {
    DEFAULT_OG_IMAGE,
    TITLE_TEMPLATE,
    pageMetadata,
    parseDbTimestamp,
    productBreadcrumbJsonLd,
    productJsonLd,
    truncateText,
    type ProductSeo,
} from "../seo";

const PRODUCT: ProductSeo = {
    name: "Pan amasado",
    slug: "pan-amasado",
    description: "Hecho en el día.",
    price: 2500,
    stock: 12,
    offerEndsAt: null,
    category: { name: "Panes", slug: "panes" },
    images: [{ url: "/placeholder-product.svg", alt: "Pan amasado" }],
    isOwnBrand: false,
};

describe("pageMetadata", () => {
    it("pasa la plantilla del título a las rutas hijas", () => {
        // Un título de texto en un layout dejaba sin "| Minimarket Veci" a la ficha de cada producto.
        expect(pageMetadata({ title: "Productos", description: "x", path: "/productos" }).title).toEqual({
            default: "Productos",
            template: TITLE_TEMPLATE,
        });
    });

    it("respeta un título absoluto", () => {
        expect(pageMetadata({ title: { absolute: "Portada" }, description: "x", path: "/" }).title).toEqual({
            absolute: "Portada",
        });
    });

    it("usa la imagen del sitio si la página no trae una", () => {
        const meta = pageMetadata({ title: "Contacto", description: "x", path: "/contacto" });
        expect(meta.openGraph).toMatchObject({ url: "/contacto", siteName: "Minimarket Veci", images: [DEFAULT_OG_IMAGE] });
        expect(meta.alternates).toEqual({ canonical: "/contacto" });
    });
});

describe("truncateText", () => {
    it("deja igual un texto corto y normaliza espacios", () => {
        expect(truncateText("  Pan   amasado \n del día ")).toBe("Pan amasado del día");
    });

    it("corta en un espacio sin pasarse del máximo", () => {
        const out = truncateText("palabra ".repeat(40), 50);
        expect(out.length).toBeLessThanOrEqual(50);
        expect(out.endsWith("palabra…")).toBe(true);
    });
});

describe("parseDbTimestamp", () => {
    it("lee el CURRENT_TIMESTAMP de SQLite como UTC", () => {
        expect(parseDbTimestamp("2026-10-15 10:52:16")?.toISOString()).toBe("2026-10-15T10:52:16.000Z");
    });

    it("acepta ISO y descarta lo ilegible", () => {
        expect(parseDbTimestamp("2026-10-15T10:52:16.162Z")?.toISOString()).toBe("2026-10-15T10:52:16.162Z");
        expect(parseDbTimestamp("no es fecha")).toBeUndefined();
        expect(parseDbTimestamp(null)).toBeUndefined();
    });
});

describe("productJsonLd", () => {
    it("publica precio en CLP, disponibilidad y URLs absolutas", () => {
        const ld = productJsonLd(PRODUCT);
        expect(ld.url).toBe("https://www.miniveci.cl/productos/pan-amasado");
        expect(ld.image).toEqual(["https://www.miniveci.cl/placeholder-product.svg"]);
        expect(ld.offers).toMatchObject({
            price: 2500,
            priceCurrency: "CLP",
            availability: "https://schema.org/InStock",
        });
        expect(ld).not.toHaveProperty("brand");
    });

    it("marca sin stock, la vigencia de la oferta y la marca propia", () => {
        const ld = productJsonLd({ ...PRODUCT, stock: 0, offerEndsAt: "2026-10-20 03:00:00", isOwnBrand: true });
        expect(ld.offers.availability).toBe("https://schema.org/OutOfStock");
        expect(ld.offers).toMatchObject({ priceValidUntil: "2026-10-20" });
        expect(ld).toMatchObject({ brand: { name: "Comercial Veci" } });
    });
});

describe("productBreadcrumbJsonLd", () => {
    it("arma Inicio > Productos > Categoría > Producto", () => {
        const names = productBreadcrumbJsonLd(PRODUCT).itemListElement.map((item) => item.name);
        expect(names).toEqual(["Inicio", "Productos", "Panes", "Pan amasado"]);
    });
});
