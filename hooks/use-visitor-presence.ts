'use client';

import { useCallback, useEffect, useState } from 'react';

/** Espejo de la respuesta de GET /api/admin/chat/presence. */
export interface OnlineVisitor {
    guestId: string;
    customerId: string | null;
    /** Nombre real si es cliente registrado; null si es anónimo. */
    name: string | null;
    email: string | null;
    phone: string | null;
    status: 'online' | 'idle';
    firstSeenAt: string;
    lastSeenAt: string;
    pageViews: number;
    currentPath: string | null;
    pageTitle: string | null;
    landingPath: string | null;
    referrer: string | null;
    country: string | null;
    countryRegion: string | null;
    city: string | null;
    timezone: string | null;
    ipMasked: string | null;
    device: string | null;
    browser: string | null;
    os: string | null;
    /** Conversación abierta, si ya existe. */
    conversationId: string | null;
    unreadAgent: number;
}

export interface PresenceCounts {
    online: number;
    idle: number;
}

/** Mirando la lista de visitantes: se quiere ver el movimiento al tiro. */
export const PRESENCE_POLL_ACTIVE_MS = 10_000;
/** De fondo, solo para mantener vivo el contador: mucho más tranquilo. */
export const PRESENCE_POLL_IDLE_MS = 30_000;

/**
 * Visitantes navegando el sitio ahora mismo.
 *
 * Va por polling y no por SSE a propósito: el pub/sub del chat vive en la
 * memoria del proceso y en Vercel el panel puede quedar en otra instancia que
 * la del visitante. Consultando la base cada 10s el dato es igual de fresco
 * para lo que sirve (saber quién está mirando) y no depende de la instancia.
 *
 * Se pausa mientras la pestaña esté oculta y se refresca al volver. El
 * intervalo lo decide quien lo usa: rápido cuando la lista está a la vista,
 * lento cuando solo alimenta el contador.
 */
export function useVisitorPresence(pollMs: number = PRESENCE_POLL_ACTIVE_MS, enabled = true) {
    const [visitors, setVisitors] = useState<OnlineVisitor[]>([]);
    const [counts, setCounts] = useState<PresenceCounts>({ online: 0, idle: 0 });
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/chat/presence');
            if (!res.ok) return;
            const data = await res.json();
            setVisitors(Array.isArray(data.visitors) ? data.visitors : []);
            setCounts(data.counts ?? { online: 0, idle: 0 });
        } catch {
            // Corte de red: se conserva la última foto y el próximo ciclo reintenta.
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;

        refresh();
        const interval = setInterval(() => {
            if (!document.hidden) refresh();
        }, pollMs);

        const onVisibilityChange = () => { if (!document.hidden) refresh(); };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [enabled, pollMs, refresh]);

    return { visitors, counts, loading, refresh };
}
