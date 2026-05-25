/**
 * Matching de clientes para encargos presenciales empujados desde POSVECI.
 *
 * Cuando POSVECI manda un encargo, intentamos vincularlo a un customer existente
 * usando los identificadores que vengan poblados. Si ninguno matchea, el encargo
 * se guarda como "guest order" (userId = '__guest__') con los identificadores
 * almacenados en `guest_rut/email/phone/name`. Cuando el cliente luego se
 * registra o edita su perfil agregando alguno de esos identificadores, el
 * proceso de claim (`claimUnclaimedOrdersForCustomer`) reasigna esas órdenes
 * a su cuenta.
 *
 * Prioridad de match (primer hit gana):
 *   1. external_id (customers.id directo) — la llave maestra; una vez enlazado por
 *      ID, la identidad queda resuelta y no se vuelve a buscar por rut/email.
 *   2. RUT  — llave más confiable en Chile (único por ley)
 *   3. email (lowercase)
 *
 * El teléfono NO es llave de identidad (poco confiable: compartido/reciclado).
 * Se guarda como dato en la orden pero no enlaza cuentas. El nombre tampoco
 * se usa para matchear: es ambiguo.
 */
import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, bakeryOrders, BAKERY_GUEST_USER_ID } from "@/lib/db/schema";
import { publishClientUpsert } from "@/lib/posveci-publisher";

// --- Normalizadores ---

/** Email: trim + lowercase. Devuelve null si queda vacío. */
export function normalizeEmail(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const v = raw.trim().toLowerCase();
    return v.length > 0 ? v : null;
}

/**
 * RUT chileno: quita puntos, espacios, guiones; pasa el DV a mayúscula.
 * Ejemplos:
 *   "12.345.678-9"  → "123456789"
 *   "12.345.678-k"  → "12345678K"
 *   "  12345678-9 " → "123456789"
 * No valida el dígito verificador — solo normaliza para comparar.
 */
export function normalizeRut(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const v = raw.replace(/[.\s-]/g, "").toUpperCase();
    if (v.length < 2) return null;
    return v;
}

/**
 * Teléfono: solo dígitos, conservando '+' inicial si viene.
 * Si llega un número chileno sin código país (8-9 dígitos), le agrega "+56".
 * Ejemplos:
 *   "+56 9 1234 5678" → "+56912345678"
 *   "9 1234 5678"     → "+56912345678"
 *   "912345678"       → "+56912345678"
 *   "22345678"        → "+5622345678"  (fijo)
 *
 * Normalizamos para que match contra customers.phone funcione aunque uno haya
 * sido tipeado con espacios y el otro sin.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const hasPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");
    if (!digits) return null;
    if (hasPlus) return `+${digits}`;
    // Asumir Chile si no hay código país y largo razonable
    if (digits.length === 9 || digits.length === 8) return `+56${digits}`;
    if (digits.length === 11 && digits.startsWith("56")) return `+${digits}`;
    return `+${digits}`;
}

// --- Match ---

export interface PosClientInput {
    externalId?: string | null;
    rut?: string | null;
    phone?: string | null;
    email?: string | null;
    name?: string | null;
}

export interface MatchedCustomer {
    customerId: string;
    matchedBy: "external_id" | "rut" | "email";
}

/**
 * Intenta encontrar un customer con cualquiera de los identificadores recibidos.
 * No crea nada; devuelve null si no hay match. El teléfono no se usa para match.
 */
export async function matchCustomerFromPos(client: PosClientInput): Promise<MatchedCustomer | null> {
    // 1. external_id directo (llave maestra — identidad ya resuelta)
    if (client.externalId) {
        const c = await db.query.customers.findFirst({
            where: eq(customers.id, client.externalId),
            columns: { id: true },
        });
        if (c) return { customerId: c.id, matchedBy: "external_id" };
    }

    // 2. RUT (normalizamos ambos lados — DB puede tener "12.345.678-9" o "123456789")
    const rutNorm = normalizeRut(client.rut);
    if (rutNorm) {
        // No podemos normalizar en SQL fácilmente, así que traemos candidatos con RUT
        // y filtramos en JS — no escala a miles, pero la base es pequeña (panadería local).
        const candidates = await db
            .select({ id: customers.id, rut: customers.rut })
            .from(customers)
            .where(eq(customers.active, true));
        const hit = candidates.find((c) => c.rut && normalizeRut(c.rut) === rutNorm);
        if (hit) return { customerId: hit.id, matchedBy: "rut" };
    }

    // 3. Email
    const emailNorm = normalizeEmail(client.email);
    if (emailNorm) {
        const c = await db.query.customers.findFirst({
            where: eq(customers.email, emailNorm),
            columns: { id: true },
        });
        if (c) return { customerId: c.id, matchedBy: "email" };
    }

    return null;
}

