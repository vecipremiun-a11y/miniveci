import type { Metadata } from "next";

/**
 * Marca, datos del local y helpers de SEO (metadata, JSON-LD y sitemap).
 *
 * La gente busca "veci" en Google, pero el dominio es miniveci.cl y Google no
 * separa "veci" dentro de "miniveci". Por eso los títulos y los datos
 * estructurados declaran "Minimarket Veci" (el nombre del letrero y del logo)
 * y dejan MiniVeci y Comercial Veci como nombres alternativos: así Google
 * puede asociar la búsqueda "veci" con este sitio y con la ficha de Google
 * Business del local.
 *
 * Nombre, dirección, teléfono y horario deben coincidir con la ficha de Google
 * Business: las diferencias le restan confianza a ambos.
 */

/**
 * Dominio canónico. Va fijo y no sale de NEXT_PUBLIC_SITE_URL a propósito: los
 * canonical y el sitemap deben apuntar siempre a producción, aunque la página
 * se sirva desde un preview o desde miniveci.vercel.app.
 */
export const SITE_URL = "https://www.miniveci.cl";

export const BRAND_NAME = "Minimarket Veci";
export const BRAND_ALTERNATE_NAMES = ["Veci", "MiniVeci", "Comercial Veci"];

export const STORE = {
    streetAddress: "Sotomayor 1460-A",
    city: "Iquique",
    region: "Tarapacá",
    postalCode: "1100000",
    country: "CL",
    phone: "+56951892258",
    phoneDisplay: "+56 9 5189 2258",
    email: "cliente@miniveci.cl",
    opens: "07:00",
    closes: "23:00",
    deliveryAreas: ["Iquique", "Alto Hospicio"],
} as const;

export const STORE_MAPS_URL =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(`${BRAND_NAME}, ${STORE.streetAddress}, ${STORE.city}`);

/**
 * Perfiles oficiales de la marca (ficha de Google Business, Instagram,
 * Facebook...). Van en `sameAs` del JSON-LD para que Google sepa que son la
 * misma entidad que este sitio. Pegar aquí el enlace de "Compartir perfil" de
 * la ficha de Google en cuanto se tenga.
 */
export const BRAND_PROFILES: string[] = [];

export const LOGO_PATH = "/logo%20veci.png";

export const TITLE_TEMPLATE = `%s | ${BRAND_NAME}`;
export const HOME_TITLE = "Minimarket Veci Iquique | Almacén de barrio y delivery";
export const HOME_DESCRIPTION =
    "Minimarket Veci (MiniVeci) en Iquique: abarrotes, pan amasado y verdura fresca con delivery a Iquique y Alto Hospicio. Abierto todos los días de 7 a 23 h.";

/** La imagen de app/opengraph-image.tsx, para las páginas que definen su propio `openGraph`. */
export const DEFAULT_OG_IMAGE = {
    url: "/opengraph-image",
    width: 1200,
    height: 630,
    alt: `${BRAND_NAME}, almacén de barrio en Iquique`,
};

export function absoluteUrl(path: string): string {
    return new URL(path, SITE_URL).toString();
}

/**
 * Metadata de una página pública indexable. Repite `openGraph` completo
 * porque Next reemplaza ese objeto entero (no lo fusiona) cuando una página
 * define el suyo, y se perderían `siteName`, `locale` y la imagen del layout
 * raíz.
 *
 * El título y la descripción de Open Graph y Twitter no se repiten: Next los
 * hereda del `title` (ya con la plantilla aplicada) y de `description`.
 *
 * Un título de texto se pasa como `{ default, template }`: si un layout declara
 * un título de texto simple, Next deja sin plantilla a sus rutas hijas y la
 * ficha de un producto saldría sin "| Minimarket Veci".
 */
export function pageMetadata({
    title,
    description,
    path,
    images,
}: {
    title: Metadata["title"];
    description: string;
    path: string;
    images?: { url: string; alt?: string }[];
}): Metadata {
    const shareImages = images?.length ? images : [DEFAULT_OG_IMAGE];
    return {
        title: typeof title === "string" ? { default: title, template: TITLE_TEMPLATE } : title,
        description,
        alternates: { canonical: path },
        openGraph: {
            type: "website",
            siteName: BRAND_NAME,
            locale: "es_CL",
            url: path,
            images: shareImages,
        },
        twitter: {
            card: "summary_large_image",
            images: shareImages.map((img) => img.url),
        },
    };
}

