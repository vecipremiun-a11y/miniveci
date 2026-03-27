import { requireAuth } from "@/lib/auth-utils";
import { MembresiasDashboard } from "@/components/admin/membresias/MembresiasDashboard";

export default async function MembresiasPage() {
    await requireAuth();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Membresías</h2>
                <p className="text-muted-foreground">
                    Panel de suscripciones Premium y métricas de membresías.
                </p>
            </div>
            <MembresiasDashboard />
        </div>
    );
}
