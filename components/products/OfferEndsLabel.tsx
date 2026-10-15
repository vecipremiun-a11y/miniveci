'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const pad = (n: number) => String(n).padStart(2, '0');

/** Milisegundos actuales, refrescados cada segundo (null hasta montar en el navegador). */
function useNow(): number | null {
    const [now, setNow] = useState<number | null>(null);
    useEffect(() => {
        const tick = () => setNow(Date.now());
        const first = setTimeout(tick, 0);
        const id = setInterval(tick, 1000);
        return () => { clearTimeout(first); clearInterval(id); };
    }, []);
    return now;
}

/**
 * Cuenta regresiva del fin programado de una oferta, como franja sobre la foto
 * del producto (del ancho de la tarjeta): números grandes en cajitas con
 * días / hrs / min / seg. Avanza cada segundo.
 *
 * Va con `absolute` dentro del contenedor de la imagen (que debe ser
 * `relative`), así no mueve nada del layout. Se calcula recién en el navegador
 * para no chocar con el render del servidor. Al llegar a cero dice "Oferta
 * terminada"; el precio normal aparece al recargar, y el servidor ya cobra el
 * precio normal desde ese segundo.
 */
export function OfferCountdown({
    endsAt,
    size = 'card',
    className,
}: {
    endsAt: string;
    size?: 'card' | 'detail';
    className?: string;
}) {
    const now = useNow();
    const ends = Date.parse(endsAt);
    if (now === null || Number.isNaN(ends)) return null;

    const big = size === 'detail';
    const diff = ends - now;

    if (diff <= 0) {
        return (
            <div className={cn('absolute inset-x-0 bottom-0 z-[1] flex items-center justify-center gap-1.5 bg-slate-700/90 text-white font-bold', big ? 'py-3 text-base' : 'py-1.5 text-xs', className)}>
                <Clock className={big ? 'w-5 h-5' : 'w-3.5 h-3.5'} /> Oferta terminada
            </div>
        );
    }

    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86_400);
    const parts: { value: string; label: string }[] = [
        ...(days > 0 ? [{ value: String(days), label: days === 1 ? 'día' : 'días' }] : []),
        { value: pad(Math.floor((totalSec % 86_400) / 3600)), label: 'hrs' },
        { value: pad(Math.floor((totalSec % 3600) / 60)), label: 'min' },
        { value: pad(totalSec % 60), label: 'seg' },
    ];

    return (
        <div
            className={cn(
                'absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-r from-[#d93a1f] via-[#e8472a] to-[#f2672c] text-white shadow-[0_-6px_18px_-8px_rgba(206,65,38,0.7)]',
                big ? 'px-4 pt-2.5 pb-3' : 'px-1.5 sm:px-2 pt-1 pb-1.5',
                className,
            )}
            title={`Hasta el ${new Date(ends).toLocaleString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}`}
            role="timer"
            aria-label={`La oferta termina en ${parts.map((p) => `${p.value} ${p.label}`).join(', ')}`}
        >
            <p className={cn('flex items-center justify-center gap-1 font-extrabold uppercase tracking-wide text-[#ffe600]', big ? 'text-sm mb-1.5' : 'text-[9px] sm:text-[10px] mb-1')}>
                <Clock className={cn('shrink-0 animate-pulse', big ? 'w-4 h-4' : 'w-3 h-3')} strokeWidth={2.75} />
                La oferta termina en
            </p>
            <div className={cn('flex items-stretch justify-center', big ? 'gap-2' : 'gap-1 sm:gap-1.5')}>
                {parts.map((p, i) => (
                    <div key={p.label} className="flex items-center">
                        <div className={cn('flex flex-col items-center justify-center rounded-lg bg-white text-[#c4321a] shadow-sm', big ? 'min-w-[64px] px-2 py-1.5' : 'min-w-[34px] sm:min-w-[44px] px-1 py-0.5 sm:py-1')}>
                            <span className={cn('font-black tabular-nums leading-none', big ? 'text-3xl' : 'text-lg sm:text-[22px]')}>{p.value}</span>
                            <span className={cn('font-bold uppercase text-[#c4321a]/70 leading-none', big ? 'text-[11px] mt-1' : 'text-[8px] sm:text-[9px] mt-0.5')}>{p.label}</span>
                        </div>
                        {i < parts.length - 1 && (
                            <span className={cn('font-black text-white/90 leading-none', big ? 'text-2xl ml-2' : 'text-sm sm:text-base ml-1 sm:ml-1.5')}>:</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
