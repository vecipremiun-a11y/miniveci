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

function getConfig(): { url: string; token: string } | null {
    const url = process.env.POSVECI_PREORDERS_URL;
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
