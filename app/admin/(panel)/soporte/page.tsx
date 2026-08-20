import { requireAuth } from "@/lib/auth-utils";
import { SoporteClient } from "@/components/admin/soporte/SoporteClient";

export const dynamic = "force-dynamic";

export default async function SoportePage() {
    await requireAuth();
    return (
        <div className="h-[calc(100vh-5rem)] -m-6">
            <SoporteClient />
        </div>
    );
}
