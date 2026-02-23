"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Calendar as CalendarIcon, Download } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { Badge } from "@/components/ui/badge";

interface OrderFiltersProps {
    counts: {
        all: number;
        new: number;
        preparing: number;
        ready: number;
        shipped: number;
        delivered: number;
        cancelled: number;
    };
    currentTab: string;
}

export function OrderFilters({ counts, currentTab }: OrderFiltersProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [searchQuery, setSearchQuery] = useState(searchParams.get("search")?.toString() || "");

    const createQueryString = (name: string, value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set(name, value);
        } else {
            params.delete(name);
        }
        params.set("page", "1"); // Reset to page 1 on filter change
        return params.toString();
    };

    const debouncedSearch = useDebouncedCallback((value: string) => {
        router.push(pathname + "?" + createQueryString("search", value));
    }, 500);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        debouncedSearch(e.target.value);
    };

    const handleTabChange = (value: string) => {
        router.push(pathname + "?" + createQueryString("status", value === "all" ? "" : value));
    };

    // Calculate active filters count
    const activeFilters = Array.from(searchParams.keys()).filter(k =>
        !['page', 'limit', 'sort', 'order', 'status', 'search'].includes(k)
    ).length;

    return (
        <div className="border-b bg-gray-50/50 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full sm:w-auto overflow-x-auto">
                    <TabsList className="bg-transparent border-0 space-x-2">
                        <TabsTrigger value="all" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-full px-4 text-sm gap-2">
                            Todos <span className="text-muted-foreground text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">{counts.all}</span>
                        </TabsTrigger>
                        <TabsTrigger value="new" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-full px-4 text-sm gap-2">
                            Nuevos <span className="text-muted-foreground text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full">{counts.new}</span>
                        </TabsTrigger>
                        <TabsTrigger value="preparing" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-full px-4 text-sm gap-2">
                            Preparando <span className="text-muted-foreground text-xs bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded-full">{counts.preparing}</span>
                        </TabsTrigger>
                        <TabsTrigger value="ready" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-full px-4 text-sm gap-2">
                            Listo <span className="text-muted-foreground text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded-full">{counts.ready}</span>
                        </TabsTrigger>
                        <TabsTrigger value="shipped" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-full px-4 text-sm gap-2 hidden lg:flex">
                            En Camino
                        </TabsTrigger>
                        <TabsTrigger value="delivered" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-full px-4 text-sm gap-2 hidden xl:flex">
                            Entregados
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="hidden sm:flex">
                        <Download className="mr-2 h-4 w-4" />
                        Exportar
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por cliente, email, #pedido..."
                        className="pl-9 bg-white"
                        value={searchQuery}
                        onChange={handleSearch}
                    />
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" className="bg-white gap-2">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="hidden sm:inline">Fechas</span>
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="bg-white gap-2 relative">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                                <span className="hidden sm:inline">Filtros</span>
                                {activeFilters > 0 && (
                                    <Badge variant="secondary" className="px-1 py-0 h-5 min-w-5 absolute -top-2 -right-2 bg-primary text-primary-foreground flex items-center justify-center">
                                        {activeFilters}
                                    </Badge>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px]">
                            <DropdownMenuLabel>Filtrar por</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="flex justify-between" onClick={() => router.push(pathname + "?" + createQueryString("payment_status", "pending"))}>
                                Pago Pendiente
                                {searchParams.get("payment_status") === "pending" && <span className="text-primary font-bold">✓</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="flex justify-between" onClick={() => router.push(pathname + "?" + createQueryString("payment_status", "paid"))}>
                                Pago Completado
                                {searchParams.get("payment_status") === "paid" && <span className="text-primary font-bold">✓</span>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="flex justify-between" onClick={() => router.push(pathname + "?" + createQueryString("delivery_type", "delivery"))}>
                                Despacho
                                {searchParams.get("delivery_type") === "delivery" && <span className="text-primary font-bold">✓</span>}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="flex justify-between" onClick={() => router.push(pathname + "?" + createQueryString("delivery_type", "pickup"))}>
                                Retiro
                                {searchParams.get("delivery_type") === "pickup" && <span className="text-primary font-bold">✓</span>}
                            </DropdownMenuItem>
                            {activeFilters > 0 && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="text-red-500 justify-center font-medium"
                                        onClick={() => router.push(pathname)}
                                    >
                                        Limpiar Filtros
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
}
