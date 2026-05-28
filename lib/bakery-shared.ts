/**
 * Helpers de amasandería seguros para cliente (sin imports de DB).
 * Re-implementan la misma lógica que lib/bakery.ts pero sin tocar Drizzle,
 * para que los componentes cliente puedan importarlos sin meter el cliente
 * de libSQL al bundle del navegador.
 */
import type { BakeryCategory } from "@/lib/validations/bakery";

// Labels de las categorías semilla. Las nuevas (dinámicas) traen su propio label.
export const BAKERY_CATEGORY_LABELS: Record<string, string> = {
    pan: "Pan",
    sandwich: "Sándwich",
    hamburguesa: "Hamburguesa",
    canape: "Canapé",
    dulce: "Dulce",
};

export const BAKERY_CATEGORY_ORDER: BakeryCategory[] = ["pan", "sandwich", "hamburguesa", "canape", "dulce"];

/** "tortas-de-cumple" → "Tortas De Cumple" (fallback cuando no hay label). */
export function humanizeBakeryCategory(slug: string): string {
    return slug
        .split("-")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
}

/** Label de una categoría: usa el mapa dinámico, luego las semilla, luego humaniza el slug. */
export function bakeryCategoryLabel(slug: string, labelMap?: Record<string, string>): string {
    return labelMap?.[slug] || BAKERY_CATEGORY_LABELS[slug] || humanizeBakeryCategory(slug);
}

// Paleta de badges. Las semilla mantienen su color; las nuevas reciben uno
// determinístico (mismo slug → mismo color siempre).
const BAKERY_BADGE_PALETTE = [
    "bg-amber-100 text-amber-800 border-amber-200",
    "bg-rose-100 text-rose-700 border-rose-200",
    "bg-orange-100 text-orange-700 border-orange-200",
    "bg-violet-100 text-violet-700 border-violet-200",
    "bg-pink-100 text-pink-700 border-pink-200",
    "bg-emerald-100 text-emerald-700 border-emerald-200",
    "bg-sky-100 text-sky-700 border-sky-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
    "bg-teal-100 text-teal-700 border-teal-200",
    "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
];
const BAKERY_KNOWN_BADGE: Record<string, string> = {
    pan: BAKERY_BADGE_PALETTE[0],
    sandwich: BAKERY_BADGE_PALETTE[1],
    hamburguesa: BAKERY_BADGE_PALETTE[2],
    canape: BAKERY_BADGE_PALETTE[3],
    dulce: BAKERY_BADGE_PALETTE[4],
};

export function bakeryCategoryBadgeClass(slug: string): string {
    if (BAKERY_KNOWN_BADGE[slug]) return BAKERY_KNOWN_BADGE[slug];
    let h = 0;
    for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
    return BAKERY_BADGE_PALETTE[h % BAKERY_BADGE_PALETTE.length];
}

/** Slug normalizado a partir de un nombre ("Tortas de Cumple" → "tortas-de-cumple"). */
export function slugifyBakeryCategory(name: string): string {
    return name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}

/** Mismo cálculo que el server (lib/bakery.ts → calcItemSubtotal). */
export function calcBakeryItemSubtotal(product: {
    pricingMode: "unit" | "kg";
    price: number;
    gramsPerUnit: number | null;
}, quantity: number): number {
    if (product.pricingMode === "unit") return product.price * quantity;
    const grams = quantity * (product.gramsPerUnit ?? 0);
    return Math.round((grams / 1000) * product.price);
}

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
export function formatCLP(value: number): string {
    return CLP.format(value);
}

/** "1.10 kg", "0.90 kg" */
export function formatKg(grams: number): string {
    return `${(grams / 1000).toFixed(2)} kg`;
}

/** Anticipación humanizada: 4 → "4 h", 24 → "1 día", 48 → "2 días", 30 → "1 d 6 h". */
export function formatLeadTime(hours: number): string {
    const h = Math.max(0, Math.round(hours));
    if (h === 0) return "Sin anticipación";
    if (h < 24) return `${h} h`;
    const days = Math.floor(h / 24);
    const rem = h - days * 24;
    if (rem === 0) return days === 1 ? "1 día" : `${days} días`;
    return `${days} d ${rem} h`;
}
