import { db } from "@/lib/db";
import { products, categories } from "@/lib/db/schema";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
    const allProducts = await db
        .select({
            id: products.id,
            name: products.name,
            webPrice: products.webPrice,
            webStock: products.webStock,
            category: categories.name,
            isPublished: products.isPublished,
        })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .orderBy(desc(products.id));

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Catálogo</h2>
                    <p className="text-muted-foreground">
                        Gestiona tus productos y sincronización.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/admin/products/new">
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Input placeholder="Buscar productos..." className="max-w-sm" />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Precio Web</TableHead>
                            <TableHead>Stock Web</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No hay productos registrados.
                                </TableCell>
                            </TableRow>
                        ) : (
                            allProducts.map((product) => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>{product.category || "Sin categoría"}</TableCell>
                                    <TableCell>${product.webPrice || 0}</TableCell>
                                    <TableCell>{product.webStock || 0}</TableCell>
                                    <TableCell>
                                        {product.isPublished ? (
                                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                                Publicado
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                                Borrador
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" asChild>
                                            <Link href={`/admin/products/${product.id}`}>Editar</Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
