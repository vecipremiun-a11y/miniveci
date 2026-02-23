import { requireAuth } from "@/lib/auth-utils";
import { UserDetailWrapper } from "@/components/admin/usuarios/UserDetailWrapper";

export default async function EditarUsuarioPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const session = await requireAuth();
    const { id } = await params;

    if (!["owner", "admin"].includes(session.user.role)) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No tienes permisos para editar usuarios.</p>
            </div>
        );
    }

    return (
        <UserDetailWrapper
            userId={id}
            currentUserRole={session.user.role}
            currentUserId={session.user.id}
        />
    );
}
