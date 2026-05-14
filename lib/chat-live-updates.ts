import { EventEmitter } from "node:events";

/**
 * Pub/sub en memoria para eventos de chat. Mismo patrón que product-live-updates.
 * Single-instance: si se escala a múltiples procesos hay que migrar a Redis pub/sub
 * o al canal realtime de Turso.
 */

export type ChatEventType =
    | "message-created"
    | "conversation-updated"
    | "conversation-created";

export interface ChatMessagePayload {
    id: string;
    conversationId: string;
    senderType: "customer" | "agent" | "system";
    senderId: string | null;
    senderName: string | null;
    body: string;
    createdAt: string;
}

export interface ChatConversationPayload {
    id: string;
    customerId: string | null;
    guestId: string | null;
    guestName: string | null;
    guestEmail: string | null;
    assignedOperatorId: string | null;
    status: "open" | "closed";
    lastMessageAt: string | null;
    lastMessagePreview: string | null;
    unreadCustomer: number;
    unreadAgent: number;
    createdAt: string;
    customer?: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string | null;
    } | null;
}

export interface ChatEvent {
    type: ChatEventType;
    conversationId: string;
    message?: ChatMessagePayload;
    conversation?: ChatConversationPayload;
    occurredAt: string;
}

const CHAT_EVENT = "chat-event";

declare global {
    // eslint-disable-next-line no-var
    var __chatLiveUpdatesEmitter: EventEmitter | undefined;
}

function getEmitter() {
    if (!globalThis.__chatLiveUpdatesEmitter) {
        globalThis.__chatLiveUpdatesEmitter = new EventEmitter();
        globalThis.__chatLiveUpdatesEmitter.setMaxListeners(500);
    }
    return globalThis.__chatLiveUpdatesEmitter;
}

export function subscribeToChatEvents(listener: (event: ChatEvent) => void) {
    const emitter = getEmitter();
    emitter.on(CHAT_EVENT, listener);
    return () => emitter.off(CHAT_EVENT, listener);
}

export function publishChatEvent(event: ChatEvent) {
    getEmitter().emit(CHAT_EVENT, event);
}
