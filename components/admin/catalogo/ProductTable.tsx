"use client";

import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
} from "@tanstack/react-table";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Edit, Copy, Trash, ImageOff } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

interface Product {
    id: string;
    name: string;
    sku: string;
    webPrice: number;
    webStock: number;
    categoryName: string;
    isPublished: boolean;
    priceSource: string;
    stockSource: string;
    images?: any[];
}

interface ProductTableProps {
    data: Product[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}

export function ProductTable({ data, total, page, totalPages, limit }: ProductTableProps) {
    const router = useRouter();
    const [rowSelection, setRowSelection] = useState({});

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este producto?")) return;

        const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
        if (res.ok) {
            toast.success("Producto eliminado");
            router.refresh();
        } else {
            toast.error("Error al eliminar");
        }
    };

    const columns: ColumnDef<Product>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "image",
            header: "Imagen",
            cell: ({ row }) => {
                // Placeholder image logic
                return (
                    <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center overflow-hidden">
                        <ImageOff className="h-5 w-5 text-gray-400" />
                    </div>
                );
            },
        },
        {
            accessorKey: "name",
            header: "Producto",
            cell: ({ row }) => {
                return (
                    <div>
                        <div className="font-medium">{row.original.name}</div>
                        <div className="text-xs text-muted-foreground">{row.original.sku}</div>
                    </div>
                )
            }
        },
        {
            accessorKey: "categoryName",
            header: "Categoría",
            cell: ({ row }) => <Badge variant="outline">{row.original.categoryName || 'Sin categoría'}</Badge>,
        },
        {
            accessorKey: "webPrice",
            header: "Precio",
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("webPrice")) || 0;
                const source = row.original.priceSource;
                return (
                    <div className="flex flex-col">
                        <span className="font-medium">${amount.toLocaleString('es-CL')}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{source}</span>
                    </div>
                )
            },
        },
        {
            accessorKey: "webStock",
            header: "Stock",
            cell: ({ row }) => {
                const stock = parseFloat(row.getValue("webStock")) || 0;
                const isLow = stock > 0 && stock < 5;
                const isOut = stock === 0;
                const source = row.original.stockSource;

                return (
                    <div className="flex flex-col">
                        <div className={`flex items-center gap-2 ${isOut ? 'text-red-500' : isLow ? 'text-orange-500' : ''}`}>
                            <span className="font-medium">{stock}</span>
                            {isLow && <span className="text-[10px] font-bold">BAJO</span>}
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase">{source}</span>
                    </div>
                );
            },
        },
        {
            accessorKey: "isPublished",
            header: "Estado",
            cell: ({ row }) => (
                <Badge variant={row.original.isPublished ? "default" : "secondary"}>
                    {row.original.isPublished ? "Publicado" : "Borrador"}
                </Badge>
            ),
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const product = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                                <Link href={`/admin/catalogo/${product.id}/editar`} className="flex items-center cursor-pointer">
                                    <Edit className="mr-2 h-4 w-4" /> Editar
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(product.id)}>
                                <Copy className="mr-2 h-4 w-4" /> Copiar ID
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                onClick={() => handleDelete(product.id)}
                            >
                                <Trash className="mr-2 h-4 w-4" /> Eliminar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onRowSelectionChange: setRowSelection,
        state: {
            rowSelection,
        },
    });

    const selectedCount = Object.keys(rowSelection).length;

    return (
        <div className="space-y-4">
            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    No hay resultados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {selectedCount} seleccionados
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const params = new URLSearchParams(window.location.search);
                            params.set("page", String(page - 1));
                            router.push(`?${params.toString()}`);
                        }}
                        disabled={page <= 1}
                    >
                        Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground mx-2">
                        Página {page} de {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const params = new URLSearchParams(window.location.search);
                            params.set("page", String(page + 1));
                            router.push(`?${params.toString()}`);
                        }}
                        disabled={page >= totalPages}
                    >
                        Siguiente
                    </Button>
                </div>
            </div>

            {/* Bulk Actions Floating Bar */}
            {selectedCount > 0 && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 transition-all animate-in slide-in-from-bottom-10">
                    <span className="font-medium">{selectedCount} items</span>
                    <div className="h-4 w-[1px] bg-slate-700"></div>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="hover:bg-slate-800 text-white"
                        onClick={async () => {
                            const ids = Object.keys(rowSelection).map(index => data[parseInt(index)].id);
                            const res = await fetch("/api/admin/products/bulk", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ ids, action: "publish" })
                            });
                            if (res.ok) {
                                toast.success("Productos publicados");
                                setRowSelection({});
                                router.refresh();
                            }
                        }}
                    >Publicar</Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="hover:bg-slate-800 text-white"
                        onClick={async () => {
                            const ids = Object.keys(rowSelection).map(index => data[parseInt(index)].id);
                            const res = await fetch("/api/admin/products/bulk", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ ids, action: "unpublish" })
                            });
                            if (res.ok) {
                                toast.success("Productos despublicados");
                                setRowSelection({});
                                router.refresh();
                            }
                        }}
                    >Despublicar</Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="hover:bg-red-900 text-red-300"
                        onClick={async () => {
                            if (!confirm(`¿Eliminar ${selectedCount} productos?`)) return;
                            const ids = Object.keys(rowSelection).map(index => data[parseInt(index)].id);
                            const res = await fetch("/api/admin/products/bulk", {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ ids, action: "delete" })
                            });
                            if (res.ok) {
                                toast.success("Productos eliminados");
                                setRowSelection({});
                                router.refresh();
                            }
                        }}
                    >Eliminar</Button>
                </div>
            )}
        </div>
    );
}
