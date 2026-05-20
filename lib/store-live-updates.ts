import { EventEmitter } from "node:events";

/**
 * Pub/sub en memoria para eventos de pedidos de Tienda (admin).
 * Mismo patrón que lib/bakery-live-updates.ts.
 * Single-instance: si se escala a múltiples procesos migrar a Upstash Redis
 * pub/sub o Vercel KV.
 */

export interface SerializedStoreOrderItem {
    id: string;
    productId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

export interface SerializedStoreOrder {
    id: string;
    orderNumber: string;
    customerId: string | null;
    customerName: string;
    customerEmail: string;
    customerPhone: string | null;
    method: "pickup" | "delivery";
    address: string | null;
    shippingNotes: string | null;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    subtotal: number;
    shippingCost: number;
    total: number;
    items: SerializedStoreOrderItem[];
    createdAt: string;
    source?: "web" | "mobile";
}

export type StoreOrderEvent =
    | { type: "order.created"; order: SerializedStoreOrder; occurredAt: string }
    | { type: "order.status_changed"; orderId: string; orderNumber: string; status: string; previousStatus: string; occurredAt: string };

const STORE_ORDER_EVENT = "store-order-event";

declare global {
    // eslint-disable-next-line no-var
    var __storeLiveUpdatesEmitter: EventEmitter | undefined;
}

function getEmitter() {
    if (!globalThis.__storeLiveUpdatesEmitter) {
        globalThis.__storeLiveUpdatesEmitter = new EventEmitter();
        globalThis.__storeLiveUpdatesEmitter.setMaxListeners(1000);
    }
    return globalThis.__storeLiveUpdatesEmitter;
}

export function subscribeToStoreOrderEvents(listener: (event: StoreOrderEvent) => void) {
    const emitter = getEmitter();
    emitter.on(STORE_ORDER_EVENT, listener);
    return () => emitter.off(STORE_ORDER_EVENT, listener);
}

export function publishStoreOrderEvent(event: StoreOrderEvent) {
    getEmitter().emit(STORE_ORDER_EVENT, event);
}
