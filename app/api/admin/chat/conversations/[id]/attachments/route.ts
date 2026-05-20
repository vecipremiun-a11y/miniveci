import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations, chatMessages, customers, users } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { publishChatEvent } from "@/lib/chat-live-updates";
import { uploadChatAttachment, validateChatAttachment } from "@/lib/chat-attachments";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/admin/chat/conversations/[id]/attachments
 * multipart/form-data: file
 * El operador sube un archivo al cliente.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireAuth();
        const { id: conversationId } = await context.params;

        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
        }

        let validation;
        try {
            validation = validateChatAttachment(file);
        } catch (err: any) {
            return NextResponse.json({ error: err.message || "Archivo inválido" }, { status: 400 });
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

        const { url } = await uploadChatAttachment({ conversationId, file, validation });

        const messageId = crypto.randomUUID();
        const now = new Date().toISOString();
        const filename = (file.name || "").slice(0, 200);
        const preview = validation.messageType === "image" ? "📷 Imagen" : `📎 ${filename || "Archivo"}`;

        await db.insert(chatMessages).values({
            id: messageId,
            conversationId,
            senderType: "agent",
            senderId: session.user.id as string,
            senderName,
            body: "",
            messageType: validation.messageType,
            attachmentUrl: url,
            attachmentName: filename || null,
            attachmentSize: file.size,
            mimeType: file.type || null,
            readByCustomer: false,
            readByAgent: true,
            createdAt: now,
        });

        const updateData: any = {
            lastMessageAt: now,
            lastMessagePreview: preview,
            unreadCustomer: sql`${chatConversations.unreadCustomer} + 1`,
            updatedAt: now,
        };
        const newAssigned = conversation.assignedOperatorId || (session.user.id as string);
        if (!conversation.assignedOperatorId) {
            updateData.assignedOperatorId = session.user.id;
        }

        await db.update(chatConversations)
            .set(updateData)
            .where(eq(chatConversations.id, conversationId));

        const newUnreadCustomer = (conversation.unreadCustomer ?? 0) + 1;

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
                senderType: "agent",
                senderId: session.user.id as string,
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
                assignedOperatorId: newAssigned,
                status: conversation.status as "open" | "closed",
                lastMessageAt: now,
                lastMessagePreview: preview,
                unreadCustomer: newUnreadCustomer,
                unreadAgent: conversation.unreadAgent ?? 0,
                createdAt: conversation.createdAt ?? now,
                customer: customerInfo,
            },
            occurredAt: now,
        });

        return NextResponse.json({
            id: messageId,
            conversationId,
            senderType: "agent",
            senderId: session.user.id as string,
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
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_CHAT_ATTACHMENT_POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
