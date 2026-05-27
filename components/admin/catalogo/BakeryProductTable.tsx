"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    Cookie, Eye, EyeOff, Loader2, MoreHorizontal, Pencil, Plus, Trash2,
} from "lucide-react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BakeryCategory } from "@/lib/validations/bakery";
import { bakeryCategoryBadgeClass, bakeryCategoryLabel, formatCLP } from "@/lib/bakery-shared";

interface BakeryProduct {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    category: BakeryCategory;
    pricingMode: "unit" | "kg";
    price: number;
    gramsPerUnit: number | null;
    allowsNotes: boolean;
    active: boolean;
    sortOrder: number;
}

export function BakeryProductTable() {
    const router = useRouter();
    const [data, setData] = useState<BakeryProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [hideInactive, setHideInactive] = useState(false);
    const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({});

    useEffect(() => {
        fetch("/api/bakery/categories")
            .then((r) => r.json())
            .then((cats) => {
                if (Array.isArray(cats)) {
                    setCategoryLabels(Object.fromEntries(cats.map((c: { slug: string; label: string }) => [c.slug, c.label])));
                }
            })
            .catch(() => { /* silent */ });
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/bakery/products");
            if (!res.ok) throw new Error("Error fetching");
            const json = await res.json();
            setData(Array.isArray(json) ? json : []);
        } catch {
            toast.error("Error al cargar productos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const toggleActive = async (p: BakeryProduct) => {
        setBusyId(p.id);
        try {
            const res = await fetch(`/api/admin/bakery/products/${p.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ active: !p.active }),
            });
            if (!res.ok) throw new Error();
            toast.success(p.active ? "Producto ocultado" : "Producto visible en amasandería");
            await fetchData();
        } catch {
            toast.error("Error al cambiar visibilidad");
        } finally {
            setBusyId(null);
        }
    };

    const handleDelete = async (p: BakeryProduct) => {
        if (!confirm(`¿Eliminar "${p.name}" de forma PERMANENTE?\n\nEsta acción no se puede deshacer. Los encargos anteriores no se afectan.\nSi solo quieres sacarlo del catálogo por ahora, usa "Ocultar".`)) return;
        setBusyId(p.id);
        try {
            const res = await fetch(`/api/admin/bakery/products/${p.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error();
            toast.success("Producto eliminado");
            await fetchData();
        } catch {
            toast.error("Error al eliminar");
        } finally {
            setBusyId(null);
        }
    };

    const filtered = hideInactive ? data.filter((p) => p.active) : data;

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-3">
                    <Cookie className="w-8 h-8 text-amber-400" />
                </div>
                <h3 className="text-lg font-bold text-slate-700">Aún no tienes productos de amasandería</h3>
                <p className="text-sm text-slate-500 mt-1 mb-5">Crea el primero para que aparezca en la página pública.</p>
                <Button asChild>
                    <Link href="/admin/catalogo/amasanderia/nuevo">
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo producto
                    </Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-3">

            <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                    {filtered.length} de {data.length} producto{data.length === 1 ? "" : "s"}
                    {data.filter((p) => !p.active).length > 0 && (
                        <span className="text-slate-400"> · {data.filter((p) => !p.active).length} oculto{data.filter((p) => !p.active).length === 1 ? "" : "s"}</span>
                    )}
                </span>
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-600 font-medium">
                    <input
                        type="checkbox"
                        checked={hideInactive}
                        onChange={(e) => setHideInactive(e.target.checked)}
                        className="rounded"
                    />
                    Ocultar inactivos
                </label>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50">
                            <TableHead className="w-16">Imagen</TableHead>
                            <TableHead>Producto</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Modo y precio</TableHead>
                            <TableHead className="text-center">Notas</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-16"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.map((p) => (
                            <TableRow key={p.id} className={!p.active ? "opacity-50" : ""}>
                                <TableCell>
                                    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center overflow-hidden">
                                        {p.imageUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <Cookie className="w-5 h-5 text-amber-700/50" />
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="font-bold text-slate-800">{p.name}</div>
                                    {p.description && (
                                        <div className="text-xs text-slate-500 truncate max-w-xs">{p.description}</div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className={bakeryCategoryBadgeClass(p.category)}>
                                        {bakeryCategoryLabel(p.category, categoryLabels)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {p.pricingMode === "unit" ? (
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">{formatCLP(p.price)} <span className="font-normal text-slate-500">c/u</span></div>
                                            <div className="text-[11px] text-slate-500">Por unidad</div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="text-sm font-bold text-slate-800">{formatCLP(p.price)} <span className="font-normal text-slate-500">/kg</span></div>
                                            <div className="text-[11px] text-slate-500">~{p.gramsPerUnit ?? "?"}g por unidad</div>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="text-center">
                                    {p.allowsNotes ? (
                                        <span className="text-emerald-600 text-xs font-bold">Sí</span>
                                    ) : (
                                        <span className="text-slate-300 text-xs">—</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {/* Botón directo para ocultar/mostrar (además del menú "...") */}
                                    <button
                                        type="button"
                                        onClick={() => toggleActive(p)}
                                        disabled={busyId === p.id}
                                        title={p.active ? "Click para ocultar del catálogo" : "Click para mostrar en el catálogo"}
                                        className="disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {p.active ? (
                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors">
                                                <Eye className="w-3 h-3 mr-1" /> Visible
                                            </Badge>
                                        ) : (
                                            <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors">
                                                <EyeOff className="w-3 h-3 mr-1" /> Oculto
                                            </Badge>
                                        )}
                                    </button>
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" disabled={busyId === p.id}>
                                                {busyId === p.id
                                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                                    : <MoreHorizontal className="h-4 w-4" />}
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem asChild>
                                                <Link href={`/admin/catalogo/amasanderia/${p.id}/editar`}>
                                                    <Pencil className="mr-2 h-4 w-4" />
                                                    Editar
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => toggleActive(p)}>
                                                {p.active ? (
                                                    <><EyeOff className="mr-2 h-4 w-4" /> Ocultar</>
                                                ) : (
                                                    <><Eye className="mr-2 h-4 w-4" /> Mostrar</>
                                                )}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-rose-600" onClick={() => handleDelete(p)}>
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Eliminar
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
