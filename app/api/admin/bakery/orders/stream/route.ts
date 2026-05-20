import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { subscribeToBakeryEvents } from "@/lib/bakery-live-updates";

// Node.js runtime: EventEmitter + libSQL no funcionan en Edge.
// Para multi-instancia (escalado horizontal) migrar a Upstash Redis pub/sub.
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

            // Bienvenida + heartbeat inmediato
            send("ready", { ok: true });

            const unsubscribe = subscribeToBakeryEvents((event) => {
                send(event.type, event);
            });

            // Heartbeat cada 25s
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: keepalive\n\n`));
                } catch {
                    clearInterval(heartbeat);
                    unsubscribe();
                }
            }, 25000);

            // Cleanup en abort
            const cleanup = () => {
                clearInterval(heartbeat);
                unsubscribe();
                try { controller.close(); } catch { /* ya cerrado */ }
            };

            // El runtime de Next/Vercel cierra el stream cuando el cliente desconecta;
            // guardamos la función de cleanup en el closure y la ejecutamos en cancel
            (controller as any).__cleanup = cleanup;
        },
        cancel(reason) {
            // ignorar
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
