/**
 * Cliente outbound hacia POSVECI.
 *
 * Cuando se crea un encargo de amasandería en miniveci, publicamos el evento a
 * POSVECI vía `POST <POSVECI_PREORDERS_URL>` con Bearer auth. Si POSVECI no está
 * configurado (env vars vacías) o falla, NO bloqueamos la creación del encargo
 * — log y seguir. La fuente de verdad sigue siendo miniveci; POSVECI puede
 * resincronizar con `GET /api/pos/bakery/orders?since=...`.
 *
 * Endpoints POSVECI (definidos por su equipo):
 *   POST  <POSVECI_PREORDERS_URL>                    → crear preorder
 *   PATCH <POSVECI_PREORDERS_URL>                    → cancelar preorder
 *
 * Env vars:
 *   POSVECI_PREORDERS_URL    URL completa al endpoint POSVECI
 *   POSVECI_BEARER_TOKEN     Token Bearer que POSVECI emitió
 */

import type { SerializedOrder } from "@/lib/bakery";

const TIMEOUT_MS = 5000;

interface PreorderItemPayload {
    product_external_id: string | null;
    product_name: string;
    pricing_mode: "unit" | "kg";
    unit_price: number;
    grams_per_unit: number | null;
    quantity: number;
    notes: string | null;
    line_subtotal: number;
}

interface PreorderClient {
    external_id: string;
    name: string;
    phone: string;
    email: string | null;
    rut: string | null;
}

interface PreorderCreatedPayload {
    external_order_id: string;
    public_code: string;
    scheduled_for: string;
    method: "pickup" | "delivery";
    address: string | null;
    general_notes: string | null;
    client: PreorderClient;
    items: PreorderItemPayload[];
    subtotal: number;
    delivery_fee: number;
    total: number;
    payment_method: "pending_on_pickup";
    occurred_at: string;
}

interface PreorderCancelledPayload {
    external_order_id: string;
    status: "canceled";
    reason?: string;
    occurred_at: string;
}

// --- Pedidos normales de tienda (order_type: "store") ---
// POSVECI acepta los pedidos de tienda por el MISMO endpoint de preorders,
// distinguidos con `order_type: "store"`. A diferencia de los encargos:
// scheduled_for es opcional y payment_method es el método real del checkout.

export interface StoreOrderItemPayload {
    product_external_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    line_subtotal: number;
}

export interface StoreOrderClientPayload {
    external_id: string | null;
    name: string;
    phone: string | null;
    email: string | null;
    rut: string | null;
}

export interface StoreOrderCreatedPayload {
    external_order_id: string;
    public_code: string;
    order_type: "store";
    payment_method: "webpay" | "transferencia" | "contra_entrega";
    method: "pickup" | "delivery";
    address: string | null;
    delivery_fee: number;
    client: StoreOrderClientPayload;
    items: StoreOrderItemPayload[];
    subtotal: number;
    total: number;
    scheduled_for?: string; // ISO 8601 — solo si el cliente eligió horario
    occurred_at: string;
}

/**
 * Una dirección de la libreta del cliente, tal como la espera POSVECI.
 *
 * `external_address_id` es la llave de emparejamiento: POSVECI upsertea por ese
 * id dentro del cliente, así que cambiar el texto de una dirección la actualiza
 * en vez de duplicarla. Nombres en español (`comuna`, `ciudad`, `notes`) porque
 * así los definió POSVECI para su endpoint de clientes.
 */
export interface ClientAddressPayload {
    external_address_id: string;
    label: string;
    address: string;
    comuna: string | null;
    ciudad: string | null;
    notes: string | null;
    is_default: boolean;
}

interface ClientUpsertPayload {
    external_id: string; // ID de la cuenta en miniveci — llave maestra permanente
    name: string;
    rut: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    /**
     * Libreta COMPLETA del cliente. POSVECI reemplaza la suya con esta lista:
     * las que no vengan, las borra. Por eso el campo se omite (no se manda lista
     * vacía) cuando no hay nada que mandar — ausente significa "no toques la
     * libreta", y una lista vacía significaría "este cliente no tiene ninguna".
     */
    addresses?: ClientAddressPayload[];
}

/** Fila de `customer_addresses` (solo lo que viaja a POSVECI). */
export interface AddressBookRow {
    id: string;
    label: string | null;
    address: string;
    comuna: string | null;
    city: string | null;
    addressNotes: string | null;
    isDefault: boolean | null;
}

/** Dirección legacy del perfil (`customers.address` y sus columnas hermanas). */
export interface LegacyProfileAddress {
    address: string | null;
    comuna: string | null;
    city: string | null;
    addressNotes: string | null;
}

