'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getGuestId, INCOMING_CHAT_EVENT } from '@/lib/chat-guest';

/**
 * Heartbeat de presencia: avisa al backend que este visitante sigue en el sitio
 * y en qué página está, para que soporte pueda verlo en línea y escribirle.
 *
 * No pinta nada (devuelve null) y no bloquea la navegación: si el fetch falla
 * se ignora y el siguiente latido reintenta.
 *
 * Se apaga solo en /admin y para el equipo logueado — nadie quiere verse a sí
 * mismo en la lista de visitantes.
 */

const HEARTBEAT_MS = 30_000;
/** Si la pestaña lleva más de esto oculta, dejamos de latir hasta que vuelva. */
const HIDDEN_GRACE_MS = 5 * 60_000;
/** Margen para que Next alcance a actualizar document.title tras navegar. */
const NEW_PAGE_DELAY_MS = 400;

export function PresenceTracker() {
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const guestIdRef = useRef('');
    const pathRef = useRef(pathname);
    const hiddenSinceRef = useRef<number | null>(null);

    const isAdminRoute = pathname?.startsWith('/admin') ?? false;
    const isStaff = status === 'authenticated' && session?.user?.role !== 'customer';
    const enabled = status !== 'loading' && !isAdminRoute && !isStaff;

    useEffect(() => { pathRef.current = pathname; }, [pathname]);

    const ping = useCallback(async (newPage: boolean) => {
        const guestId = guestIdRef.current;
        if (!guestId) return;

        try {
            const res = await fetch('/api/presence/ping', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guestId,
                    path: pathRef.current || '/',
                    title: document.title || null,
                    referrer: document.referrer || null,
                    newPage,
                }),
                // Sobrevive a que el usuario navegue justo al mandarlo.
                keepalive: true,
            });
            if (!res.ok) return;

            // Si soporte escribió primero, el latido lo trae de vuelta y el
            // widget de chat (que escucha este evento) levanta la conversación.
            const data = await res.json();
            if (data?.pendingConversation?.id) {
                window.dispatchEvent(
                    new CustomEvent(INCOMING_CHAT_EVENT, {
                        detail: {
                            conversationId: data.pendingConversation.id,
                            unread: data.pendingConversation.unread ?? 0,
                        },
                    }),
                );
            }
        } catch {
            /* sin red, o 429: el próximo latido reintenta */
        }
    }, []);

    // Latido inmediato al entrar y en cada cambio de página.
    useEffect(() => {
        if (!enabled) return;
        guestIdRef.current = getGuestId();
        if (!guestIdRef.current) return;

        const timer = setTimeout(() => ping(true), NEW_PAGE_DELAY_MS);
        return () => clearTimeout(timer);
    }, [enabled, pathname, ping]);

    // Latido periódico mientras la pestaña esté viva.
    useEffect(() => {
        if (!enabled) return;

        const interval = setInterval(() => {
            const hiddenSince = hiddenSinceRef.current;
            if (hiddenSince !== null && Date.now() - hiddenSince > HIDDEN_GRACE_MS) return;
            ping(false);
        }, HEARTBEAT_MS);

        const onVisibilityChange = () => {
            if (document.hidden) {
                hiddenSinceRef.current = Date.now();
                return;
            }
            hiddenSinceRef.current = null;
            ping(false);
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, [enabled, ping]);

    return null;
}
