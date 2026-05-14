import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations, chatMessages, users } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { publishChatEvent } from "@/lib/chat-live-updates";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_BODY = 2000;

/**
 * POST /api/admin/chat/conversations/[id]/messages
 * Operador envía una respuesta.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireAuth();
        const { id: conversationId } = await context.params;
        const body = await req.json().catch(() => ({}));
        const text = typeof body?.body === "string" ? body.body.trim() : "";

        if (!text) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
        if (text.length > MAX_BODY) {
            return NextResponse.json({ error: `Máx ${MAX_BODY} caracteres` }, { status: 400 });
        }

        const conversation = await db.query.chatConversations.findFirst({
            where: eq(chatConversations.id, conversationId),
        });
        if (!conversation) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
        if (conversation.status === "closed") {
            return NextResponse.json({ error: "Conversación cerrada" }, { status: 400 });
        }

        const operator = await db.query.users.findFirst({
            where: eq(users.id, session.user.id as string),
        });
        const senderName = operator?.name || session.user.name || "Soporte";

        const messageId = crypto.randomUUID();
        const now = new Date().toISOString();

        await db.insert(chatMessages).values({
            id: messageId,
            conversationId,
            senderType: "agent",
            senderId: session.user.id as string,
            senderName,
            body: text,
            readByCustomer: false,
            readByAgent: true,
            createdAt: now,
        });

        // Si nadie estaba asignado, este operador queda asignado
        const updateData: any = {
            lastMessageAt: now,
            lastMessagePreview: text.slice(0, 140),
            unreadCustomer: sql`${chatConversations.unreadCustomer} + 1`,
            updatedAt: now,
        };
        if (!conversation.assignedOperatorId) {
            updateData.assignedOperatorId = session.user.id;
        }

        await db.update(chatConversations)
            .set(updateData)
            .where(eq(chatConversations.id, conversationId));

        publishChatEvent({
            type: "message-created",
            conversationId,
            message: {
                id: messageId,
                conversationId,
                senderType: "agent",
                senderId: session.user.id as string,
                senderName,
                body: text,
                createdAt: now,
            },
            occurredAt: now,
        });

        return NextResponse.json({
            id: messageId,
            senderType: "agent",
            senderName,
            body: text,
            createdAt: now,
        }, { status: 201 });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_CHAT_REPLY]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
