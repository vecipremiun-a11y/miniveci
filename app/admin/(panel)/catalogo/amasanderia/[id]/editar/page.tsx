import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { bakeryProducts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { serializeProduct } from "@/lib/bakery";
import { BakeryProductForm } from "@/components/admin/catalogo/BakeryProductForm";

export const dynamic = "force-dynamic";

export default async function EditarBakeryProductPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    await requireAuth();
    const { id } = await params;

    const row = await db.query.bakeryProducts.findFirst({
        where: eq(bakeryProducts.id, id),
    });
    if (!row) notFound();

    const product = serializeProduct(row);

    return <BakeryProductForm mode="edit" initialData={product} />;
}
