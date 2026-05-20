/**
 * Helpers de Amasandería:
 *  - Cálculo de precios (autoridad final server-side)
 *  - Configuración (parseo de la tabla bakery_config)
 *  - Validación de scheduled_for (anticipación, día cerrado, slot válido)
 *  - Serialización a camelCase para clientes (web + Flutter)
 *  - Generación de public_code corto
 *  - Transiciones de estado válidas
 */
import { db } from "@/lib/db";
import { bakeryConfig, bakeryProducts } from "@/lib/db/schema";
import type { BakeryCategory, BakeryStatus } from "@/lib/validations/bakery";

// --- PRECIOS ---

/**
 * Calcula el subtotal de una línea según el pricing_mode del producto.
 * Toda esta lógica corre en el server: NUNCA confiar en lo que envíe el cliente.
 */
export function calcItemSubtotal(product: {
    pricingMode: "unit" | "kg";
    price: number;
    gramsPerUnit: number | null;
}, quantity: number): number {
    if (product.pricingMode === "unit") {
        return product.price * quantity;
    }
    // 'kg': peso total = quantity * gramsPerUnit
    const grams = quantity * (product.gramsPerUnit ?? 0);
    const kg = grams / 1000;
    return Math.round(kg * product.price);
}

// --- CONFIGURACIÓN ---

export interface BakeryConfig {
    minHoursAhead: number;
    maxDaysAhead: number;
    closedWeekdays: number[]; // 1=lunes ... 7=domingo (ISO)
    openHour: number;
    closeHour: number;
    slotMinutes: number;
    offersDelivery: boolean;
    deliveryFee: number;
}

const DEFAULT_CONFIG: BakeryConfig = {
    minHoursAhead: 12,
    maxDaysAhead: 14,
    closedWeekdays: [],
    openHour: 7,
    closeHour: 20,
    slotMinutes: 30,
    offersDelivery: true,
    deliveryFee: 1500,
};

export async function loadBakeryConfig(): Promise<BakeryConfig> {
    const rows = await db.select().from(bakeryConfig);
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const num = (k: string, def: number) => {
        const v = map.get(k);
        if (!v) return def;
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : def;
    };
    const bool = (k: string, def: boolean) => {
        const v = map.get(k);
        if (v == null) return def;
        return v === "true" || v === "1";
    };
    const json = <T,>(k: string, def: T): T => {
        const v = map.get(k);
        if (!v) return def;
        try { return JSON.parse(v) as T; } catch { return def; }
    };
    return {
        minHoursAhead: num("min_hours_ahead", DEFAULT_CONFIG.minHoursAhead),
        maxDaysAhead: num("max_days_ahead", DEFAULT_CONFIG.maxDaysAhead),
        closedWeekdays: json<number[]>("closed_weekdays", DEFAULT_CONFIG.closedWeekdays),
        openHour: num("open_hour", DEFAULT_CONFIG.openHour),
        closeHour: num("close_hour", DEFAULT_CONFIG.closeHour),
        slotMinutes: num("slot_minutes", DEFAULT_CONFIG.slotMinutes),
        offersDelivery: bool("offers_delivery", DEFAULT_CONFIG.offersDelivery),
        deliveryFee: num("delivery_fee", DEFAULT_CONFIG.deliveryFee),
    };
}

// --- FECHAS Y SLOTS ---

/** ISO weekday: 1=lunes ... 7=domingo (JS getDay: 0=domingo). */
export function isoWeekday(d: Date): number {
    const js = d.getDay();
    return js === 0 ? 7 : js;
}

/** Genera los slots de un día en formato "HH:mm". */
export function generateSlots(cfg: BakeryConfig): string[] {
    const out: string[] = [];
    const totalMinStart = cfg.openHour * 60;
    const totalMinEnd = cfg.closeHour * 60;
    for (let m = totalMinStart; m < totalMinEnd; m += cfg.slotMinutes) {
        const hh = Math.floor(m / 60).toString().padStart(2, "0");
        const mm = (m % 60).toString().padStart(2, "0");
        out.push(`${hh}:${mm}`);
    }
    return out;
}

