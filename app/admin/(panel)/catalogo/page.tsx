import { Button } from "@/components/ui/button";
import { Cookie, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ProductFilters } from "@/components/admin/catalogo/ProductFilters";
import { requireAuth } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { ProductTableWrapper } from "@/components/admin/catalogo/ProductTableWrapper";
import { CatalogTabs, type CatalogTab } from "@/components/admin/catalogo/CatalogTabs";
import { BakeryProductTable } from "@/components/admin/catalogo/BakeryProductTable";

export const dynamic = "force-dynamic";

async function getCategories() {
    return db.select().from(categories).orderBy(desc(categories.createdAt));
}

export default async function CatalogoPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    await requireAuth();

    const resolvedParams = await searchParams;
    const tabParam = Array.isArray(resolvedParams.tab) ? resolvedParams.tab[0] : resolvedParams.tab;
    const tab: CatalogTab = tabParam === "amasanderia" ? "amasanderia" : "tienda";

    const categoriesList = tab === "tienda" ? await getCategories() : [];
    const newHref = tab === "amasanderia" ? "/admin/catalogo/amasanderia/nuevo" : "/admin/catalogo/nuevo";

    return (
        <div className="space-y-4 sm:space-y-6">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="space-y-1">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Catálogo</h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                        {tab === "tienda"
                            ? "Productos de la tienda con stock y entrega inmediata."
                            : "Productos de amasandería para encargo a futuro."}
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    {tab === "tienda" && (
                        <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Importar POS</span>
                            <span className="sm:hidden">Importar</span>
                        </Button>
                    )}
                    <Button asChild size="sm" className="flex-1 sm:flex-none">
                        <Link href={newHref}>
                            {tab === "amasanderia" ? <Cookie className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                            <span className="hidden sm:inline">
                                {tab === "amasanderia" ? "Nuevo producto amasandería" : "Nuevo Producto"}
                            </span>
                            <span className="sm:hidden">Nuevo</span>
                        </Link>
                    </Button>
                </div>
            </div>

            <CatalogTabs current={tab} />

            {tab === "tienda" ? (
                <>
                    <ProductFilters categories={categoriesList} />
                    <ProductTableWrapper />
                </>
            ) : (
                <BakeryProductTable />
            )}
        </div>
    );
}
