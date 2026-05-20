'use client';

import { useEffect, useRef } from 'react';

/**
 * Tipos cliente espejo de `lib/chat-live-updates.ts`. Se duplican aquí
 * para evitar importar código de servidor en componentes cliente.
 */
export type ChatMessageType = 'text' | 'image' | 'audio' | 'file';

export interface ChatMessageEventPayload {
    id: string;
    conversationId: string;
    senderType: 'customer' | 'agent' | 'system';
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

export interface ChatConversationEventPayload {
    id: string;
    customerId: string | null;
    guestId: string | null;
    guestName: string | null;
    guestEmail: string | null;
    assignedOperatorId: string | null;
    status: 'open' | 'closed';
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

export type ChatSSEEvent =
    | { type: 'message_created'; conversationId: string; message: ChatMessageEventPayload; occurredAt: string }
    | { type: 'conversation_created'; conversationId: string; conversation: ChatConversationEventPayload; occurredAt: string }
    | { type: 'conversation_updated'; conversationId: string; conversation: ChatConversationEventPayload; occurredAt: string }
    | { type: 'conversation_closed'; conversationId: string; occurredAt: string }
    | { type: 'conversation_reopened'; conversationId: string; occurredAt: string };

export type ChatSSEEventType = ChatSSEEvent['type'];

const EVENT_TYPES: ChatSSEEventType[] = [
    'message_created',
    'conversation_created',
    'conversation_updated',
    'conversation_closed',
    'conversation_reopened',
];

/**
 * Hook que abre un EventSource al URL dado y reenvía los eventos a un callback
 * estable internamente (vía ref) para evitar re-conexiones por closures stale.
 *
 * Características:
 *  - Reconexión automática con backoff exponencial (1s, 2s, 4s, 8s, ..., máx 30s).
 *  - Escucha selectiva por `event:` SSE (no lee solo `onmessage`).
 *  - El callback se actualiza vía ref → cambios en estado del componente NO
 *    cierran ni reabren la conexión.
 *  - `enabled` permite pausar (ej: hasta tener un conversationId).
 *  - Cierra limpiamente al desmontar o cambiar URL.
 */
export function useChatSSE(opts: {
    url: string | null;
    enabled?: boolean;
    onEvent: (event: ChatSSEEvent) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
}) {
    const { url, enabled = true, onEvent, onConnect, onDisconnect } = opts;
    const onEventRef = useRef(onEvent);
    const onConnectRef = useRef(onConnect);
    const onDisconnectRef = useRef(onDisconnect);

    // Mantener refs actualizadas sin reconectar
    useEffect(() => {
        onEventRef.current = onEvent;
    }, [onEvent]);
    useEffect(() => {
        onConnectRef.current = onConnect;
    }, [onConnect]);
    useEffect(() => {
        onDisconnectRef.current = onDisconnect;
    }, [onDisconnect]);

    useEffect(() => {
        if (!enabled || !url) return;

        let es: EventSource | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let attempts = 0;
        let cancelled = false;

        const connect = () => {
            if (cancelled) return;
            es = new EventSource(url);

            es.addEventListener('connected', () => {
                attempts = 0;
                onConnectRef.current?.();
            });

            const handler = (e: MessageEvent) => {
                try {
                    const data = JSON.parse(e.data) as ChatSSEEvent;
                    onEventRef.current(data);
                } catch (err) {
                    console.warn('[chat-sse] parse error', err);
                }
            };

            for (const t of EVENT_TYPES) {
                es.addEventListener(t, handler as EventListener);
            }

            es.onerror = () => {
                onDisconnectRef.current?.();
                if (es) {
                    es.close();
                    es = null;
                }
                if (cancelled) return;
                attempts += 1;
                const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(attempts - 1, 5)));
                reconnectTimer = setTimeout(connect, delay);
            };
        };

        connect();

        return () => {
            cancelled = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            if (es) {
                es.close();
                es = null;
            }
        };
        // URL y enabled son las únicas dependencias que justifican una reconexión
    }, [url, enabled]);
}
