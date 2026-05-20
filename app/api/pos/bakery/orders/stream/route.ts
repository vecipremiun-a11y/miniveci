import { NextRequest } from "next/server";
import { subscribeToBakeryEvents } from "@/lib/bakery-live-updates";
import { requirePosCredentials, withPosCors, POS_CORS_HEADERS } from "@/lib/pos-auth";
import { NextResponse } from "next/server";

// Node.js runtime: EventEmitter + libSQL no funcionan en Edge.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function OPTIONS() {
    return withPosCors(new NextResponse(null, { status: 204 }));
}

/**
 * GET /api/pos/bakery/orders/stream
 *
 * Server-Sent Events: notificaciones en vivo a POS Veci cuando hay nuevos
 * encargos o cambios de estado. Mismos eventos que /api/admin/bakery/orders/stream.
 *
 * Auth: x-api-key + x-api-secret en headers iniciales del handshake.
 *
 * Eventos:
 *   event: ready          data: { ok: true }
 *   event: order.created  data: { order, occurredAt }
 *   event: order.status_changed  data: { orderId, publicCode, status, previousStatus, occurredAt }
 *   :keepalive            (cada 25s, mantener conexión viva)
 *
 * Nota: si POS Veci no maneja SSE bien, usar polling de GET /api/pos/bakery/orders?since=...
 */
export async function GET(req: NextRequest) {
    const denial = await requirePosCredentials(req);
    if (denial) return denial;

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

            const unsubscribe = subscribeToBakeryEvents((event) => {
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

            (controller as any).__cleanup = () => {
                clearInterval(heartbeat);
                unsubscribe();
                try { controller.close(); } catch { /* ya cerrado */ }
            };
        },
        cancel() { /* no-op */ },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            ...POS_CORS_HEADERS,
        },
    });
}
