import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations, chatMessages, customers } from "@/lib/db/schema";
import { resolveClientIdentity, ownsConversation } from "@/lib/chat-identity";
import { publishChatEvent } from "@/lib/chat-live-updates";
import { uploadChatAttachment, validateChatAttachment } from "@/lib/chat-attachments";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/chat/conversation/[id]/attachments
 * multipart/form-data: file, guestId
 * Sube el archivo, crea el mensaje y emite eventos SSE.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id: conversationId } = await context.params;
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const guestIdFromForm = (formData.get("guestId") as string | null) || undefined;

        if (!file) {
            return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
        }

        let validation;
        try {
            validation = validateChatAttachment(file);
        } catch (err: any) {
            return NextResponse.json({ error: err.message || "Archivo inválido" }, { status: 400 });
        }

        const identity = await resolveClientIdentity(req, guestIdFromForm);
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

        const { url } = await uploadChatAttachment({ conversationId, file, validation });

        const senderName = identity.kind === "customer"
            ? identity.name
            : (conversation.guestName || "Visitante");

        const messageId = crypto.randomUUID();
        const now = new Date().toISOString();
        const filename = (file.name || "").slice(0, 200);
        const preview = validation.messageType === "image" ? "📷 Imagen" : `📎 ${filename || "Archivo"}`;

        await db.insert(chatMessages).values({
            id: messageId,
            conversationId,
            senderType: "customer",
            senderId: identity.kind === "customer" ? identity.customerId : null,
            senderName,
            body: "",
            messageType: validation.messageType,
            attachmentUrl: url,
            attachmentName: filename || null,
            attachmentSize: file.size,
            mimeType: file.type || null,
            readByCustomer: true,
            readByAgent: false,
            createdAt: now,
        });

        const newUnreadAgent = (conversation.unreadAgent ?? 0) + 1;

        await db.update(chatConversations)
            .set({
                lastMessageAt: now,
                lastMessagePreview: preview,
                unreadAgent: sql`${chatConversations.unreadAgent} + 1`,
                updatedAt: now,
            })
            .where(eq(chatConversations.id, conversationId));

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

        publishChatEvent({
            type: "message_created",
            conversationId,
            message: {
                id: messageId,
                conversationId,
                senderType: "customer",
                senderId: identity.kind === "customer" ? identity.customerId : null,
                senderName,
                body: "",
                messageType: validation.messageType,
                attachmentUrl: url,
                attachmentName: filename || null,
                attachmentSize: file.size,
                mimeType: file.type || null,
                createdAt: now,
            },
            occurredAt: now,
        });

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
                lastMessagePreview: preview,
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
            body: "",
            messageType: validation.messageType,
            attachmentUrl: url,
            attachmentName: filename || null,
            attachmentSize: file.size,
            mimeType: file.type || null,
            createdAt: now,
        }, { status: 201 });
    } catch (error) {
        console.error("[CHAT_ATTACHMENT_POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
