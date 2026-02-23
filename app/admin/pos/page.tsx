import { PosDashboard } from "@/components/admin/pos/PosDashboard";
import { requireAuth } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Integración POS | MiniVeci Admin",
};

export default async function PosPage() {
    await requireAuth();

    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Integración POS</h2>
                    <p className="text-muted-foreground">Configura y monitorea la sincronización con tu Punto de Venta.</p>
                </div>
            </div>

            <PosDashboard />
        </div>
    );
}
