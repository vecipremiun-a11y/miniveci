import { requireAuth } from "@/lib/auth-utils";
import { MembresiasDashboard } from "@/components/admin/membresias/MembresiasDashboard";

export default async function MembresiasPage() {
    await requireAuth();

    return (
        <div className="space-y-4 sm:space-y-6">
            <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Membresías</h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Panel de suscripciones Premium y métricas de membresías.
                </p>
            </div>
            <MembresiasDashboard />
        </div>
    );
}
