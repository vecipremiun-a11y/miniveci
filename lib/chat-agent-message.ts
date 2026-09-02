import { db } from "@/lib/db";
import { chatConversations, chatMessages, customers } from "@/lib/db/schema";
import { publishChatEvent } from "@/lib/chat-live-updates";
import { eq, sql } from "drizzle-orm";

/**
 * Envío de un mensaje de texto del operador, compartido por las dos vías que
 * tiene el panel para escribirle a alguien:
 *
 *  - responder en una conversación existente (/conversations/[id]/messages)
 *  - escribirle primero a un visitante (/visitors/[guestId]/message)
 *
 * Todo lo que hay que hacer bien está aquí una sola vez: guardar el mensaje,
 * dejar el resumen en la conversación, subir el contador de no leídos del
 * cliente, asignar al operador si nadie lo estaba y emitir los eventos para
 * que el widget y el resto del panel se enteren.
 */

export const MAX_AGENT_MESSAGE = 2000;

export interface AgentMessagePayload {
    id: string;
    conversationId: string;
    senderType: "agent";
    senderId: string;
    senderName: string;
    body: string;
    messageType: "text";
    attachmentUrl: null;
    attachmentName: null;
    attachmentSize: null;
    mimeType: null;
    createdAt: string;
}

export async function sendAgentTextMessage(params: {
    conversation: typeof chatConversations.$inferSelect;
    operatorId: string;
    operatorName: string;
    /** Ya validado y recortado por quien llama. */
    body: string;
}): Promise<AgentMessagePayload> {
    const { conversation, operatorId, operatorName, body } = params;
    const conversationId = conversation.id;
    const messageId = crypto.randomUUID();
    const now = new Date().toISOString();
    const preview = body.slice(0, 140);

    await db.insert(chatMessages).values({
        id: messageId,
        conversationId,
        senderType: "agent",
        senderId: operatorId,
        senderName: operatorName,
        body,
        messageType: "text",
        readByCustomer: false,
        readByAgent: true,
        createdAt: now,
    });

    // Si nadie estaba asignado, este operador queda asignado.
    const newAssigned = conversation.assignedOperatorId || operatorId;
    await db
        .update(chatConversations)
        .set({
            lastMessageAt: now,
            lastMessagePreview: preview,
            unreadCustomer: sql`${chatConversations.unreadCustomer} + 1`,
            updatedAt: now,
            ...(conversation.assignedOperatorId ? {} : { assignedOperatorId: operatorId }),
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

    const message: AgentMessagePayload = {
        id: messageId,
        conversationId,
        senderType: "agent",
        senderId: operatorId,
        senderName: operatorName,
        body,
        messageType: "text",
        attachmentUrl: null,
        attachmentName: null,
        attachmentSize: null,
        mimeType: null,
        createdAt: now,
    };

    // 1. Mensaje nuevo → cliente + admin (eco)
    publishChatEvent({
        type: "message_created",
        conversationId,
        message,
        occurredAt: now,
    });

    // 2. Actualización de metadatos
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
            unreadCustomer: (conversation.unreadCustomer ?? 0) + 1,
            unreadAgent: conversation.unreadAgent ?? 0,
            createdAt: conversation.createdAt ?? now,
            customer: customerInfo,
        },
        occurredAt: now,
    });

    return message;
}
