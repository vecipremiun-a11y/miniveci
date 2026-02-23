import { requireAuth } from "@/lib/auth-utils";
import { UserListWrapper } from "@/components/admin/usuarios/UserListWrapper";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
    const session = await requireAuth();

    // Only owner and admin can access
    if (!["owner", "admin"].includes(session.user.role)) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">Usuarios</h2>
                    <p className="text-muted-foreground">
                        Administra los usuarios y permisos de tu equipo.
                    </p>
                </div>
                <Link href="/admin/usuarios/nuevo">
                    <Button className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nuevo Usuario
                    </Button>
                </Link>
            </div>

            <div className="flex-1 bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col">
                <UserListWrapper
                    currentUserId={session.user.id}
                    currentUserRole={session.user.role}
                />
            </div>
        </div>
    );
}
