"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/admin/ui/DataTable";
import { StatusBadge } from "@/components/admin/ui/StatusBadge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserRound, Phone, Mail, MapPin, SearchX, ShoppingBag, Banknote } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Order {
    id: string;
    orderNumber: string;
    total: number;
    status: string;
    createdAt: string;
    deliveryType: string;
}

interface ClientDetail {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    rut: string | null;
    shippingAddress: string | null;
    shippingComuna: string | null;
    shippingCity: string | null;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: string;
    orders: Order[];
}

export function ClientDetailWrapper({ email }: { email: string }) {
    const router = useRouter();
    const [client, setClient] = useState<ClientDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchClient = async () => {
            try {
                const res = await fetch(`/api/admin/clients/${encodeURIComponent(email)}`);
                if (res.ok) {
                    const data = await res.json();
                    setClient(data);
                } else if (res.status === 404) {
                    setError("Cliente no encontrado o no tiene pedidos registrados.");
                } else {
                    setError("Error al cargar los datos del cliente.");
                }
            } catch (err) {
                console.error(err);
                setError("Error de red al cargar el cliente.");
            } finally {
                setLoading(false);
            }
        };

        fetchClient();
    }, [email]);

    const orderColumns: ColumnDef<Order>[] = [
        {
            accessorKey: "orderNumber",
            header: "Nro. Pedido",
            cell: ({ row }) => <div className="font-medium text-blue-600">#{row.getValue("orderNumber")}</div>
        },
        {
            accessorKey: "createdAt",
            header: "Fecha",
            cell: ({ row }) => (
                <div className="text-muted-foreground">
                    {format(new Date(row.getValue("createdAt")), "PP p", { locale: es })}
                </div>
            )
        },
        {
            accessorKey: "deliveryType",
            header: "Entrega",
            cell: ({ row }) => <div className="capitalize">{row.getValue("deliveryType")}</div>
        },
        {
            accessorKey: "status",
            header: "Estado",
            cell: ({ row }) => <StatusBadge status={row.getValue("status")} type="order" />
        },
        {
            accessorKey: "total",
            header: "Total",
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("total"));
                const formatted = new Intl.NumberFormat("es-CL", {
                    style: "currency",
                    currency: "CLP",
                }).format(amount);
                return <div className="whitespace-nowrap font-medium text-right font-mono">{formatted}</div>;
            }
        }
    ];

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-full bg-white rounded-lg border">
                <SearchX className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-2xl font-bold tracking-tight mb-2">Error</h2>
                <p className="text-muted-foreground mb-6">{error}</p>
                <Button onClick={() => router.push("/admin/clientes")} variant="outline">
                    Volver a Clientes
                </Button>
            </div>
        );
    }

    if (loading || !client) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-8 w-64" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-48 rounded-lg" />
                    <Skeleton className="h-48 rounded-lg md:col-span-2" />
                </div>
                <Skeleton className="h-96 rounded-lg" />
            </div>
        );
    }

    const formatGasto = new Intl.NumberFormat("es-CL", {
        style: "currency",
        currency: "CLP",
    }).format(client.totalSpent);

    const fullAddress = [client.shippingAddress, client.shippingComuna, client.shippingCity].filter(Boolean).join(", ");

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">{client.name || "Cliente Sin Nombre"}</h2>
                    <p className="text-muted-foreground">Perfil del cliente</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Perfil & Contacto */}
                <div className="bg-white p-6 rounded-lg border shadow-sm space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-3 rounded-full">
                            <UserRound className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Contacto</h3>
                            {client.rut && <p className="text-sm text-muted-foreground">RUT: {client.rut}</p>}
                        </div>
                    </div>
                    <div className="space-y-3 pt-4 border-t">
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                <span>Correo:</span>
                            </div>
                            <span className="font-medium text-foreground">{client.email}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                <span>Teléfono:</span>
                            </div>
                            <span className="font-medium text-foreground">{client.phone || "No registrado"}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>Ubicación:</span>
                            </div>
                            <span className="font-medium text-foreground text-right max-w-[150px] truncate" title={fullAddress || "No registrada"}>
                                {fullAddress || "No registrada"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Métricas del Cliente */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
                    <div className="bg-white p-6 rounded-lg border shadow-sm flex flex-col justify-center">
                        <div className="flex items-center gap-2 text-muted-foreground mb-4">
                            <ShoppingBag className="h-5 w-5" />
                            <h3 className="font-semibold">Historial de Pedidos</h3>
                        </div>
                        <div className="text-4xl font-black">{client.totalOrders}</div>
                        <p className="text-sm text-muted-foreground mt-2">
                            Último pedido el {client.lastOrderDate ? format(new Date(client.lastOrderDate), "PP", { locale: es }) : "N/A"}
                        </p>
                    </div>

                    <div className="bg-emerald-50/50 p-6 rounded-lg border border-emerald-100 shadow-sm flex flex-col justify-center">
                        <div className="flex items-center gap-2 text-emerald-700 font-medium mb-4">
                            <Banknote className="h-5 w-5" />
                            <h3>Valor Total de Vida (LTV)</h3>
                        </div>
                        <div className="text-4xl font-black text-emerald-800">{formatGasto}</div>
                        <p className="text-sm text-emerald-600/80 mt-2">Acumulado en todas sus compras</p>
                    </div>
                </div>
            </div>

            {/* Tabla de los pedidos iterados */}
            <div className="bg-white rounded-lg border shadow-sm px-4 pt-4 pb-2 mb-10 overflow-hidden flex flex-col">
                <h3 className="text-lg font-bold mb-4">Pedidos Anteriores</h3>
                <DataTable
                    columns={orderColumns}
                    data={client.orders}
                    onRowClick={(row) => router.push(`/admin/pedidos/${row.id}`)}
                />
            </div>
        </div>
    );
}
