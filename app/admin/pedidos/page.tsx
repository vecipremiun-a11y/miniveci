import { Suspense } from "react";
import { requireAuth } from "@/lib/auth-utils";
import { OrderListWrapper } from "@/components/admin/pedidos/OrderListWrapper";

export default async function PedidosPage() {
    await requireAuth();

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">Pedidos</h2>
                    <p className="text-muted-foreground">
                        Gestiona los pedidos de tus clientes de forma eficiente.
                    </p>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col">
                <OrderListWrapper />
            </div>
        </div>
    );
}
