import { requireAuth } from "@/lib/auth-utils";
import { ClientDetailWrapper } from "@/components/admin/clientes/ClientDetailWrapper";

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAuth();
    const resolvedParams = await params;
    const email = decodeURIComponent(resolvedParams.id);

    return (
        <div className="space-y-6 h-full flex flex-col">
            <ClientDetailWrapper email={email} />
        </div>
    );
}
