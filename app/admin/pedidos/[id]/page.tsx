import { Suspense } from "react";
import { requireAuth } from "@/lib/auth-utils";
import { OrderDetailWrapper } from "@/components/admin/pedidos/OrderDetailWrapper";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function PedidoDetallePage({ params }: { params: Promise<{ id: string }> }) {
    await requireAuth();
    const { id } = await params;

    // We can pre-fetch the order just to check if it exists or let the wrapper fetch everything.
    // Let's check existence here so we can return a 404 cleanly.
    const order = await db.query.orders.findFirst({
        where: eq(orders.id, id),
    });

    if (!order) {
        notFound();
    }

    return (
        <div className="space-y-6">
            <Suspense fallback={<div className="p-8 text-center text-muted-foreground animate-pulse">Cargando detalles del pedido...</div>}>
                <OrderDetailWrapper orderId={id} initialOrderNumber={order.orderNumber} />
            </Suspense>
        </div>
    );
}
