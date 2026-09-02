import { Monitor, Smartphone, Tablet } from 'lucide-react';
import type { OnlineVisitor } from '@/hooks/use-visitor-presence';

/** Formato compartido por la lista de visitantes y el cuadro para escribirles. */

/** "CL" → 🇨🇱 (las dos letras convertidas a indicadores regionales). */
export function flagEmoji(code: string | null): string {
    if (!code || !/^[a-z]{2}$/i.test(code)) return '🌐';
    const base = 0x1f1e6;
    return String.fromCodePoint(
        ...[...code.toUpperCase()].map(letter => base + letter.charCodeAt(0) - 65),
    );
}

export function countryName(code: string | null): string | null {
    if (!code) return null;
    try {
        return new Intl.DisplayNames(['es'], { type: 'region' }).of(code.toUpperCase()) ?? code;
    } catch {
        return code;
    }
}

export function locationLabel(visitor: OnlineVisitor): string {
    if (visitor.city) return visitor.city;
    return countryName(visitor.country) || 'Ubicación desconocida';
}

/** Ciudad, región y país en una línea, con lo que haya. */
export function fullLocationLabel(visitor: OnlineVisitor): string {
    const parts = [visitor.city, visitor.countryRegion, countryName(visitor.country)].filter(Boolean);
    return parts.length ? parts.join(', ') : 'Ubicación desconocida';
}

export function deviceIcon(device: string | null) {
    if (device === 'mobile') return Smartphone;
    if (device === 'tablet') return Tablet;
    return Monitor;
}

export function deviceLabel(visitor: OnlineVisitor): string {
    const parts = [visitor.os, visitor.browser].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Dispositivo desconocido';
}

export function lastSeenLabel(iso: string): string {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 15) return 'ahora';
    if (seconds < 60) return `hace ${seconds}s`;
    return `hace ${Math.floor(seconds / 60)}m`;
}

/** Cuánto lleva en el sitio esta visita. */
export function timeOnSite(iso: string): string {
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return 'recién llegó';
    if (minutes < 60) return `${minutes} min aquí`;
    return `${Math.floor(minutes / 60)} h aquí`;
}

export function visitorInitials(visitor: OnlineVisitor): string {
    if (!visitor.name) return '·';
    return visitor.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}
