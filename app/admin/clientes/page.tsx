import { Suspense } from "react";
import { requireAuth } from "@/lib/auth-utils";
import { ClientListWrapper } from "@/components/admin/clientes/ClientListWrapper";

export default async function ClientesPage() {
    await requireAuth();

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">Clientes</h2>
                    <p className="text-muted-foreground">
                        Gestiona el directorio de clientes y su historial de pedidos.
                    </p>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col">
                <ClientListWrapper />
            </div>
        </div>
    );
}
