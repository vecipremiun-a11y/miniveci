"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OrderTable } from "@/components/admin/pedidos/OrderTable";
import { OrderFilters } from "@/components/admin/pedidos/OrderFilters";
import { Loader2 } from "lucide-react";

export function OrderListWrapper() {
    const searchParams = useSearchParams();
    const [orders, setOrders] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    const activeTab = searchParams.get("status") || "all";

    useEffect(() => {
        let isMounted = true;
        const fetchOrders = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/admin/orders?${searchParams.toString()}`);
                if (!res.ok) throw new Error("Failed to fetch");
                const data = await res.json();
                if (isMounted) {
                    setOrders(data.orders || []);
                    setTotal(data.total || 0);
                    setPage(data.page || 1);
                    setTotalPages(data.totalPages || 1);
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchOrders();
        return () => { isMounted = false; };
    }, [searchParams]);

    // Counters could be fetched from a separate endpoints or aggregated here if we fetched all.
    // For now, we rely on the main list fetching. A production app might have a `/api/admin/orders/counts` endpoint.
    const counts = {
        all: total,
        new: activeTab === 'new' ? total : 0, // Placeholder
        preparing: activeTab === 'preparing' ? total : 0,
        ready: activeTab === 'ready' ? total : 0,
        shipped: activeTab === 'shipped' ? total : 0,
        delivered: activeTab === 'delivered' ? total : 0,
        cancelled: activeTab === 'cancelled' ? total : 0,
    };

    return (
        <div className="flex flex-col h-full">
            <OrderFilters counts={counts} currentTab={activeTab} />
            <div className="flex-1 overflow-auto relative min-h-[400px]">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : null}
                <OrderTable
                    data={orders}
                    total={total}
                    page={page}
                    totalPages={totalPages}
                    limit={10}
                />
            </div>
        </div>
    );
}
