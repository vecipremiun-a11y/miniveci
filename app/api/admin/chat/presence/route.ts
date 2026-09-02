import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations, chatVisitorSessions, customers } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { desc, eq, gt, inArray, and } from "drizzle-orm";

export const dynamic = "force-dynamic";

/** Sin latido en este lapso, el visitante se considera "inactivo". */
const ONLINE_WINDOW_MS = 60_000;
/** Pasado esto ya no se muestra: se fue del sitio. */
const VISIBLE_WINDOW_MS = 5 * 60_000;
const MAX_VISITORS = 100;

/**
 * Oculta la segunda mitad de la IP. El operador igual puede distinguir dos
 * visitantes distintos, pero no queda la dirección completa dando vueltas en
 * el navegador del panel.
 */
function maskIp(ip: string | null): string | null {
    if (!ip) return null;
    if (ip.includes(":")) {
        const parts = ip.split(":");
        return `${parts.slice(0, 2).join(":")}:···`;
    }
    const parts = ip.split(".");
    if (parts.length !== 4) return null;
    return `${parts[0]}.${parts[1]}.x.x`;
}

/**
 * GET /api/admin/chat/presence
 * Quién está navegando el sitio ahora mismo.
 *
 * Se consulta por polling desde el panel (cada 10s) en vez de por SSE: el
 * pub/sub de chat vive en la memoria de un proceso y en Vercel el panel puede
 * quedar en otra instancia que la del visitante. La base de datos, en cambio,
 * la ven todas.
 */
export async function GET() {
    try {
        await requireAuth();

        const now = Date.now();
        const visibleSince = new Date(now - VISIBLE_WINDOW_MS).toISOString();
        const onlineSince = now - ONLINE_WINDOW_MS;

        const rows = await db
            .select({
                visitor: chatVisitorSessions,
                customer: customers,
            })
            .from(chatVisitorSessions)
            .leftJoin(customers, eq(chatVisitorSessions.customerId, customers.id))
            .where(gt(chatVisitorSessions.lastSeenAt, visibleSince))
            .orderBy(desc(chatVisitorSessions.lastSeenAt))
            .limit(MAX_VISITORS);

        // Conversación abierta de cada visitante, en una sola consulta aparte.
        // Un left join con OR (por guestId o por customerId) podría duplicar
        // filas cuando la persona tiene ambas cosas.
        const guestIds = rows.map(r => r.visitor.guestId);
        const customerIds = rows.map(r => r.visitor.customerId).filter((id): id is string => !!id);

        const openConversations = guestIds.length
            ? await db
                .select({
                    id: chatConversations.id,
                    guestId: chatConversations.guestId,
                    customerId: chatConversations.customerId,
                    unreadAgent: chatConversations.unreadAgent,
                })
                .from(chatConversations)
                .where(and(eq(chatConversations.status, "open"), inArray(chatConversations.guestId, guestIds)))
            : [];

        const byCustomer = customerIds.length
            ? await db
                .select({
                    id: chatConversations.id,
                    guestId: chatConversations.guestId,
                    customerId: chatConversations.customerId,
                    unreadAgent: chatConversations.unreadAgent,
                })
                .from(chatConversations)
                .where(and(eq(chatConversations.status, "open"), inArray(chatConversations.customerId, customerIds)))
            : [];

        const convByGuest = new Map(openConversations.map(c => [c.guestId, c]));
        const convByCustomer = new Map(byCustomer.map(c => [c.customerId, c]));

        const visitors = rows.map(({ visitor, customer }) => {
            // La conversación como cliente registrado manda sobre la de invitado:
            // es la que el operador ve en la lista con su nombre real.
            const conversation =
                (visitor.customerId ? convByCustomer.get(visitor.customerId) : null) ??
                convByGuest.get(visitor.guestId) ??
                null;

            const lastSeenMs = new Date(visitor.lastSeenAt).getTime();

            return {
                guestId: visitor.guestId,
                customerId: visitor.customerId,
                name: customer ? `${customer.firstName} ${customer.lastName}`.trim() : null,
                email: customer?.email ?? null,
                phone: customer?.phone ?? null,
                status: lastSeenMs >= onlineSince ? "online" : "idle",
                firstSeenAt: visitor.firstSeenAt,
                lastSeenAt: visitor.lastSeenAt,
                pageViews: visitor.pageViews,
                currentPath: visitor.currentPath,
                pageTitle: visitor.pageTitle,
                landingPath: visitor.landingPath,
                referrer: visitor.referrer,
                country: visitor.country,
                countryRegion: visitor.countryRegion,
                city: visitor.city,
                timezone: visitor.timezone,
                ipMasked: maskIp(visitor.ip),
                device: visitor.device,
                browser: visitor.browser,
                os: visitor.os,
                conversationId: conversation?.id ?? null,
                unreadAgent: conversation?.unreadAgent ?? 0,
            };
        });

        return NextResponse.json(
            {
                visitors,
                counts: {
                    online: visitors.filter(v => v.status === "online").length,
                    idle: visitors.filter(v => v.status === "idle").length,
                },
            },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_CHAT_PRESENCE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
