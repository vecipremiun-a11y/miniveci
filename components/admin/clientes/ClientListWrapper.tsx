"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/admin/ui/DataTable";
import { SearchInput } from "@/components/admin/ui/SearchInput";
import { UsersRound } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ClientData {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    rut: string | null;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: string;
}

const columns: ColumnDef<ClientData>[] = [
    {
        accessorKey: "name",
        header: "Nombre",
        cell: ({ row }) => (
            <div className="font-medium">{row.original.name || "Sin nombre"}</div>
        ),
    },
    {
        accessorKey: "email",
        header: "Correo Electrónico",
        cell: ({ row }) => <div className="text-muted-foreground">{row.getValue("email")}</div>
    },
    {
        accessorKey: "phone",
        header: "Teléfono",
        cell: ({ row }) => <div>{row.original.phone || "-"}</div>
    },
    {
        accessorKey: "totalOrders",
        header: "Pedidos Obtenidos",
        cell: ({ row }) => <div className="text-center font-medium bg-secondary/50 rounded inline-block px-2 text-secondary-foreground">{row.getValue("totalOrders")}</div>
    },
    {
        accessorKey: "totalSpent",
        header: "LTV (Total Gastado)",
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("totalSpent") || "0");
            const formatted = new Intl.NumberFormat("es-CL", {
                style: "currency",
                currency: "CLP",
            }).format(amount);
            return <div className="font-bold text-right text-emerald-600">{formatted}</div>;
        },
    },
    {
        accessorKey: "lastOrderDate",
        header: "Último Pedido",
        cell: ({ row }) => {
            const dateStr = row.getValue("lastOrderDate") as string;
            if (!dateStr) return <div>-</div>;
            return <div className="text-muted-foreground whitespace-nowrap">{format(new Date(dateStr), "PP", { locale: es })}</div>;
        },
    }
];

export function ClientListWrapper() {
    const router = useRouter();
    const [clients, setClients] = useState<ClientData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    const fetchClients = async (searchQuery: string = "") => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/clients?search=${encodeURIComponent(searchQuery)}`);
            if (res.ok) {
                const data = await res.json();
                setClients(data.clients || []);
            }
        } catch (error) {
            console.error("Error fetching clients:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const debounceId = setTimeout(() => {
            fetchClients(search);
        }, 500);
        return () => clearTimeout(debounceId);
    }, [search]);

    const handleRowClick = (client: ClientData) => {
        router.push(`/admin/clientes/${encodeURIComponent(client.email)}`);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/30">
            <div className="p-4 border-b flex items-center justify-between gap-4 bg-white">
                <div className="w-full max-w-md">
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Buscar cliente por nombre, correo, teléfono..."
                    />
                </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
                <DataTable
                    columns={columns}
                    data={clients}
                    loading={loading}
                    onRowClick={handleRowClick}
                    emptyIcon={UsersRound}
                    emptyTitle="No hay clientes"
                    emptyDescription="No se han registrado clientes aún o ninguno coincide con tu búsqueda."
                />
            </div>
        </div>
    );
}
