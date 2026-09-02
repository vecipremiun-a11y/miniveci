/**
 * Limitador de tasa por IP (ventana fija, en memoria).
 *
 * Sin infraestructura extra: el estado vive en `globalThis` igual que
 * `__storefrontPosRefreshState` en /api/store/products/refresh. En Vercel cada
 * instancia lleva su propio contador, así que el límite efectivo se multiplica
 * por la cantidad de lambdas activas — es best-effort, no una garantía. Frena
 * fuerza bruta y spam desde un solo origen, que es el caso real que nos importa.
 * Si algún día se escala a varias regiones, migrar a Upstash Redis (mismo
 * contrato: `checkRateLimit` devuelve lo mismo).
 *
 * Uso típico en una ruta:
 *   const limited = enforceRateLimit(req, RATE_LIMITS.login);
 *   if (limited) return limited;
 */
import { NextRequest, NextResponse } from "next/server";

export interface RateLimitRule {
    /** Nombre del bucket — separa contadores entre endpoints. */
    name: string;
    /** Máximo de peticiones permitidas dentro de la ventana. */
    limit: number;
    /** Largo de la ventana en milisegundos. */
    windowMs: number;
}

/** Reglas por tipo de endpoint. Ajustar acá, no en cada ruta. */
export const RATE_LIMITS = {
    /** Login: frena fuerza bruta de contraseñas. */
    login: { name: "login", limit: 10, windowMs: 5 * 60_000 },
    /** Registro de cuentas: frena creación masiva. */
    register: { name: "register", limit: 5, windowMs: 60 * 60_000 },
    /** Creación de pedidos y preferencias de pago. */
    checkout: { name: "checkout", limit: 15, windowMs: 10 * 60_000 },
    /** Subida de archivos (comprobantes, adjuntos). */
    upload: { name: "upload", limit: 20, windowMs: 60 * 60_000 },
    /** Inscripción al sorteo de temporada. */
    raffle: { name: "raffle", limit: 10, windowMs: 60 * 60_000 },
    /** Envío de mensajes de chat. */
    chat: { name: "chat", limit: 40, windowMs: 5 * 60_000 },
    /**
     * Heartbeat de presencia. Generoso a propósito: varias personas comparten
     * IP (oficina, casa, CGNAT del celular) y cada una manda 2 pings por minuto.
     */
    presence: { name: "presence", limit: 200, windowMs: 5 * 60_000 },
} as const satisfies Record<string, RateLimitRule>;

interface Bucket {
    count: number;
    resetAt: number;
}

declare global {
    var __miniveciRateLimitBuckets: Map<string, Bucket> | undefined;
}

const MAX_TRACKED_KEYS = 10_000;

function getBuckets(): Map<string, Bucket> {
    if (!globalThis.__miniveciRateLimitBuckets) {
        globalThis.__miniveciRateLimitBuckets = new Map<string, Bucket>();
    }
    return globalThis.__miniveciRateLimitBuckets;
}

/** Purga entradas expiradas para que el Map no crezca sin límite. */
function sweep(buckets: Map<string, Bucket>, now: number): void {
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
}

/**
 * IP del cliente. En Vercel llega en `x-forwarded-for` (el primer valor es el
 * cliente real; los siguientes son proxies). `x-real-ip` como respaldo.
 */
export function getClientIp(req: Request): string {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
        const first = forwarded.split(",")[0]?.trim();
        if (first) return first;
    }
    return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface RateLimitResult {
    allowed: boolean;
    /** Peticiones restantes en la ventana actual. */
    remaining: number;
    /** Segundos hasta que la ventana se reinicie. */
    retryAfterSeconds: number;
}

/**
 * Registra una petición y dice si excede el límite.
 * `identifier` permite acotar por algo más específico que la IP (ej. email).
 */
export function checkRateLimit(
    rule: RateLimitRule,
    identifier: string,
): RateLimitResult {
    const buckets = getBuckets();
    const now = Date.now();

    if (buckets.size > MAX_TRACKED_KEYS) sweep(buckets, now);

    const key = `${rule.name}:${identifier}`;
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
        return { allowed: true, remaining: rule.limit - 1, retryAfterSeconds: 0 };
    }

    existing.count += 1;
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

    if (existing.count > rule.limit) {
        return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    return { allowed: true, remaining: rule.limit - existing.count, retryAfterSeconds };
}

/**
 * Aplica una regla a la request. Devuelve `null` si pasa, o un 429 listo para
 * retornar si se excedió.
 *
 * Sin `subject` el contador va por IP. Con `subject` (ej. el email del login) va
 * por ese valor y **no** por IP: así rotar direcciones no permite atacar una
 * cuenta concreta sin freno. Para cubrir ambos ejes, llamar dos veces.
 */
export function enforceRateLimit(
    req: NextRequest | Request,
    rule: RateLimitRule,
    subject?: string,
): NextResponse | null {
    const identifier = subject ? `subject:${subject.toLowerCase()}` : getClientIp(req);

    const result = checkRateLimit(rule, identifier);
    if (result.allowed) return null;

    return NextResponse.json(
        {
            error: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
            message: "Demasiados intentos. Espera un momento e inténtalo de nuevo.",
            code: "rate_limited",
        },
        {
            status: 429,
            headers: {
                "Retry-After": String(result.retryAfterSeconds),
                "Cache-Control": "no-store",
            },
        },
    );
}
