/**
 * Helpers de amasandería seguros para cliente (sin imports de DB).
 * Re-implementan la misma lógica que lib/bakery.ts pero sin tocar Drizzle,
 * para que los componentes cliente puedan importarlos sin meter el cliente
 * de libSQL al bundle del navegador.
 */
import type { BakeryCategory } from "@/lib/validations/bakery";

export const BAKERY_CATEGORY_LABELS: Record<BakeryCategory, string> = {
    pan: "Pan",
    sandwich: "Sándwich",
    hamburguesa: "Hamburguesa",
    canape: "Canapé",
    dulce: "Dulce",
};

export const BAKERY_CATEGORY_ORDER: BakeryCategory[] = ["pan", "sandwich", "hamburguesa", "canape", "dulce"];

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
