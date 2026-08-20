/**
 * Generación de `orders.order_number`.
 *
 * El formato anterior era `MV-YYMMDD-` + 4 dígitos de `Math.random()`: solo 9000
 * combinaciones por día, no criptográfico, y el flujo web no reintentaba ante
 * duplicados. Con ~100 pedidos diarios la probabilidad de colisión rondaba el
 * 40%, y el webhook de Mercado Pago resuelve la orden por `order_number` con
 * `.limit(1)` → una colisión marcaba pagada la orden equivocada.
 *
 * Ahora: mismo prefijo legible por fecha, pero el sufijo sale de `crypto` sobre
 * un alfabeto sin caracteres ambiguos (32^6 ≈ 1.07e9 combinaciones), más
 * reintento contra la base para garantizar unicidad.
 */
import { randomInt } from "crypto";

/** Sin O/0/1/I para evitar confusión al dictarlo por teléfono. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SUFFIX_LENGTH = 6;
const MAX_RETRIES = 8;

/** `MV-YYMMDD-XXXXXX` — el sufijo es aleatorio criptográfico. */
export function generateOrderNumber(): string {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");

    let suffix = "";
    for (let i = 0; i < SUFFIX_LENGTH; i++) {
        suffix += ALPHABET[randomInt(0, ALPHABET.length)];
    }

    return `MV-${y}${m}${d}-${suffix}`;
}

/**
 * Igual que `generateOrderNumber` pero comprobando que no exista ya en `orders`.
 * Tras agotar los reintentos añade un carácter extra en vez de fallar: es
 * preferible un número más largo a perder el pedido.
 *
 * `generator` permite reutilizar la garantía de unicidad con otro formato — el
 * flujo móvil usa `generatePublicCode()` (`MV-XXXXX`) y no queremos cambiarle el
 * formato al que ya muestra la app.
 */
export async function generateUniqueOrderNumber(
    generator: () => string = generateOrderNumber,
): Promise<string> {
    // Import diferido: `lib/db` lanza al cargarse si faltan las variables de
    // Turso, y así `generateOrderNumber` queda importable sin base de datos
    // (tests incluidos).
    const [{ db }, { orders }, { eq }] = await Promise.all([
        import("@/lib/db"),
        import("@/lib/db/schema"),
        import("drizzle-orm"),
    ]);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const candidate = generator();
        const existing = await db.query.orders.findFirst({
            where: eq(orders.orderNumber, candidate),
            columns: { id: true },
        });
        if (!existing) return candidate;
    }
    return `${generator()}${ALPHABET[randomInt(0, ALPHABET.length)]}`;
}
