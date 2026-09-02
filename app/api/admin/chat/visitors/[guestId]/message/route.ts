import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { chatVisitorSessions, customers, users } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { getOrCreateOpenConversation, type ClientIdentity } from "@/lib/chat-identity";
import { sendAgentTextMessage, MAX_AGENT_MESSAGE } from "@/lib/chat-agent-message";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/chat/visitors/[guestId]/message
 * Body: { body: string }
 *
 * El operador le escribe primero a alguien que está navegando y todavía no ha
 * dicho nada. Crea la conversación si hace falta (o reusa la abierta) y manda
 * el mensaje. El visitante se entera en su próximo latido de presencia.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ guestId: string }> }) {
    try {
        const session = await requireAuth();
        const { guestId } = await context.params;
        const body = await req.json().catch(() => ({}));
        const text = typeof body?.body === "string" ? body.body.trim() : "";

        if (!text) return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
        if (text.length > MAX_AGENT_MESSAGE) {
            return NextResponse.json({ error: `Máx ${MAX_AGENT_MESSAGE} caracteres` }, { status: 400 });
        }

        // Solo se le puede escribir a un visitante que existe: la sesión de
        // presencia es la prueba de que esa persona pasó por el sitio.
        const visitor = await db.query.chatVisitorSessions.findFirst({
            where: eq(chatVisitorSessions.guestId, guestId),
        });
        if (!visitor) {
            return NextResponse.json({ error: "Visitante no encontrado" }, { status: 404 });
        }

        // Si tiene cuenta, la conversación va a nombre de su cuenta; si no, al
        // guestId. Es la misma función que usa el widget, así que el cliente
        // ve una sola conversación y no una duplicada.
        let identity: ClientIdentity = { kind: "guest", guestId: visitor.guestId };
        if (visitor.customerId) {
            const customer = await db.query.customers.findFirst({
                where: eq(customers.id, visitor.customerId),
            });
            // Si la cuenta ya no existe, se le escribe como invitado.
            if (customer) {
                identity = {
                    kind: "customer",
                    customerId: customer.id,
                    name: `${customer.firstName} ${customer.lastName}`.trim(),
                    email: customer.email,
                };
            }
        }

        const conversation = await getOrCreateOpenConversation(identity);

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

        return NextResponse.json({ conversationId: conversation.id, message }, { status: 201 });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[ADMIN_CHAT_VISITOR_MESSAGE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
