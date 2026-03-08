"use client";

import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
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
import { MoreHorizontal, Edit, Copy, Eye, Clock, CircleDot } from "lucide-react";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Order {
    id: string;
    orderNumber: string;
    customerName: string;
    customerEmail: string;
    total: number;
    status: string;
    paymentStatus: string;
    deliveryType: string;
    createdAt: string;
}

interface OrderTableProps {
    data: Order[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}

export const statusConfig: Record<string, { label: string, color: string, icon?: any }> = {
    new: { label: "Nuevo", color: "bg-blue-100 text-blue-800 border-blue-200" },
    paid: { label: "Pagado", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    preparing: { label: "Preparando", color: "bg-orange-100 text-orange-800 border-orange-200" },
    ready: { label: "Listo para Entregar", color: "bg-green-100 text-green-800 border-green-200" },
    shipped: { label: "En Camino", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    delivered: { label: "Entregado", color: "bg-slate-100 text-slate-800 border-slate-200" },
    cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800 border-red-200" },
    refunded: { label: "Reembolsado", color: "bg-red-100 text-red-800 border-red-200" },
};

export const paymentStatusConfig: Record<string, { label: string, color: string }> = {
    pending: { label: "Pendiente", color: "text-amber-600 bg-amber-50" },
    paid: { label: "Pagado", color: "text-emerald-600 bg-emerald-50" },
    failed: { label: "Fallido", color: "text-red-600 bg-red-50" },
};

export function OrderTable({ data, total, page, totalPages, limit }: OrderTableProps) {
    const router = useRouter();
    const [rowSelection, setRowSelection] = useState({});

    const columns: ColumnDef<Order>[] = [
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
            accessorKey: "orderNumber",
            header: "Pedido",
            cell: ({ row }) => {
                const date = new Date(row.original.createdAt);

                return (
                    <div>
                        <Link href={`/admin/pedidos/${row.original.id}`} className="font-semibold text-primary hover:underline">
                            #{row.original.orderNumber}
                        </Link>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {format(date, "d MMM, HH:mm", { locale: es })}
                        </div>
                    </div>
                )
            }
        },
        {
            accessorKey: "customerName",
            header: "Cliente",
            cell: ({ row }) => {
                return (
                    <div className="flex flex-col">
                        <span className="font-medium text-sm">{row.original.customerName}</span>
                        <span className="text-xs text-muted-foreground">{row.original.customerEmail}</span>
                    </div>
                )
            },
        },
        {
            accessorKey: "deliveryType",
            header: "Tipo",
            cell: ({ row }) => (
                <Badge variant={row.original.deliveryType === 'delivery' ? 'outline' : 'secondary'} className="capitalize text-[10px]">
                    {row.original.deliveryType === 'delivery' ? 'Despacho' : 'Retiro'}
                </Badge>
            ),
        },
        {
            accessorKey: "status",
            header: "Estado",
            cell: ({ row }) => {
                const status = row.original.status;
                const config = statusConfig[status] || { label: status, color: "bg-gray-100" };
                return (
                    <Badge variant="outline" className={`${config.color} border font-medium px-2 py-0.5 rounded-full`}>
                        <CircleDot className="w-3 h-3 mr-1.5" />
                        {config.label}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "paymentStatus",
            header: "Pago",
            cell: ({ row }) => {
                const status = row.original.paymentStatus;
                const config = paymentStatusConfig[status] || { label: status, color: "text-gray-600" };
                return (
                    <span className={`text-xs font-medium px-2 py-1 rounded-md ${config.color}`}>
                        {config.label}
                    </span>
                );
            },
        },
        {
            accessorKey: "total",
            header: "Total",
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("total")) || 0;
                return (
                    <div className="font-semibold flex items-center gap-2 text-right justify-start">
                        ${amount.toLocaleString('es-CL')}
                    </div>
                );
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const order = row.original;
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
                                <Link href={`/admin/pedidos/${order.id}`} className="flex items-center cursor-pointer">
                                    <Eye className="mr-2 h-4 w-4" /> Ver Detalles
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(order.orderNumber)}>
                                <Copy className="mr-2 h-4 w-4" /> Copiar # Pedido
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
        <div className="flex flex-col h-full space-y-4 p-4 pt-0">
            <div className="rounded-md bg-white border border-gray-100 flex-1 overflow-auto">
                <Table>
                    <TableHeader className="bg-gray-50/50 sticky top-0 z-10 shadow-sm border-b">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
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
                                    className="group hover:bg-gray-50/50 cursor-pointer"
                                    onClick={(e) => {
                                        // Allow checkbox clicks without navigation
                                        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input[type="checkbox"]')) {
                                            return;
                                        }
                                        router.push(`/admin/pedidos/${row.original.id}`)
                                    }}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="py-3">
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
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    No se encontraron pedidos.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between py-2 border-t">
                <div className="text-sm text-muted-foreground">
                    {total} resultados en total
                </div>
                <div className="space-x-2 flex items-center">
                    <span className="text-sm text-muted-foreground mx-2">
                        Página {page} de {totalPages || 1}
                    </span>
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
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const params = new URLSearchParams(window.location.search);
                            params.set("page", String(page + 1));
                            router.push(`?${params.toString()}`);
                        }}
                        disabled={page >= totalPages || totalPages === 0}
                    >
                        Siguiente
                    </Button>
                </div>
            </div>

            {/* Bulk Actions Floating Bar */}
            {selectedCount > 0 && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 transition-all animate-in slide-in-from-bottom-10">
                    <span className="font-medium mr-2">{selectedCount} seleccionados</span>
                    <div className="h-4 w-[1px] bg-slate-700"></div>
                    <Button size="sm" variant="ghost" className="hover:bg-slate-800 text-white hover:text-white">Marcar como Listo</Button>
                    <Button size="sm" variant="ghost" className="hover:bg-slate-800 text-white hover:text-white">Imprimir Tickets</Button>
                </div>
            )}
        </div>
    );
}