/** Páginas privadas o transaccionales: que Google siga los enlaces pero no las muestre. */
export const NOINDEX_METADATA: Metadata = {
    robots: { index: false, follow: true },
};

/** Recorta en el último espacio para que la descripción no corte una palabra. */
export function truncateText(text: string, max = 155): string {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max - 1);
    const lastSpace = cut.lastIndexOf(" ");
    return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
}

export function formatClp(value: number): string {
    return new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
        maximumFractionDigits: 0,
    }).format(value);
}

/**
 * SQLite guarda `CURRENT_TIMESTAMP` como "YYYY-MM-DD HH:MM:SS" en UTC y sin
 * zona horaria. Devuelve undefined si la fecha no se puede leer, para que el
 * sitemap simplemente omita `lastModified`.
 */
export function parseDbTimestamp(value: string | null | undefined): Date | undefined {
    if (!value) return undefined;
    const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(" ", "T")}Z` : value;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

/* ----------------------------- JSON-LD ----------------------------- */

const STORE_ID = `${SITE_URL}/#store`;
const WEBSITE_ID = `${SITE_URL}/#website`;

/** El local como GroceryStore (subtipo de LocalBusiness y de Organization). */
export function storeJsonLd() {
    return {
        "@context": "https://schema.org",
        "@type": "GroceryStore",
        "@id": STORE_ID,
        name: BRAND_NAME,
        alternateName: BRAND_ALTERNATE_NAMES,
        description: HOME_DESCRIPTION,
        url: `${SITE_URL}/`,
        logo: absoluteUrl(LOGO_PATH),
        image: [absoluteUrl(LOGO_PATH), absoluteUrl(DEFAULT_OG_IMAGE.url)],
        telephone: STORE.phone,
        email: STORE.email,
        priceRange: "$",
        currenciesAccepted: "CLP",
        address: {
            "@type": "PostalAddress",
            streetAddress: STORE.streetAddress,
            addressLocality: STORE.city,
            addressRegion: STORE.region,
            postalCode: STORE.postalCode,
            addressCountry: STORE.country,
        },
        openingHoursSpecification: [
            {
                "@type": "OpeningHoursSpecification",
                dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                opens: STORE.opens,
                closes: STORE.closes,
            },
        ],
        areaServed: STORE.deliveryAreas.map((name) => ({ "@type": "City", name })),
        hasMap: STORE_MAPS_URL,
        ...(BRAND_PROFILES.length ? { sameAs: BRAND_PROFILES } : {}),
    };
}

/**
 * WebSite en la portada: es lo que Google usa para elegir el nombre del sitio
 * que muestra encima de cada resultado.
 */
export function websiteJsonLd() {
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: BRAND_NAME,
        alternateName: BRAND_ALTERNATE_NAMES,
        url: `${SITE_URL}/`,
        inLanguage: "es-CL",
        publisher: { "@id": STORE_ID },
    };
}

export type ProductSeo = {
    name: string;
    slug: string;
    description: string | null;
    price: number;
    stock: number;
    offerEndsAt: string | null;
    category: { name: string; slug: string } | null;
    images: { url: string; alt: string }[];
    isOwnBrand: boolean;
};

export function productJsonLd(product: ProductSeo) {
    const url = absoluteUrl(`/productos/${product.slug}`);
    const priceValidUntil = parseDbTimestamp(product.offerEndsAt)?.toISOString().slice(0, 10);

    return {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        url,
        ...(product.description ? { description: truncateText(product.description, 5000) } : {}),
        ...(product.images.length ? { image: product.images.map((img) => absoluteUrl(img.url)) } : {}),
        ...(product.category ? { category: product.category.name } : {}),
        ...(product.isOwnBrand ? { brand: { "@type": "Brand", name: "Comercial Veci" } } : {}),
        offers: {
            "@type": "Offer",
            url,
            price: product.price,
            priceCurrency: "CLP",
            ...(priceValidUntil ? { priceValidUntil } : {}),
            availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
            seller: { "@id": STORE_ID },
        },
    };
}

export function productBreadcrumbJsonLd(product: ProductSeo) {
    const crumbs = [
        { name: "Inicio", url: `${SITE_URL}/` },
        { name: "Productos", url: absoluteUrl("/productos") },
        ...(product.category
            ? [{ name: product.category.name, url: absoluteUrl(`/productos?category=${encodeURIComponent(product.category.slug)}`) }]
            : []),
        { name: product.name, url: absoluteUrl(`/productos/${product.slug}`) },
    ];

    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: crumb.name,
            item: crumb.url,
        })),
    };
}