/** Trim + null si queda vacío. */
function clean(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/** "Videla 1430, La Cisterna" — el formato de una línea que ya usan los pedidos. */
function oneLine(address: string, comuna: string | null): string {
    return [address, comuna].filter(Boolean).join(", ");
}

/**
 * Arma `address` (la principal, en una línea) y `addresses` (la libreta completa)
 * para el upsert de cliente.
 *
 * Reglas:
 *  - Con libreta: viaja entera. La principal es la marcada `isDefault`; si
 *    ninguna lo está, la primera (orden de creación). Exactamente una queda con
 *    `is_default: true`, porque POSVECI la usa para despacho e impresión.
 *  - Sin libreta pero con `customers.address`: viaja esa sola como principal,
 *    con un id sintético estable (`legacy:<customerId>`) para que POSVECI la
 *    empareje igual. Cuando el cliente cree su primera dirección real, la legacy
 *    deja de venir en la lista y POSVECI la borra — que es lo correcto.
 *  - Sin libreta y sin dirección legacy: `addresses` se omite.
 */
export function buildClientAddresses(
    customerId: string,
    book: AddressBookRow[],
    legacy: LegacyProfileAddress,
): { address: string | null; addresses?: ClientAddressPayload[] } {
    if (book.length > 0) {
        const defaultIdx = book.findIndex((row) => row.isDefault === true);
        const principalIdx = defaultIdx >= 0 ? defaultIdx : 0;

        const addresses: ClientAddressPayload[] = book.map((row, i) => ({
            external_address_id: row.id,
            label: clean(row.label) ?? "Casa",
            address: row.address.trim(),
            comuna: clean(row.comuna),
            ciudad: clean(row.city),
            notes: clean(row.addressNotes),
            is_default: i === principalIdx,
        }));

        const principal = addresses[principalIdx];
        return { address: oneLine(principal.address, principal.comuna), addresses };
    }

    const legacyAddress = clean(legacy.address);
    if (!legacyAddress) return { address: null };

    const legacyComuna = clean(legacy.comuna);
    return {
        address: oneLine(legacyAddress, legacyComuna),
        addresses: [{
            external_address_id: `legacy:${customerId}`,
            label: "Casa",
            address: legacyAddress,
            comuna: legacyComuna,
            ciudad: clean(legacy.city),
            notes: clean(legacy.addressNotes),
            is_default: true,
        }],
    };
}

function getConfig(): { url: string; token: string } | null {
    const url = process.env.POSVECI_PREORDERS_URL;
    const token = process.env.POSVECI_BEARER_TOKEN;
    if (!url || !token) return null;
    return { url, token };
}

function getClientsConfig(): { url: string; token: string } | null {
    const url = process.env.POSVECI_CLIENTS_URL;
    const token = process.env.POSVECI_BEARER_TOKEN;
    if (!url || !token) return null;
    return { url, token };
}

async function sendWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response | null> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: ctl.signal });
    } catch (err) {
        console.error("[POSVECI] fetch error:", (err as Error).message);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Publica un preorder recién creado a POSVECI.
 * No bloquea si POSVECI no está configurado o falla.
 *
 * POSVECI usa el objeto `client` para dedupear contra su tabla de clientes
 * por `external_id > rut > phone` (en ese orden). Mandamos siempre todo lo
 * que tengamos en `customers`; ellos deciden si crear o vincular.
 */
export async function publishPreorderCreated(
    order: SerializedOrder,
    client: { externalId: string; name: string; phone: string; email: string | null; rut: string | null },
): Promise<void> {
    const cfg = getConfig();
    if (!cfg) {
        console.log("[POSVECI] env vars no configuradas, omitiendo publish de preorder");
        return;
    }

    const payload: PreorderCreatedPayload = {
        external_order_id: order.id,
        public_code: order.publicCode,
        scheduled_for: order.scheduledFor,
        method: order.method,
        address: order.address,
        general_notes: order.generalNotes,
        client: {
            external_id: client.externalId,
            name: client.name,
            phone: client.phone,
            email: client.email,
            rut: client.rut,
        },
        items: order.items.map((it) => ({
            product_external_id: null, // futuro: mapping en bakery_products.posExternalId
            product_name: it.productName,
            pricing_mode: it.pricingMode,
            unit_price: it.unitPrice,
            grams_per_unit: it.gramsPerUnit,
            quantity: it.quantity,
            notes: it.notes,
            line_subtotal: it.subtotal,
        })),
        subtotal: order.subtotal,
        delivery_fee: order.deliveryFee,
        total: order.total,
        payment_method: "pending_on_pickup",
        occurred_at: new Date().toISOString(),
    };

    const res = await sendWithTimeout(cfg.url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${cfg.token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    }, TIMEOUT_MS);

    if (!res) {
        console.error("[POSVECI] POST timeout/network error para", order.publicCode);
        return;
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`[POSVECI] POST falló ${res.status} para ${order.publicCode}:`, text.slice(0, 300));
        return;
    }
    console.log(`[POSVECI] preorder ${order.publicCode} publicado OK`);
}

/**
 * Notifica a POSVECI que un preorder fue cancelado desde miniveci.
 * No publica si la cancelación se originó en POSVECI (eso lo decide el handler que llama).
 */
