import { subscribeToProductChanges } from "@/lib/product-live-updates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function serializeEvent(event: string, data: unknown) {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function GET(req: Request) {
    let cleanup = () => {};

    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            let closed = false;

            const safeClose = () => {
                if (closed) return;
                closed = true;
                cleanup();
                try {
                    controller.close();
                } catch {
                    // Stream already closed.
                }
            };

            const unsubscribe = subscribeToProductChanges((event) => {
                try {
                    controller.enqueue(serializeEvent("product-change", event));
                } catch {
                    safeClose();
                }
            });

            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
                } catch {
                    safeClose();
                }
            }, 25000);

            cleanup = () => {
                unsubscribe();
                clearInterval(heartbeat);
            };

            controller.enqueue(serializeEvent("connected", {
                ok: true,
                occurredAt: new Date().toISOString(),
            }));

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
