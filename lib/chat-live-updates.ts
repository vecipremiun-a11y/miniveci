import { EventEmitter } from "node:events";

/**
 * Pub/sub en memoria para eventos de chat. Single-instance: si se escala a
 * múltiples procesos hay que migrar a Redis pub/sub o canal realtime de Turso.
 *
 * Eventos tipados (discriminated union por `type`):
 *  - message_created: nuevo mensaje en una conversación.
 *  - conversation_created: conversación recién creada (notifica al admin).
 *  - conversation_updated: cambios en metadatos (last preview, unread, asignación, etc).
 *  - conversation_closed: conversación cerrada (notifica al cliente y al admin).
 *  - conversation_reopened: conversación reabierta.
 */

export type ChatMessageType = "text" | "image" | "audio" | "file";

export interface ChatMessagePayload {
    id: string;
    conversationId: string;
    senderType: "customer" | "agent" | "system";
    senderId: string | null;
    senderName: string | null;
    body: string;
    messageType: ChatMessageType;
    attachmentUrl: string | null;
    attachmentName: string | null;
    attachmentSize: number | null;
    mimeType: string | null;
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

export type ChatEvent =
    | {
        type: "message_created";
        conversationId: string;
        message: ChatMessagePayload;
        occurredAt: string;
    }
    | {
        type: "conversation_created";
        conversationId: string;
        conversation: ChatConversationPayload;
        occurredAt: string;
    }
    | {
        type: "conversation_updated";
        conversationId: string;
        conversation: ChatConversationPayload;
        occurredAt: string;
    }
    | {
        type: "conversation_closed";
        conversationId: string;
        occurredAt: string;
    }
    | {
        type: "conversation_reopened";
        conversationId: string;
        occurredAt: string;
    };

export type ChatEventType = ChatEvent["type"];

const CHAT_EVENT = "chat-event";

declare global {
    // eslint-disable-next-line no-var
    var __chatLiveUpdatesEmitter: EventEmitter | undefined;
}

function getEmitter() {
    if (!globalThis.__chatLiveUpdatesEmitter) {
        globalThis.__chatLiveUpdatesEmitter = new EventEmitter();
        globalThis.__chatLiveUpdatesEmitter.setMaxListeners(1000);
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
