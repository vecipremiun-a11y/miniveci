"use client";

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce"; // We need this hook, if not available I'll verify and create

export function ProductFilters({ categories }: { categories: any[] }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const [search, setSearch] = useState(searchParams.get("search") || "");
    const [category, setCategory] = useState(searchParams.get("category") || "all");
    const [status, setStatus] = useState(searchParams.get("status") || "all");
    const [stock, setStock] = useState(searchParams.get("stock") || "all");

    // Simple debounce implementation inside effect if hook not present, 
    // but better to assuming standard hook or implementing it.
    // I'll assume standard 500ms delay.

    useEffect(() => {
        const handler = setTimeout(() => {
            const params = new URLSearchParams(searchParams);
            if (search) params.set("search", search);
            else params.delete("search");
            params.set("page", "1"); // Reset to page 1 on search
            router.replace(`${pathname}?${params.toString()}`);
        }, 500);
        return () => clearTimeout(handler);
    }, [search, router, pathname, searchParams]);

    const handleFilterChange = (key: string, value: string) => {
        const params = new URLSearchParams(searchParams);
        if (value && value !== "all") {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        params.set("page", "1"); // Reset to page 1
        router.replace(`${pathname}?${params.toString()}`);
    };

    const clearFilters = () => {
        setSearch("");
        setCategory("all");
        setStatus("all");
        setStock("all");
        router.replace(pathname);
    }

    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between py-4">
            <div className="flex flex-1 items-center gap-2">
                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar productos..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <Select value={category} onValueChange={(val) => { setCategory(val); handleFilterChange("category", val); }}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        {categories.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={status} onValueChange={(val) => { setStatus(val); handleFilterChange("status", val); }}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="published">Publicados</SelectItem>
                        <SelectItem value="draft">Borradores</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={stock} onValueChange={(val) => { setStock(val); handleFilterChange("stock", val); }}>
                    <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Stock" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="in_stock">Con stock</SelectItem>
                        <SelectItem value="low_stock">Stock bajo</SelectItem>
                        <SelectItem value="out_of_stock">Sin stock</SelectItem>
                    </SelectContent>
                </Select>

                {(search || category !== 'all' || status !== 'all' || stock !== 'all') && (
                    <Button variant="ghost" size="icon" onClick={clearFilters} title="Limpiar filtros">
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
