import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations, chatMessages, customers } from "@/lib/db/schema";
import { resolveClientIdentity, ownsConversation } from "@/lib/chat-identity";
import { publishChatEvent } from "@/lib/chat-live-updates";
import { asc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const MAX_BODY = 2000;

/**
 * GET /api/chat/conversation/[id]/messages[?guestId=...]
 * Devuelve el historial de un hilo del cliente (abierto o cerrado) para poder
 * releerlo desde el historial. Marca como leídos los mensajes del agente.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id: conversationId } = await context.params;
        const url = new URL(req.url);
        const guestId = url.searchParams.get("guestId") || undefined;

        const identity = await resolveClientIdentity(req, guestId);
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

        const messages = await db
            .select()
            .from(chatMessages)
            .where(eq(chatMessages.conversationId, conversationId))
            .orderBy(asc(chatMessages.createdAt))
            .limit(200);

        if (conversation.unreadCustomer && conversation.unreadCustomer > 0) {
            await db
                .update(chatConversations)
                .set({ unreadCustomer: 0 })
                .where(eq(chatConversations.id, conversationId));
        }

        return NextResponse.json({
            conversation: {
                id: conversation.id,
                status: conversation.status,
                createdAt: conversation.createdAt,
            },
            messages: messages.map(m => ({
                id: m.id,
                conversationId: m.conversationId,
                senderType: m.senderType,
                senderId: m.senderId,
                senderName: m.senderName,
                body: m.body,
                messageType: (m as any).messageType || "text",
                attachmentUrl: (m as any).attachmentUrl ?? null,
                attachmentName: (m as any).attachmentName ?? null,
                attachmentSize: (m as any).attachmentSize ?? null,
                mimeType: (m as any).mimeType ?? null,
                createdAt: m.createdAt,
            })),
            identity: {
                kind: identity.kind,
                name: identity.kind === "customer" ? identity.name : null,
            },
        });
    } catch (error) {
        console.error("[CHAT_MESSAGES_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

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
            messageType: "text",
            readByCustomer: true,
            readByAgent: false,
            createdAt: now,
        });

        const newUnreadAgent = (conversation.unreadAgent ?? 0) + 1;

        await db.update(chatConversations)
            .set({
                lastMessageAt: now,
                lastMessagePreview: text.slice(0, 140),
                unreadAgent: sql`${chatConversations.unreadAgent} + 1`,
                updatedAt: now,
            })
            .where(eq(chatConversations.id, conversationId));

        // Cargar customer si hay (para que admin vea info al recibir conversation_updated)
        let customerInfo = null;
        if (conversation.customerId) {
            const c = await db.query.customers.findFirst({
                where: eq(customers.id, conversation.customerId),
            });
            if (c) {
                customerInfo = {
                    id: c.id,
                    firstName: c.firstName,
                    lastName: c.lastName,
                    email: c.email,
                    phone: c.phone,
                };
            }
        }

        // 1. Mensaje nuevo → admin + cliente
        publishChatEvent({
            type: "message_created",
            conversationId,
            message: {
                id: messageId,
                conversationId,
                senderType: "customer",
                senderId: identity.kind === "customer" ? identity.customerId : null,
                senderName,
                body: text,
                messageType: "text",
                attachmentUrl: null,
                attachmentName: null,
                attachmentSize: null,
                mimeType: null,
                createdAt: now,
            },
            occurredAt: now,
        });

        // 2. Actualización metadatos conversación → admin (sidebar)
        publishChatEvent({
            type: "conversation_updated",
            conversationId,
            conversation: {
                id: conversation.id,
                customerId: conversation.customerId,
                guestId: conversation.guestId,
                guestName: conversation.guestName,
                guestEmail: conversation.guestEmail,
                assignedOperatorId: conversation.assignedOperatorId,
                status: conversation.status as "open" | "closed",
                lastMessageAt: now,
                lastMessagePreview: text.slice(0, 140),
                unreadCustomer: conversation.unreadCustomer ?? 0,
                unreadAgent: newUnreadAgent,
                createdAt: conversation.createdAt ?? now,
                customer: customerInfo,
            },
            occurredAt: now,
        });

        return NextResponse.json({
            id: messageId,
            conversationId,
            senderType: "customer",
            senderId: identity.kind === "customer" ? identity.customerId : null,
            senderName,
            body: text,
            messageType: "text",
            attachmentUrl: null,
            attachmentName: null,
            attachmentSize: null,
            mimeType: null,
            createdAt: now,
        }, { status: 201 });
    } catch (error) {
        console.error("[CHAT_MESSAGE_POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
