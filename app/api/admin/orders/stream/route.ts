import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { subscribeToStoreOrderEvents } from "@/lib/store-live-updates";

// Node.js runtime: EventEmitter + libSQL no funcionan en Edge.
// Para multi-instancia migrar a Upstash Redis pub/sub.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ROLES = new Set(["owner", "admin", "preparacion", "reparto", "contenido"]);

export async function GET(_req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id || !ADMIN_ROLES.has(session.user.role)) {
        return new Response("Unauthorized", { status: 401 });
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            const send = (eventName: string, data: unknown) => {
                try {
                    const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
                    controller.enqueue(encoder.encode(payload));
                } catch {
                    // controller cerrado
                }
            };

            send("ready", { ok: true });

            const unsubscribe = subscribeToStoreOrderEvents((event) => {
                send(event.type, event);
            });

            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: keepalive\n\n`));
                } catch {
                    clearInterval(heartbeat);
                    unsubscribe();
                }
            }, 25000);

            const cleanup = () => {
                clearInterval(heartbeat);
                unsubscribe();
                try { controller.close(); } catch { /* ya cerrado */ }
            };

            (controller as any).__cleanup = cleanup;
        },
        cancel(reason) {
            void reason;
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
