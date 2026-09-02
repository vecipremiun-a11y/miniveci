import { requireAuth } from "@/lib/auth-utils";
import { ApiCredentialsCard } from "@/components/admin/configuracion/ApiCredentialsCard";
import { DeliveryConditionsCard } from "@/components/admin/configuracion/DeliveryConditionsCard";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
    await requireAuth();

    return (
        <div className="space-y-4 sm:space-y-6">
            <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Configuración</h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Condiciones de envío de la tienda y credenciales de integración del POS.
                </p>
            </div>

            <DeliveryConditionsCard />
            <ApiCredentialsCard />
        </div>
    );
}
