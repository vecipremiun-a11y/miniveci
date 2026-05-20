import { EventEmitter } from "node:events";
import type { SerializedOrder } from "@/lib/bakery";

/**
 * Pub/sub en memoria para eventos de Amasandería (admin).
 * Single-instance: si se escala a múltiples procesos hay que migrar a
 * Upstash Redis pub/sub o Vercel KV.
 */

export type BakeryEvent =
    | { type: "order.created"; order: SerializedOrder; occurredAt: string }
    | { type: "order.status_changed"; orderId: string; publicCode: string; status: string; previousStatus: string; occurredAt: string };

const BAKERY_EVENT = "bakery-event";

declare global {
    // eslint-disable-next-line no-var
    var __bakeryLiveUpdatesEmitter: EventEmitter | undefined;
}

function getEmitter() {
    if (!globalThis.__bakeryLiveUpdatesEmitter) {
        globalThis.__bakeryLiveUpdatesEmitter = new EventEmitter();
        globalThis.__bakeryLiveUpdatesEmitter.setMaxListeners(1000);
    }
    return globalThis.__bakeryLiveUpdatesEmitter;
}

export function subscribeToBakeryEvents(listener: (event: BakeryEvent) => void) {
    const emitter = getEmitter();
    emitter.on(BAKERY_EVENT, listener);
    return () => emitter.off(BAKERY_EVENT, listener);
}

export function publishBakeryEvent(event: BakeryEvent) {
    getEmitter().emit(BAKERY_EVENT, event);
}
