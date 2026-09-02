'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Puente de vuelta a la app móvil después de pagar en Mercado Pago.
 *
 * MP no acepta esquemas propios (miniveci://) en `back_urls`, así que apunta
 * aquí y esta página rebota al deep link que la app ya sabe enrutar
 * (`DeepLinkHandler` → `/payment/:status`).
 */
function PagoAppContent() {
    const params = useSearchParams();
    const [bounced, setBounced] = useState(false);

    const deepLink = useMemo(() => {
        // MP manda su propio veredicto; el `result` que pusimos en la back_url
        // es solo el respaldo (y por eso no se llama `status`: MP ya usa esa key).
        const mpStatus = params.get('collection_status') || params.get('status');
        const fallback = params.get('result') || 'pending';

        const status = mpStatus === 'approved'
            ? 'success'
            : mpStatus === 'rejected' || mpStatus === 'cancelled' || mpStatus === 'failure'
                ? 'failure'
                : mpStatus === 'pending' || mpStatus === 'in_process'
                    ? 'pending'
                    : fallback;

        const order = params.get('external_reference') || params.get('order') || '';
        const source = params.get('source') || 'store';
        const qs = new URLSearchParams({ source });
        if (order) qs.set('order', order);

        return `miniveci://payment/${status}?${qs.toString()}`;
    }, [params]);

    useEffect(() => {
        const t = setTimeout(() => {
            window.location.href = deepLink;
            setBounced(true);
        }, 300);
        return () => clearTimeout(t);
    }, [deepLink]);

    return (
        <main className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
            <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
                <h1 className="text-xl font-extrabold text-slate-800">Volviendo a Miniveci…</h1>
                <p className="mt-2 text-sm text-slate-500">
                    Te estamos devolviendo a la aplicación para mostrarte el resultado de tu pago.
                </p>
                <a
                    href={deepLink}
                    className="mt-6 inline-block w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
                >
                    Abrir la app
                </a>
                {bounced && (
                    <p className="mt-4 text-xs text-slate-400">
                        Si no se abrió sola, toca &quot;Abrir la app&quot; o vuelve manualmente: tu pedido ya quedó registrado.
                    </p>
                )}
            </div>
        </main>
    );
}

export default function PagoAppPage() {
    return (
        <Suspense fallback={null}>
            <PagoAppContent />
        </Suspense>
    );
}
