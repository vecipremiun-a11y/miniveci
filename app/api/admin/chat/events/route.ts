import { NextRequest } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { subscribeToChatEvents } from "@/lib/chat-live-updates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function serializeEvent(event: string, data: unknown) {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * GET /api/admin/chat/events
 * Stream SSE global: el panel admin recibe TODOS los eventos de chat tipados.
 * Cada evento se emite con su tipo (`message_created`, `conversation_created`,
 * `conversation_updated`, `conversation_closed`, `conversation_reopened`) como
 * `event:` SSE, para que el cliente pueda escuchar selectivamente y deduplicar.
 */
export async function GET(req: NextRequest) {
    try {
        await requireAuth();
    } catch (error) {
        if (error instanceof AuthError) {
            return new Response("Unauthorized", { status: 401 });
        }
        throw error;
    }

    let cleanup = () => { };

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;
            const safeClose = () => {
                if (closed) return;
                closed = true;
                cleanup();
                try { controller.close(); } catch { }
            };

            const unsubscribe = subscribeToChatEvents((event) => {
                try {
                    // Emitir como event: <type> para que el cliente filtre selectivamente
                    controller.enqueue(serializeEvent(event.type, event));
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

            controller.enqueue(serializeEvent("connected", { ok: true, t: Date.now() }));
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
            "X-Accel-Buffering": "no",
        },
    });
}
