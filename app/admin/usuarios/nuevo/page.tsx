import { requireAuth } from "@/lib/auth-utils";
import { UserForm } from "@/components/admin/usuarios/UserForm";

export default async function NuevoUsuarioPage() {
    const session = await requireAuth();

    if (!["owner", "admin"].includes(session.user.role)) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No tienes permisos para crear usuarios.</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="space-y-1">
                <h2 className="text-3xl font-bold tracking-tight">Nuevo Usuario</h2>
                <p className="text-muted-foreground">
                    Crea una nueva cuenta de usuario para tu equipo.
                </p>
            </div>

            <UserForm
                currentUserRole={session.user.role}
                mode="create"
            />
        </div>
    );
}
