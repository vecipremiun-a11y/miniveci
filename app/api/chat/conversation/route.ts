import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations, chatMessages } from "@/lib/db/schema";
import { resolveClientIdentity, getOrCreateOpenConversation } from "@/lib/chat-identity";
import { asc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/chat/conversation
 * Body: { guestId?, guestName?, guestEmail? }
 * Devuelve la conversación activa del cliente (la crea si no existe) + historial.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const identity = await resolveClientIdentity(req, body?.guestId);
        if (!identity) {
            return NextResponse.json({ error: "guestId requerido" }, { status: 400 });
        }

        const conversation = await getOrCreateOpenConversation(identity, {
            guestName: typeof body?.guestName === "string" ? body.guestName.slice(0, 80) : null,
            guestEmail: typeof body?.guestEmail === "string" ? body.guestEmail.slice(0, 120) : null,
        });

        const messages = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.conversationId, conversation.id))
            .orderBy(asc(chatMessages.createdAt))
            .limit(200);

        // Marcar como leídos los mensajes del agente
        if (conversation.unreadCustomer && conversation.unreadCustomer > 0) {
            await db
                .update(chatConversations)
                .set({ unreadCustomer: 0 })
                .where(eq(chatConversations.id, conversation.id));
        }

        return NextResponse.json({
            conversation: {
                id: conversation.id,
                status: conversation.status,
                createdAt: conversation.createdAt,
            },
            messages: messages.map(m => ({
                id: m.id,
                senderType: m.senderType,
                senderName: m.senderName,
                body: m.body,
                createdAt: m.createdAt,
            })),
            identity: {
                kind: identity.kind,
                name: identity.kind === "customer" ? identity.name : null,
            },
        });
    } catch (error) {
        console.error("[CHAT_CONVERSATION_POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
