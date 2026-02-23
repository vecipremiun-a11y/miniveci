"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ProductTable } from "./ProductTable";
import { Loader2 } from "lucide-react";

export function ProductTableWrapper() {
    const searchParams = useSearchParams();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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

    return (
        <ProductTable
            data={data.products}
            total={data.total}
            page={data.page}
            totalPages={data.totalPages}
            limit={10}
        />
    );
}
