import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations } from "@/lib/db/schema";
import { resolveClientIdentity } from "@/lib/chat-identity";
import { and, desc, eq, isNull } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/chat/conversations[?guestId=...]
 * Lista TODAS las conversaciones del cliente autenticado (abiertas y cerradas),
 * para que la app muestre el historial de soporte. Scoped a la identidad:
 *   - customer (cookie web o Bearer JWT app) → por customerId
 *   - guest (guestId) → por guestId sin customer
 */
export async function GET(req: NextRequest) {
    try {
        const url = new URL(req.url);
        const guestId = url.searchParams.get("guestId") || undefined;

        const identity = await resolveClientIdentity(req, guestId);
        if (!identity) {
            return NextResponse.json({ error: "guestId requerido" }, { status: 400 });
        }

        const scope = identity.kind === "customer"
            ? eq(chatConversations.customerId, identity.customerId)
            : and(
                eq(chatConversations.guestId, identity.guestId),
                isNull(chatConversations.customerId),
            );

        const rows = await db
            .select()
            .from(chatConversations)
            .where(scope)
            .orderBy(desc(chatConversations.lastMessageAt), desc(chatConversations.createdAt))
            .limit(100);

        return NextResponse.json({
            conversations: rows.map(c => ({
                id: c.id,
                status: c.status,
                lastMessageAt: c.lastMessageAt,
                lastMessagePreview: c.lastMessagePreview,
                unreadCustomer: c.unreadCustomer ?? 0,
                createdAt: c.createdAt,
            })),
        });
    } catch (error) {
        console.error("[CHAT_CONVERSATIONS_LIST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
