import { requireAuth } from "@/lib/auth-utils";
import { ApiCredentialsCard } from "@/components/admin/configuracion/ApiCredentialsCard";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
    await requireAuth();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Configuración</h2>
                <p className="text-muted-foreground">Administra las credenciales de integración del POS.</p>
            </div>

            <ApiCredentialsCard />
        </div>
    );
}
