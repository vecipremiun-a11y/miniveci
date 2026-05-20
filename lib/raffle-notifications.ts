import { db } from "@/lib/db";
import { chatConversations, chatMessages, customers, raffleWinners } from "@/lib/db/schema";
import { publishChatEvent } from "@/lib/chat-live-updates";
import { getOrCreateOpenConversation } from "@/lib/chat-identity";
import { eq } from "drizzle-orm";

export async function notifyRaffleWinner({
    customerId,
    raffleName,
    prizeName,
    prizePosition,
    number,
    winnerId,
}: {
    customerId: string;
    raffleName: string;
    prizeName: string;
    prizePosition: number;
    number: number;
    winnerId: string;
}): Promise<void> {
    try {
        const customer = await db.query.customers.findFirst({ where: eq(customers.id, customerId) });
        if (!customer) return;

        const conversation = await getOrCreateOpenConversation({
            kind: "customer",
            customerId,
            name: `${customer.firstName} ${customer.lastName}`.trim(),
            email: customer.email,
        });
        if (!conversation) return;

        const body = `🏆 ¡Felicitaciones! Ganaste el ${prizePosition}° lugar del sorteo "${raffleName}" con el número ${number}. Premio: ${prizeName}. Pronto te contactaremos para coordinar la entrega.`;
        const now = new Date().toISOString();
        const msgId = crypto.randomUUID();

        await db.insert(chatMessages).values({
            id: msgId,
            conversationId: conversation.id,
            senderType: "system",
            senderId: null,
            senderName: "MiniVeci · Sorteos",
            body,
            messageType: "text",
            attachmentUrl: null,
            attachmentName: null,
            attachmentSize: null,
            mimeType: null,
            readByCustomer: false,
            readByAgent: true,
            createdAt: now,
        });

        await db.update(chatConversations).set({
            lastMessageAt: now,
            lastMessagePreview: body.slice(0, 120),
            unreadCustomer: (conversation.unreadCustomer ?? 0) + 1,
            updatedAt: now,
        }).where(eq(chatConversations.id, conversation.id));

        publishChatEvent({
            type: "message_created",
            conversationId: conversation.id,
            message: {
                id: msgId,
                conversationId: conversation.id,
                senderType: "system",
                senderId: null,
                senderName: "MiniVeci · Sorteos",
                body,
                messageType: "text",
                attachmentUrl: null,
                attachmentName: null,
                attachmentSize: null,
                mimeType: null,
                createdAt: now,
            },
            occurredAt: now,
        });

        await db.update(raffleWinners).set({ notified: true }).where(eq(raffleWinners.id, winnerId));
    } catch (error) {
        console.error("[NOTIFY_RAFFLE_WINNER]", error);
    }
}
