import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations, chatVisitorSessions } from "@/lib/db/schema";
import { resolveClientIdentity } from "@/lib/chat-identity";
import { resolveVisitorGeo } from "@/lib/geo";
import { parseUserAgent } from "@/lib/device";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { and, eq, gt, lt, or, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_PATH = 256;
const MAX_TITLE = 160;
const MAX_REFERRER = 300;

/** Días que se conserva la fila de un visitante que no volvió. */
const RETENTION_DAYS = 7;
/** La purga corre en ~1 de cada 50 pings: sin cron y sin costo fijo. */
const PURGE_PROBABILITY = 0.02;

function cleanPath(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const path = value.trim();
    // Solo rutas internas: evita guardar URLs completas de otros sitios.
    if (!path.startsWith("/")) return null;
    return path.slice(0, MAX_PATH);
}

function cleanText(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const text = value.trim();
    return text ? text.slice(0, max) : null;
}

/**
 * POST /api/presence/ping
 * Body: { guestId, path, title?, referrer?, newPage? }
 *
 * Heartbeat del visitante: deja constancia de que sigue en el sitio y en qué
 * página está. Público a propósito (el 99% de los visitantes son anónimos);
 * si además hay sesión de cliente, se guarda el vínculo con su cuenta.
 *
 * Una sola escritura por ping (upsert por guest_id). De vuelta solo avisa si
 * soporte le escribió a esta misma persona: nunca datos de terceros.
 */
export async function POST(req: NextRequest) {
    try {
        const limited = enforceRateLimit(req, RATE_LIMITS.presence);
        if (limited) return limited;

        const body = await req.json().catch(() => ({}));

        const guestId = (
            typeof body?.guestId === "string" ? body.guestId : req.headers.get("x-chat-guest-id") || ""
        ).trim();
        if (guestId.length < 16 || guestId.length > 64) {
            return NextResponse.json({ error: "guestId inválido" }, { status: 400 });
        }

        // El guestId identifica la fila; la cuenta la resuelve el servidor con
        // la sesión (o el Bearer de la app), nunca lo que mande el cliente.
        const identity = await resolveClientIdentity(req, guestId);
        const customerId = identity?.kind === "customer" ? identity.customerId : null;

        const geo = await resolveVisitorGeo(req);
        const userAgent = cleanText(req.headers.get("user-agent"), 400);
        const { device, browser, os } = parseUserAgent(userAgent);

        const currentPath = cleanPath(body?.path);
        const pageTitle = cleanText(body?.title, MAX_TITLE);
        const referrer = cleanText(body?.referrer, MAX_REFERRER);
        const newPage = body?.newPage === true;
        const now = new Date().toISOString();

        await db
            .insert(chatVisitorSessions)
            .values({
                id: crypto.randomUUID(),
                guestId,
                customerId,
                firstSeenAt: now,
                lastSeenAt: now,
                pageViews: 1,
                currentPath,
                pageTitle,
                landingPath: currentPath,
                referrer,
                ip: geo.ip,
                country: geo.country,
                countryRegion: geo.countryRegion,
                city: geo.city,
                timezone: geo.timezone,
                latitude: geo.latitude,
                longitude: geo.longitude,
                userAgent,
                device,
                browser,
                os,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: chatVisitorSessions.guestId,
                set: {
                    // Se vuelve a escribir en cada ping: refleja también el
                    // cierre de sesión (vuelve a null).
                    customerId,
                    lastSeenAt: now,
                    updatedAt: now,
                    // Igual que la geo: un ping incompleto no debe borrar
                    // lo que ya sabíamos de este visitante.
                    currentPath: currentPath ?? sql`${chatVisitorSessions.currentPath}`,
                    pageTitle: pageTitle ?? sql`${chatVisitorSessions.pageTitle}`,
                    // `sql` sin cambios = "deja el valor que ya tenía".
                    pageViews: newPage
                        ? sql`${chatVisitorSessions.pageViews} + 1`
                        : sql`${chatVisitorSessions.pageViews}`,
                    // Geo solo si la resolvimos: un ping sin headers del edge
                    // no debe borrar la ubicación que ya conocíamos.
                    ip: geo.ip ?? sql`${chatVisitorSessions.ip}`,
                    country: geo.country ?? sql`${chatVisitorSessions.country}`,
                    countryRegion: geo.countryRegion ?? sql`${chatVisitorSessions.countryRegion}`,
                    city: geo.city ?? sql`${chatVisitorSessions.city}`,
                    timezone: geo.timezone ?? sql`${chatVisitorSessions.timezone}`,
                    latitude: geo.latitude ?? sql`${chatVisitorSessions.latitude}`,
                    longitude: geo.longitude ?? sql`${chatVisitorSessions.longitude}`,
                    userAgent: userAgent ?? sql`${chatVisitorSessions.userAgent}`,
                    device: userAgent ? device : sql`${chatVisitorSessions.device}`,
                    browser: userAgent ? browser : sql`${chatVisitorSessions.browser}`,
                    os: userAgent ? os : sql`${chatVisitorSessions.os}`,
                },
            });

        if (Math.random() < PURGE_PROBABILITY) {
            const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
            await db.delete(chatVisitorSessions).where(lt(chatVisitorSessions.lastSeenAt, cutoff));
        }

        // ¿Soporte le escribió primero? El widget se entera por acá y levanta
        // la conversación sin que el visitante tenga que abrir nada. Es el
        // camino de vuelta más barato: una lectura sobre índice, sin abrir un
        // SSE por cada persona que está mirando la tienda.
        const pending = await db.query.chatConversations.findFirst({
            where: and(
                eq(chatConversations.status, "open"),
                gt(chatConversations.unreadCustomer, 0),
                customerId
                    ? or(
                        eq(chatConversations.customerId, customerId),
                        eq(chatConversations.guestId, guestId),
                    )
                    : eq(chatConversations.guestId, guestId),
            ),
            columns: { id: true, unreadCustomer: true },
        });

        return NextResponse.json(
            {
                ok: true,
                pendingConversation: pending
                    ? { id: pending.id, unread: pending.unreadCustomer ?? 0 }
                    : null,
            },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        console.error("[PRESENCE_PING]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
