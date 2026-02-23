import { ProductForm } from "@/components/admin/catalogo/ProductForm";
import { requireAuth } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

async function getCategories() {
    return db.select().from(categories).orderBy(desc(categories.createdAt));
}

export default async function NewProductPage() {
    await requireAuth();
    const categoriesList = await getCategories();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Nuevo Producto</h2>
                <p className="text-muted-foreground">
                    Agrega un nuevo producto a tu catálogo.
                </p>
            </div>

            <ProductForm categories={categoriesList} />
        </div>
    );
}
