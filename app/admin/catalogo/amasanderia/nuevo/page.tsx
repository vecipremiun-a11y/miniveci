import { requireAuth } from "@/lib/auth-utils";
import { BakeryProductForm } from "@/components/admin/catalogo/BakeryProductForm";

export const dynamic = "force-dynamic";

export default async function NuevoBakeryProductPage() {
    await requireAuth();
    return <BakeryProductForm mode="create" />;
}
