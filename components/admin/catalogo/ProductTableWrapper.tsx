"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ProductTable } from "./ProductTable";
import { Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";

export function ProductTableWrapper() {
    const searchParams = useSearchParams();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [fixing, setFixing] = useState(false);

    // Stabilize dependency to avoid infinite re-fetch loop
    const paramsString = searchParams.toString();

    useEffect(() => {
        let cancelled = false;

        const fetchData = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/products?${paramsString}`);
                if (res.ok && !cancelled) {
                    const result = await res.json();
                    setData(result);
                }
            } catch (error) {
                console.error("Error fetching products:", error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        fetchData();

        return () => { cancelled = true; };
    }, [paramsString]);

    const handleFixPublished = async () => {
        setFixing(true);
        try {
            const res = await fetch('/api/admin/products/fix-published', { method: 'POST' });
            const result = await res.json();
            if (res.ok) {
                if (result.fixed === 0) {
                    toast.info('No había productos con visibilidad rota');
                } else {
                    toast.success(`${result.fixed} producto(s) corregidos. Ahora aparecen como "Oculto" — publícalos desde aquí.`);
                    // Refresh the table
                    const refreshRes = await fetch(`/api/admin/products?${paramsString}`);
                    if (refreshRes.ok) setData(await refreshRes.json());
                }
            } else {
                toast.error('Error al reparar visibilidad');
            }
        } catch {
            toast.error('Error al reparar visibilidad');
        } finally {
            setFixing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
        );
    }

    if (!data || !data.products) {
        return (
            <div className="flex h-64 items-center justify-center text-gray-500">
                No se pudieron cargar los productos.
            </div>
        );
    }

    const nullPublishedCount = (data.products as any[]).filter(
        (p: any) => p.isPublished === null || p.isPublished === undefined
    ).length;

    return (
        <div className="space-y-3">
            {nullPublishedCount > 0 && (
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm text-amber-800 font-medium">
                        ⚠️ {nullPublishedCount} producto(s) tienen visibilidad rota — no aparecen en la tienda aunque digan "Publicado".
                    </p>
                    <button
                        onClick={handleFixPublished}
                        disabled={fixing}
                        className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
                    >
                        {fixing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="h-3 w-3" />}
                        Reparar ahora
                    </button>
                </div>
            )}
            <ProductTable
                data={data.products}
                total={data.total}
                page={data.page}
                totalPages={data.totalPages}
                limit={10}
            />
        </div>
    );
}
