import { ProductForm } from "@/components/admin/catalogo/ProductForm";
import { requireAuth } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { products, categories, productImages } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

async function getCategories() {
    return db.select().from(categories).orderBy(desc(categories.createdAt));
}

async function getProduct(id: string) {
    const product = await db.query.products.findFirst({
        where: eq(products.id, id),
    });

    // We assume images are fetched or we fetch them if needed for the form
    // The form currently doesn't manage images deep logic yet, but for completeness:
    // const images = await db.select().from(productImages).where(eq(productImages.productId, id));

    if (!product) return null;
    return product;
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
    await requireAuth();
    const { id } = await params;

    const product = await getProduct(id);
    const categoriesList = await getCategories();

    if (!product) {
        notFound();
    }

    // Transform product data to match form structure if needed or pass as is
    // The form expects certain types (e.g. coerce numbers). 
    // Drizzle returns numbers for integer columns as numbers, so it should be fine.

    // Need to handle nulls which might not match Zod schema expectation if default values aren't handling it.
    // We'll trust the form's defaultValues logic to handle undefineds/nulls mostly.

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Editar Producto</h2>
                <p className="text-muted-foreground">
                    Modifica los detalles del producto.
                </p>
            </div>

            <ProductForm initialData={product as any} categories={categoriesList} />
        </div>
    );
}