/**
 * ¿Existe OTRA cuenta (distinta de excludeId) con este RUT? Usado para enforcar
 * RUT único por tienda en registro y edición de perfil. Compara normalizado.
 */
export async function rutTakenByOtherCustomer(rut: string, excludeId?: string): Promise<boolean> {
    const rutNorm = normalizeRut(rut);
    if (!rutNorm) return false;
    const candidates = await db
        .select({ id: customers.id, rut: customers.rut })
        .from(customers)
        .where(eq(customers.active, true));
    return candidates.some((c) => c.rut && normalizeRut(c.rut) === rutNorm && c.id !== excludeId);
}

// --- Claim (deferred) ---

/**
 * Cuando un customer se crea o actualiza su RUT o email, llamamos esto para
 * reasignar guest orders que matcheen.
 *
 * Match por orden de prioridad: RUT → email. El teléfono NO reclama (no es llave
 * de identidad). Una vez reclamado (unclaimed=false), no se vuelve a tocar:
 * la identidad ya quedó resuelta por ID. Operación idempotente.
 *
 * Devuelve la lista de publicCodes reclamados (para logging).
 */
export async function claimUnclaimedOrdersForCustomer(customerId: string): Promise<string[]> {
    const customer = await db.query.customers.findFirst({
        where: eq(customers.id, customerId),
        columns: { id: true, rut: true, email: true },
    });
    if (!customer) return [];

    const rutNorm = normalizeRut(customer.rut);
    const emailNorm = normalizeEmail(customer.email);

    if (!rutNorm && !emailNorm) return [];

    // Buscar guest orders que matcheen por RUT o email normalizado.
    const matchConds = [];
    if (rutNorm) matchConds.push(eq(bakeryOrders.guestRut, rutNorm));
    if (emailNorm) matchConds.push(eq(bakeryOrders.guestEmail, emailNorm));

    const candidates = await db
        .select({ id: bakeryOrders.id, publicCode: bakeryOrders.publicCode })
        .from(bakeryOrders)
        .where(and(eq(bakeryOrders.unclaimed, true), or(...matchConds)));

    if (candidates.length === 0) return [];

    const now = new Date().toISOString();
    const claimed: string[] = [];
    for (const c of candidates) {
        await db.update(bakeryOrders)
            .set({
                userId: customerId,
                unclaimed: false,
                updatedAt: now,
            })
            .where(eq(bakeryOrders.id, c.id));
        claimed.push(c.publicCode);
    }

    if (claimed.length > 0) {
        console.log(`[CLAIM] customer ${customerId.slice(0, 8)}... reclamó ${claimed.length} encargo(s): ${claimed.join(", ")}`);
    }

    return claimed;
}

/**
 * Carga el customer y lo sincroniza a POSVECI (upsert por ID maestro).
 * Best-effort: nunca lanza — loguea y sigue. Llamar al registrar y al editar perfil.
 */
export async function syncCustomerToPosveci(customerId: string): Promise<void> {
    try {
        const c = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });
        if (!c) return;
        await publishClientUpsert({
            externalId: c.id,
            name: `${c.firstName} ${c.lastName ?? ""}`.trim() || c.email,
            rut: c.rut ?? null,
            phone: c.phone || null,
            email: c.email,
            address: c.address ?? null,
        });
    } catch (err) {
        console.error(`[POSVECI] syncCustomerToPosveci threw para ${customerId}:`, (err as Error).message);
    }
}

// Re-export para imports limpios desde el endpoint POST
export { BAKERY_GUEST_USER_ID };