export async function publishPreorderCancelled(
    externalOrderId: string,
    reason?: string,
): Promise<void> {
    const cfg = getConfig();
    if (!cfg) {
        console.log("[POSVECI] env vars no configuradas, omitiendo publish de cancellation");
        return;
    }

    const payload: PreorderCancelledPayload = {
        external_order_id: externalOrderId,
        status: "canceled",
        ...(reason ? { reason } : {}),
        occurred_at: new Date().toISOString(),
    };

    const res = await sendWithTimeout(cfg.url, {
        method: "PATCH",
        headers: {
            "Authorization": `Bearer ${cfg.token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    }, TIMEOUT_MS);

    if (!res) {
        console.error("[POSVECI] PATCH timeout/network error para", externalOrderId);
        return;
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`[POSVECI] PATCH falló ${res.status} para ${externalOrderId}:`, text.slice(0, 300));
        return;
    }
    console.log(`[POSVECI] cancellation ${externalOrderId} publicada OK`);
}

/** Pausa `ms` milisegundos (para el backoff entre reintentos). */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Delays entre intentos del POST de pedidos store (el endpoint es idempotente
 * por external_order_id, así que reenviar es seguro). */
const STORE_RETRY_DELAYS_MS = [2000, 5000];

/**
 * Publica un pedido normal de tienda a POSVECI (order_type: "store").
 *
 * Mismo endpoint y Bearer que los encargos. Reintenta con backoff ante error
 * de red o 5xx (idempotente por external_order_id). Respuestas:
 *   201 {success:true, preorder:{...}}   → OK
 *   200 {success:true, duplicate:true}   → ya enviado, tratar como éxito
 *   4xx                                  → error definitivo, no reintentar
 * Best-effort: si POSVECI no está configurado o falla definitivamente,
 * log y seguir — nunca bloquea la creación del pedido en miniveci.
 */
export async function publishStoreOrderCreated(payload: StoreOrderCreatedPayload): Promise<void> {
    const cfg = getConfig();
    if (!cfg) {
        console.log("[POSVECI] env vars no configuradas, omitiendo publish de pedido store");
        return;
    }

    const init: RequestInit = {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${cfg.token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    };

    const maxAttempts = STORE_RETRY_DELAYS_MS.length + 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const res = await sendWithTimeout(cfg.url, init, TIMEOUT_MS);

        if (res && res.ok) {
            console.log(`[POSVECI] pedido store ${payload.public_code} publicado OK (intento ${attempt})`);
            return;
        }
        if (res && res.status < 500) {
            // 4xx: reenviar no lo va a arreglar
            const text = await res.text().catch(() => "");
            console.error(`[POSVECI] pedido store ${payload.public_code} rechazado ${res.status}:`, text.slice(0, 300));
            return;
        }

        // Red/timeout o 5xx → reintentar con backoff
        const detail = res ? `HTTP ${res.status}` : "timeout/red";
        if (attempt < maxAttempts) {
            const delay = STORE_RETRY_DELAYS_MS[attempt - 1];
            console.warn(`[POSVECI] pedido store ${payload.public_code} falló (${detail}), reintento ${attempt + 1}/${maxAttempts} en ${delay}ms`);
            await sleep(delay);
        } else {
            console.error(`[POSVECI] pedido store ${payload.public_code} falló definitivamente tras ${maxAttempts} intentos (${detail})`);
        }
    }
}

/**
 * Crea/actualiza un cliente en POSVECI por `external_id` (= ID de cuenta miniveci).
 *
 * El ID de miniveci es la llave maestra permanente: POSVECI hace UPSERT por
 * external_id. Llamar al registrar la cuenta, en cada edición de perfil
 * (rut/email/teléfono/nombre/dirección) y cada vez que cambia la libreta de
 * direcciones. Best-effort: si POSVECI no está configurado o falla, no bloquea
 * — log y seguir.
 *
 * La sincronización es en un solo sentido: miniveci manda, POSVECI copia.
 */
export async function publishClientUpsert(client: {
    externalId: string;
    name: string;
    rut: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    addresses?: ClientAddressPayload[];
}): Promise<void> {
    const cfg = getClientsConfig();
    if (!cfg) {
        console.log("[POSVECI] POSVECI_CLIENTS_URL no configurado, omitiendo upsert de cliente");
        return;
    }

    const payload: ClientUpsertPayload = {
        external_id: client.externalId,
        name: client.name,
        rut: client.rut,
        phone: client.phone,
        email: client.email,
        address: client.address,
        // Ausente ≠ lista vacía: solo mandamos la llave si hay libreta que copiar.
        ...(client.addresses ? { addresses: client.addresses } : {}),
    };

    const res = await sendWithTimeout(cfg.url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${cfg.token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    }, TIMEOUT_MS);

    if (!res) {
        console.error("[POSVECI] client upsert timeout/network error para", client.externalId);
        return;
    }
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`[POSVECI] client upsert falló ${res.status} para ${client.externalId}:`, text.slice(0, 300));
        return;
    }
    const libreta = client.addresses ? `, ${client.addresses.length} dirección(es)` : "";
    console.log(`[POSVECI] cliente ${client.externalId} sincronizado OK${libreta}`);
}
