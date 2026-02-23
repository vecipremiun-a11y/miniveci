"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/admin/ui/DataTable";
import { SearchInput } from "@/components/admin/ui/SearchInput";
import { UserCog, Shield, ShieldCheck, Package, Truck, Palette, MoreHorizontal, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface UserData {
    id: string;
    email: string;
    name: string;
    role: string;
    active: boolean | null;
    avatarUrl: string | null;
    createdAt: string | null;
    updatedAt: string | null;
}

const roleLabels: Record<string, string> = {
    owner: "Dueño",
    admin: "Administrador",
    preparacion: "Preparación",
    reparto: "Reparto",
    contenido: "Contenido",
};

const roleColors: Record<string, string> = {
    owner: "bg-amber-100 text-amber-800 border-amber-200",
    admin: "bg-blue-100 text-blue-800 border-blue-200",
    preparacion: "bg-green-100 text-green-800 border-green-200",
    reparto: "bg-purple-100 text-purple-800 border-purple-200",
    contenido: "bg-pink-100 text-pink-800 border-pink-200",
};

const roleIcons: Record<string, React.ReactNode> = {
    owner: <ShieldCheck className="w-3 h-3" />,
    admin: <Shield className="w-3 h-3" />,
    preparacion: <Package className="w-3 h-3" />,
    reparto: <Truck className="w-3 h-3" />,
    contenido: <Palette className="w-3 h-3" />,
};

interface UserListWrapperProps {
    currentUserId: string;
    currentUserRole: string;
}

export function UserListWrapper({ currentUserId, currentUserRole }: UserListWrapperProps) {
    const router = useRouter();
    const [data, setData] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("");

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (roleFilter && roleFilter !== "all") params.set("role", roleFilter);
            if (statusFilter) params.set("status", statusFilter);

            const res = await fetch(`/api/admin/users?${params.toString()}`);
            if (res.ok) {
                const json = await res.json();
                setData(json.users || []);
            }
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    }, [search, roleFilter, statusFilter]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleToggleActive = async (user: UserData) => {
        if (user.id === currentUserId) return;
        try {
            const res = await fetch(`/api/admin/users/${user.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !user.active }),
            });
            if (res.ok) {
                fetchUsers();
            }
        } catch (error) {
            console.error("Error toggling user:", error);
        }
    };

    const handleDelete = async (user: UserData) => {
        if (user.id === currentUserId) return;
        if (!confirm(`¿Estás seguro de eliminar a "${user.name}"? Esta acción no se puede deshacer.`)) return;
        try {
            const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
            if (res.ok) {
                fetchUsers();
            } else {
                const json = await res.json();
                alert(json.error || "Error al eliminar usuario");
            }
        } catch (error) {
            console.error("Error deleting user:", error);
        }
    };

    const columns: ColumnDef<UserData>[] = [
        {
            accessorKey: "name",
            header: "Usuario",
            cell: ({ row }) => {
                const user = row.original;
                const initials = user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);
                return (
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white text-xs font-medium shrink-0">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{user.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                        </div>
                    </div>
                );
            },
        },
        {
            accessorKey: "role",
            header: "Rol",
            cell: ({ row }) => {
                const role = row.original.role;
                return (
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${roleColors[role] || "bg-gray-100 text-gray-800"}`}>
                        {roleIcons[role]}
                        {roleLabels[role] || role}
                    </div>
                );
            },
        },
        {
            accessorKey: "active",
            header: "Estado",
            cell: ({ row }) => {
                const active = row.original.active;
                return active ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        Activo
                    </Badge>
                ) : (
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        Inactivo
                    </Badge>
                );
            },
        },
        {
            accessorKey: "createdAt",
            header: "Creado",
            cell: ({ row }) => {
                const date = row.original.createdAt;
                if (!date) return <span className="text-muted-foreground">-</span>;
                try {
                    return (
                        <span className="text-sm text-muted-foreground">
                            {format(new Date(date), "dd MMM yyyy", { locale: es })}
                        </span>
                    );
                } catch {
                    return <span className="text-muted-foreground">-</span>;
                }
            },
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => {
                const user = row.original;
                const isSelf = user.id === currentUserId;
                const isOwner = user.role === "owner";
                const canManage = currentUserRole === "owner" || (!isOwner && !isSelf);

                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/admin/usuarios/${user.id}`)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                            </DropdownMenuItem>
                            {canManage && (
                                <>
                                    <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                                        {user.active ? (
                                            <>
                                                <ToggleLeft className="mr-2 h-4 w-4" />
                                                Desactivar
                                            </>
                                        ) : (
                                            <>
                                                <ToggleRight className="mr-2 h-4 w-4" />
                                                Activar
                                            </>
                                        )}
                                    </DropdownMenuItem>
                                    {currentUserRole === "owner" && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                className="text-red-600 focus:text-red-600"
                                                onClick={() => handleDelete(user)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Eliminar
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    return (
        <div className="flex flex-col h-full">
            {/* Filters */}
            <div className="p-4 border-b flex flex-wrap items-center gap-3">
                <SearchInput
                    placeholder="Buscar por nombre o correo..."
                    value={search}
                    onChange={setSearch}
                    className="w-full sm:w-64"
                />
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Todos los roles" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los roles</SelectItem>
                        <SelectItem value="owner">Dueño</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="preparacion">Preparación</SelectItem>
                        <SelectItem value="reparto">Reparto</SelectItem>
                        <SelectItem value="contenido">Contenido</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="active">Activos</SelectItem>
                        <SelectItem value="inactive">Inactivos</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Table */}
            <div className="flex-1 p-4">
                <DataTable
                    columns={columns}
                    data={data}
                    loading={loading}
                    onRowClick={(row) => router.push(`/admin/usuarios/${row.id}`)}
                    emptyIcon={UserCog}
                    emptyTitle="Sin usuarios"
                    emptyDescription="No se encontraron usuarios. Crea uno nuevo para empezar."
                />
            </div>
        </div>
    );
}
