import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ProductTable } from "@/components/admin/catalogo/ProductTable";
import { ProductFilters } from "@/components/admin/catalogo/ProductFilters";
import { requireAuth } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { ProductTableWrapper } from "@/components/admin/catalogo/ProductTableWrapper";

export const dynamic = 'force-dynamic';

async function getCategories() {
    return db.select().from(categories).orderBy(desc(categories.createdAt));
}

async function getProducts({ searchParams }: { searchParams: any }) {
    const params = new URLSearchParams(searchParams);
    // We reuse our own API logic or duplicate it here. 
    // Ideally calling the internal service function but accessing via fetch to localhost in RSC is tricky with absolute URLs.
    // So we'll fetch from the API using absolute URL if defined or just replicate the DB call for server component efficiency.
    // For this implementation, let's call the API if we had a HOST variable, but safer to just query DB directly in RSC 
    // to avoid loopback network overhead and configuration issues.

    // HOWEVER, recreating the exact filtering logic from the API Route here is duplication.
    // Practical approach for now: Client-side fetching OR Reusing the logic.
    // Let's rely on client-side fetching for the table data? 
    // No, RSC is better for initial load. 
    // Let's assume we can fetch data directly from DB here for the initial page load.

    // Actually, to avoid code duplication with the complex filtering in API route, 
    // let's fetch from the API if possible, or just accept duplication for now.
    // Let's implement a direct DB call here similar to the API.

    // ... (omitted for brevity, will implement simpler fetch or direct DB access)
    // To keep it clean, I will skip re-implementing the full filter logic here and rely on the API 
    // being called from the client OR implementing a basic fetch.
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    try {
        const res = await fetch(`${baseUrl}/api/admin/products?${params.toString()}`, {
            cache: 'no-store',
            headers: {
                // Ensure auth cookies are passed if API requires them, 
                // but since we are in RSC, we might need to bypass auth or pass token.
                // Simpler: Direct DB query.
            }
        });
        if (!res.ok) return { products: [], total: 0, page: 1, totalPages: 1 };
        return res.json();
    } catch (e) {
        return { products: [], total: 0, page: 1, totalPages: 1 };
    }
}

export default async function CatalogoPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    await requireAuth();

    // Since we are running in a build/dev environment where exact URL might vary,
    // and passing cookies to API route from RSC is annoying.
    // Best practice in Next.js App Dir: Extract logic to a controller/service function `getProductsController`
    // that can be called by both API Route and RSC.
    // For now, I will allow the page to render with a client-side fetch or just implemented 
    // a basic list.

    const resolvedParams = await searchParams;
    const categoriesList = await getCategories();

    // Temporary client-side only data fetching strategy or SWR is often used for dashboards.
    // BUT the prompt asks for "Página de listado... Usa fetch a las API routes".
    // So I will make the Table component handle the data fetching via query (React Query) OR
    // pass initial data. 

    // Let's make the page Client Component for data fetching ease or keep it Server Component
    // and fetch data. 
    // I will use a simple fetch to the API from the server side, assuming localhost:3000 works.
    // To avoid 401, I'd need to handle auth.

    // ALTERNATIVE: Render the layout and let the Table fetch data client-side.
    // This is safer for avoiding 401 errors in RSC without cookie forwarding.

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">Catálogo</h2>
                    <p className="text-muted-foreground">
                        Gestiona tus productos, inventario y precios.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Importar POS
                    </Button>
                    <Button asChild>
                        <Link href="/admin/catalogo/nuevo">
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo Producto
                        </Link>
                    </Button>
                </div>
            </div>

            <ProductFilters categories={categoriesList} />

            {/* 
         We are loading data client-side for the table to handle filters easily via URL params 
         without full page reloads, reusing the API logic.
         I'll wrap the table in a Client Component that fetches data.
      */}
            <ProductTableWrapper />
        </div>
    );
}


