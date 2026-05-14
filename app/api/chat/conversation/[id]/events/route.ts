import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { chatConversations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resolveClientIdentity, ownsConversation } from "@/lib/chat-identity";
import { subscribeToChatEvents } from "@/lib/chat-live-updates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function serializeEvent(event: string, data: unknown) {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * GET /api/chat/conversation/[id]/events?guestId=...
 * Stream SSE: el cliente recibe mensajes nuevos en tiempo real.
 * EventSource no soporta headers custom, por eso guestId va en query.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
    const { id: conversationId } = await context.params;
    const url = new URL(req.url);
    const guestId = url.searchParams.get("guestId") || undefined;

    const identity = await resolveClientIdentity(req, guestId);
    if (!identity) {
        return new Response("Sin identidad", { status: 401 });
    }

    const conversation = await db.query.chatConversations.findFirst({
        where: eq(chatConversations.id, conversationId),
    });
    if (!conversation) {
        return new Response("Conversación no encontrada", { status: 404 });
    }
    if (!ownsConversation(identity, conversation)) {
        return new Response("Sin acceso", { status: 403 });
    }

    let cleanup = () => {};

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;
            const safeClose = () => {
                if (closed) return;
                closed = true;
                cleanup();
                try { controller.close(); } catch {}
            };

            const unsubscribe = subscribeToChatEvents((event) => {
                if (event.conversationId !== conversationId) return;
                // Cliente solo necesita ver mensajes del agente y mensajes propios (eco)
                if (event.type !== "message-created") return;
                try {
                    controller.enqueue(serializeEvent("message", event.message));
                } catch {
                    safeClose();
                }
            });

            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: ping ${Date.now()}\n\n`));
                } catch {
                    safeClose();
                }
            }, 25000);

            cleanup = () => {
                unsubscribe();
                clearInterval(heartbeat);
            };

            controller.enqueue(serializeEvent("connected", { ok: true }));
            req.signal.addEventListener("abort", safeClose, { once: true });
        },
        cancel() {
            cleanup();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
        },
    });
}
