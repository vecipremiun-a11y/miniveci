import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations, chatMessages } from "@/lib/db/schema";
import { resolveClientIdentity, ownsConversation } from "@/lib/chat-identity";
import { publishChatEvent } from "@/lib/chat-live-updates";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_BODY = 2000;

/**
 * POST /api/chat/conversation/[id]/messages
 * Cliente envía un mensaje a su conversación.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id: conversationId } = await context.params;
        const body = await req.json().catch(() => ({}));
        const text = typeof body?.body === "string" ? body.body.trim() : "";

        if (!text) {
            return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
        }
        if (text.length > MAX_BODY) {
            return NextResponse.json({ error: `Mensaje muy largo (máx ${MAX_BODY})` }, { status: 400 });
        }

        const identity = await resolveClientIdentity(req, body?.guestId);
        if (!identity) {
            return NextResponse.json({ error: "Sin identidad" }, { status: 401 });
        }

        const conversation = await db.query.chatConversations.findFirst({
            where: eq(chatConversations.id, conversationId),
        });
        if (!conversation) {
            return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
        }
        if (!ownsConversation(identity, conversation)) {
            return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
        }
        if (conversation.status === "closed") {
            return NextResponse.json({ error: "Conversación cerrada" }, { status: 400 });
        }

        const senderName = identity.kind === "customer"
            ? identity.name
            : (conversation.guestName || "Visitante");

        const messageId = crypto.randomUUID();
        const now = new Date().toISOString();

        await db.insert(chatMessages).values({
            id: messageId,
            conversationId,
            senderType: "customer",
            senderId: identity.kind === "customer" ? identity.customerId : null,
            senderName,
            body: text,
            readByCustomer: true,
            readByAgent: false,
            createdAt: now,
        });

        await db.update(chatConversations)
            .set({
                lastMessageAt: now,
                lastMessagePreview: text.slice(0, 140),
                unreadAgent: sql`${chatConversations.unreadAgent} + 1`,
                updatedAt: now,
            })
            .where(eq(chatConversations.id, conversationId));

        // Notificar a operadores conectados
        publishChatEvent({
            type: "message-created",
            conversationId,
            message: {
                id: messageId,
                conversationId,
                senderType: "customer",
                senderId: identity.kind === "customer" ? identity.customerId : null,
                senderName,
                body: text,
                createdAt: now,
            },
            occurredAt: now,
        });

        return NextResponse.json({
            id: messageId,
            senderType: "customer",
            senderName,
            body: text,
            createdAt: now,
        }, { status: 201 });
    } catch (error) {
        console.error("[CHAT_MESSAGE_POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
