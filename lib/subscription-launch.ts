/**
 * Lanzamiento de la membresía Premium.
 *
 * Mientras no haya fecha (null) o todavía no llegue, /suscripcion muestra el
 * anuncio "Próximamente" y el botón queda gris, desactivado. El cobro, Mercado
 * Pago y la API de suscripción no se tocan: esto solo decide qué muestra la página.
 *
 * Para lanzar: poner la fecha con la hora de Chile, ej. "2026-11-15T09:00:00-03:00",
 * y subir. Desde ese momento el botón se activa solo y el anuncio desaparece;
 * antes de la fecha, el anuncio la muestra.
 */
export const SUBSCRIPTION_LAUNCH_AT: string | null = null;

/** Fecha de lanzamiento ya parseada, o null si no hay (o está mal escrita). */
export function subscriptionLaunchDate(): Date | null {
    if (!SUBSCRIPTION_LAUNCH_AT) return null;
    const date = new Date(SUBSCRIPTION_LAUNCH_AT);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function isSubscriptionLaunched(now: number = Date.now()): boolean {
    const date = subscriptionLaunchDate();
    return date !== null && now >= date.getTime();
}
