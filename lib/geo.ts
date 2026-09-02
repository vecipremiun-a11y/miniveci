/**
 * Geolocalización aproximada del visitante a partir de su IP.
 *
 * En Vercel no hay que llamar a ningún servicio: el edge ya resuelve la IP y
 * adjunta los datos como headers `x-vercel-ip-*` en cada request. Es gratis,
 * no agrega latencia y no depende de una API externa que se pueda caer.
 *
 * Fuera de Vercel (localhost) esos headers no existen. Para poder probar la
 * pantalla de soporte en desarrollo hay un fallback opcional a ip-api.com,
 * apagado por defecto y con caché: se activa con PRESENCE_GEO_DEV_LOOKUP=true
 * y nunca corre en producción.
 *
 * OJO: la ubicación por IP es aproximada (nivel ciudad) y con VPN o datos
 * móviles puede apuntar a otra región. Sirve para dar contexto al operador,
 * no como dato duro.
 */
import { getClientIp } from "@/lib/rate-limit";

export interface VisitorGeo {
    ip: string | null;
    /** ISO 3166-1 alpha-2, ej. "CL". */
    country: string | null;
    /** Primer nivel de subdivisión (ISO 3166-2), ej. "RM". */
    countryRegion: string | null;
    city: string | null;
    /** Zona horaria IANA, ej. "America/Santiago". */
    timezone: string | null;
    latitude: number | null;
    longitude: number | null;
}

const EMPTY_GEO: VisitorGeo = {
    ip: null,
    country: null,
    countryRegion: null,
    city: null,
    timezone: null,
    latitude: null,
    longitude: null,
};

function header(req: Request, name: string): string | null {
    const value = req.headers.get(name)?.trim();
    return value ? value : null;
}

function toNumber(value: string | null): number | null {
    if (!value) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * Vercel manda la ciudad codificada según RFC3986 ("Vi%C3%B1a%20del%20Mar"),
 * porque los headers HTTP no aceptan caracteres no-ASCII.
 */
function decodeCity(value: string | null): string | null {
    if (!value) return null;
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

/** Lectura directa de los headers del edge. Sin I/O. */
export function getGeoFromHeaders(req: Request): VisitorGeo {
    const ip = getClientIp(req);
    return {
        ip: ip && ip !== "unknown" ? ip : null,
        country: header(req, "x-vercel-ip-country")?.toUpperCase() ?? null,
        countryRegion: header(req, "x-vercel-ip-country-region"),
        city: decodeCity(header(req, "x-vercel-ip-city")),
        timezone: header(req, "x-vercel-ip-timezone"),
        latitude: toNumber(header(req, "x-vercel-ip-latitude")),
        longitude: toNumber(header(req, "x-vercel-ip-longitude")),
    };
}

/* ------------------- Fallback solo para desarrollo ------------------- */

interface GeoCacheEntry {
    geo: VisitorGeo;
    expiresAt: number;
}

declare global {
    var __miniveciGeoCache: Map<string, GeoCacheEntry> | undefined;
}

const GEO_CACHE_TTL_MS = 24 * 60 * 60_000;
const GEO_CACHE_MAX = 500;
const GEO_LOOKUP_TIMEOUT_MS = 1500;

function getGeoCache(): Map<string, GeoCacheEntry> {
    if (!globalThis.__miniveciGeoCache) {
        globalThis.__miniveciGeoCache = new Map<string, GeoCacheEntry>();
    }
    return globalThis.__miniveciGeoCache;
}

function isPrivateIp(ip: string | null): boolean {
    if (!ip) return true;
    return (
        ip === "127.0.0.1" ||
        ip === "::1" ||
        ip.startsWith("10.") ||
        ip.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    );
}

async function lookupIpApi(ip: string | null): Promise<VisitorGeo | null> {
    // Sin IP pública usable, ip-api resuelve la del propio servidor: en dev eso
    // es justamente la conexión del desarrollador, que es lo que queremos ver.
    const target = isPrivateIp(ip) ? "" : ip;
    const url = `http://ip-api.com/json/${target}?fields=status,countryCode,region,city,timezone,lat,lon,query`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEO_LOOKUP_TIMEOUT_MS);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        const data = await res.json();
        if (data?.status !== "success") return null;
        return {
            ip: ip ?? data.query ?? null,
            country: typeof data.countryCode === "string" ? data.countryCode.toUpperCase() : null,
            countryRegion: typeof data.region === "string" ? data.region : null,
            city: typeof data.city === "string" ? data.city : null,
            timezone: typeof data.timezone === "string" ? data.timezone : null,
            latitude: typeof data.lat === "number" ? data.lat : null,
            longitude: typeof data.lon === "number" ? data.lon : null,
        };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Geo del visitante. En producción son los headers del edge; en desarrollo,
 * con PRESENCE_GEO_DEV_LOOKUP=true, cae a ip-api.com cacheado por IP.
 * Nunca lanza: si no se puede resolver, devuelve los campos en null.
 */
export async function resolveVisitorGeo(req: Request): Promise<VisitorGeo> {
    const fromHeaders = getGeoFromHeaders(req);
    if (fromHeaders.country) return fromHeaders;

    const devLookupEnabled =
        process.env.NODE_ENV !== "production" && process.env.PRESENCE_GEO_DEV_LOOKUP === "true";
    if (!devLookupEnabled) return fromHeaders;

    const cache = getGeoCache();
    const key = fromHeaders.ip ?? "self";
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) return cached.geo;

    const looked = await lookupIpApi(fromHeaders.ip);
    const geo = looked ?? { ...EMPTY_GEO, ip: fromHeaders.ip };

    if (cache.size >= GEO_CACHE_MAX) cache.clear();
    cache.set(key, { geo, expiresAt: now + GEO_CACHE_TTL_MS });

    return geo;
}