/** Filtra slots respetando la anticipación mínima si la fecha es hoy. */
export function availableSlotsForDate(dateYYYYMMDD: string, cfg: BakeryConfig, now: Date = new Date()): { ok: boolean; reason?: string; slots: string[] } {
    // Parsea como local-date al mediodía para evitar TZ shifts
    const [y, m, d] = dateYYYYMMDD.split("-").map((x) => parseInt(x, 10));
    if (!y || !m || !d) return { ok: false, reason: "Fecha inválida", slots: [] };
    const day = new Date(y, m - 1, d, 12, 0, 0);

    // Rango permitido
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const diffDays = Math.round((day.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return { ok: false, reason: "Fecha en el pasado", slots: [] };
    if (diffDays > cfg.maxDaysAhead) return { ok: false, reason: `Máximo ${cfg.maxDaysAhead} días a futuro`, slots: [] };

    // Día cerrado
    if (cfg.closedWeekdays.includes(isoWeekday(day))) {
        return { ok: false, reason: "Día cerrado", slots: [] };
    }

    const allSlots = generateSlots(cfg);
    const minMs = now.getTime() + cfg.minHoursAhead * 3600 * 1000;
    const filtered = allSlots.filter((slot) => {
        const [hh, mm] = slot.split(":").map((x) => parseInt(x, 10));
        const ts = new Date(y, m - 1, d, hh, mm).getTime();
        return ts >= minMs;
    });
    return { ok: true, slots: filtered };
}

/** Verifica que un ISO scheduled_for sea válido según config + ahora. */
export function validateScheduledFor(isoString: string, cfg: BakeryConfig, now: Date = new Date()): { ok: true } | { ok: false; reason: string } {
    const dt = new Date(isoString);
    if (Number.isNaN(dt.getTime())) return { ok: false, reason: "scheduled_for inválido" };

    // Anticipación mínima
    const minMs = now.getTime() + cfg.minHoursAhead * 3600 * 1000;
    if (dt.getTime() < minMs) return { ok: false, reason: `Anticipación mínima de ${cfg.minHoursAhead}h` };

    // Máximo de días
    const maxMs = now.getTime() + cfg.maxDaysAhead * 86400 * 1000;
    if (dt.getTime() > maxMs) return { ok: false, reason: `Máximo ${cfg.maxDaysAhead} días a futuro` };

    // Día cerrado
    if (cfg.closedWeekdays.includes(isoWeekday(dt))) return { ok: false, reason: "Día cerrado" };

    // Slot válido (debe caer dentro del horario y en múltiplo de slotMinutes)
    const hh = dt.getHours();
    const mm = dt.getMinutes();
    if (hh < cfg.openHour || hh >= cfg.closeHour) return { ok: false, reason: "Fuera del horario" };
    if (mm % cfg.slotMinutes !== 0) return { ok: false, reason: "Hora no coincide con un slot válido" };

    return { ok: true };
}

// --- TRANSICIONES DE ESTADO ---

const ALLOWED_TRANSITIONS: Record<BakeryStatus, BakeryStatus[]> = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    // ready puede ir a delivered (pickup) o out_for_delivery (delivery).
    // El validador permite ambas; POSVECI elige la correcta según el método.
    ready: ["out_for_delivery", "delivered", "cancelled"],
    out_for_delivery: ["delivered", "cancelled"],
    delivered: [],
    cancelled: [],
};

export function canTransition(from: BakeryStatus, to: BakeryStatus): boolean {
    if (from === to) return false;
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

// --- PUBLIC CODE ---

const PUBLIC_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O/0/1/I para evitar confusión

export function generatePublicCode(length = 5): string {
    let out = "";
    const buf = new Uint8Array(length);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(buf);
    } else {
        for (let i = 0; i < length; i++) buf[i] = Math.floor(Math.random() * 256);
    }
    for (let i = 0; i < length; i++) {
        out += PUBLIC_CODE_ALPHABET[buf[i] % PUBLIC_CODE_ALPHABET.length];
    }
    return `MV-${out}`;
}

// --- MAPPERS camelCase para clientes ---

export function serializeProduct(p: typeof bakeryProducts.$inferSelect) {
    return {
        id: p.id,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        category: p.category as BakeryCategory,
        pricingMode: p.pricingMode as "unit" | "kg",
        price: p.price,
        gramsPerUnit: p.gramsPerUnit,
        allowsNotes: !!p.allowsNotes,
        active: !!p.active,
        sortOrder: p.sortOrder ?? 0,
    };
}

export interface SerializedOrderItem {
    id: string;
    productId: string;
    productName: string;
    pricingMode: "unit" | "kg";
    unitPrice: number;
    gramsPerUnit: number | null;
    quantity: number;
    notes: string | null;
    subtotal: number;
}

export interface SerializedOrder {
    id: string;
    publicCode: string;
    userId: string;
    scheduledFor: string;
    method: "pickup" | "delivery";
    address: string | null;
    generalNotes: string | null;
    status: BakeryStatus;
    items: SerializedOrderItem[];
    subtotal: number;
    deliveryFee: number;
    total: number;
    contactPhone: string | null;
    createdAt: string;
    updatedAt: string;
}

export function serializeOrder(
    o: { id: string; publicCode: string; userId: string; scheduledFor: string; method: string; address: string | null; generalNotes: string | null; status: string; subtotal: number; deliveryFee: number; total: number; contactPhone: string | null; createdAt: string; updatedAt: string },
    items: Array<{ id: string; productId: string; productName: string; pricingMode: string; unitPrice: number; gramsPerUnit: number | null; quantity: number; notes: string | null; subtotal: number }>,
): SerializedOrder {
    return {
        id: o.id,
        publicCode: o.publicCode,
        userId: o.userId,
        scheduledFor: o.scheduledFor,
        method: o.method as "pickup" | "delivery",
        address: o.address,
        generalNotes: o.generalNotes,
        status: o.status as BakeryStatus,
        items: items.map((it) => ({
            id: it.id,
            productId: it.productId,
            productName: it.productName,
            pricingMode: it.pricingMode as "unit" | "kg",
            unitPrice: it.unitPrice,
            gramsPerUnit: it.gramsPerUnit,
            quantity: it.quantity,
            notes: it.notes,
            subtotal: it.subtotal,
        })),
        subtotal: o.subtotal,
        deliveryFee: o.deliveryFee,
        total: o.total,
        contactPhone: o.contactPhone,
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
    };
}
