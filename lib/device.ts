/**
 * Lectura mínima del User-Agent para mostrarle al operador desde qué aparato
 * está mirando el visitante ("iPhone · Safari").
 *
 * A propósito sin librería: ua-parser-js pesa más que todo el módulo de
 * presencia y aquí solo se necesita un rótulo aproximado. Si el UA no calza
 * con nada conocido se devuelve null y la UI muestra "Desconocido" — nunca
 * se inventa un valor.
 */

export type DeviceKind = "mobile" | "tablet" | "desktop" | "bot";

export interface DeviceInfo {
    device: DeviceKind;
    browser: string | null;
    os: string | null;
}

const BOT_PATTERN = /bot|crawler|spider|crawling|headless|preview|facebookexternalhit|whatsapp|slackbot|bingpreview|lighthouse/i;

function detectDevice(ua: string): DeviceKind {
    if (BOT_PATTERN.test(ua)) return "bot";
    if (/ipad|tablet|playbook|silk/i.test(ua)) return "tablet";
    if (/android/i.test(ua) && !/mobile/i.test(ua)) return "tablet";
    if (/mobi|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) return "mobile";
    return "desktop";
}

function detectBrowser(ua: string): string | null {
    // El orden importa: Edge y Opera también dicen "Chrome" en su UA.
    if (/edg[ea]?\//i.test(ua)) return "Edge";
    if (/opr\/|opera/i.test(ua)) return "Opera";
    if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
    if (/firefox|fxios/i.test(ua)) return "Firefox";
    if (/chrome|crios/i.test(ua)) return "Chrome";
    if (/safari/i.test(ua)) return "Safari";
    return null;
}

function detectOs(ua: string): string | null {
    if (/windows nt/i.test(ua)) return "Windows";
    if (/android/i.test(ua)) return "Android";
    if (/iphone|ipod/i.test(ua)) return "iOS";
    if (/ipad/i.test(ua)) return "iPadOS";
    if (/mac os x/i.test(ua)) return "macOS";
    if (/cros/i.test(ua)) return "ChromeOS";
    if (/linux/i.test(ua)) return "Linux";
    return null;
}

export function parseUserAgent(userAgent: string | null | undefined): DeviceInfo {
    const ua = (userAgent || "").trim();
    if (!ua) return { device: "desktop", browser: null, os: null };
    return {
        device: detectDevice(ua),
        browser: detectBrowser(ua),
        os: detectOs(ua),
    };
}
