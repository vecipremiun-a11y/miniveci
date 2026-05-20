import { requireAuth } from "@/lib/auth-utils";
import { SuscriptoresList } from "@/components/admin/membresias/SuscriptoresList";

export default async function SuscriptoresPage() {
    await requireAuth();

    return (
        <div className="space-y-4 sm:space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Suscriptores</h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        Lista de todos los clientes con suscripción Premium.
                    </p>
                </div>
            </div>
            <div className="flex-1 bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col">
                <SuscriptoresList />
            </div>
        </div>
    );
}
