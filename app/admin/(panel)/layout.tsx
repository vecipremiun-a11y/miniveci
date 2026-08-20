import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import AdminLayoutShell from "@/components/admin/AdminLayoutShell";

/**
 * Defensa en profundidad: hasta ahora todo /admin dependía únicamente de
 * `proxy.ts` (middleware). Next ha tenido CVEs de bypass de middleware
 * (p. ej. CVE-2025-29927) y un error en el `matcher` abriría el panel completo
 * en silencio. Este layout es un server component, así que la comprobación
 * ocurre en el servidor en cada render, sin depender del middleware.
 *
 * Las APIs bajo /api/admin ya validan sesión y rol por su cuenta.
 */
const ADMIN_ROLES = ["owner", "admin", "preparacion", "reparto", "contenido"];

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/admin/login");
    }

    if (!session.user.role || !ADMIN_ROLES.includes(session.user.role)) {
        redirect("/cuenta");
    }

    return <AdminLayoutShell>{children}</AdminLayoutShell>;
}
