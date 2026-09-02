import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatConversations, users } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { sendAgentTextMessage, MAX_AGENT_MESSAGE } from "@/lib/chat-agent-message";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

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
        if (text.length > MAX_AGENT_MESSAGE) {
            return NextResponse.json({ error: `Máx ${MAX_AGENT_MESSAGE} caracteres` }, { status: 400 });
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

        const message = await sendAgentTextMessage({
            conversation,
            operatorId: session.user.id as string,
            operatorName: senderName,
            body: text,
        });

        return NextResponse.json(message, { status: 201 });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_CHAT_REPLY]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
