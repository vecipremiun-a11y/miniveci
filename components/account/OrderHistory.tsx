'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Clock, Package, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

interface OrderItem {
    id: string;
    productName: string;
    quantity: number;
    imageUrl: string | null;
}

interface Order {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    subtotal: number;
    shippingCost: number;
    paymentMethod: string | null;
    deliveryType: string;
    shippingAddress: string | null;
    shippingComuna: string | null;
    shippingCity: string | null;
    createdAt: string;
    items: OrderItem[];
}

const statusLabels: Record<string, { label: string; color: string }> = {
    new: { label: 'Nuevo', color: 'bg-blue-100 text-blue-700' },
    paid: { label: 'Pagado', color: 'bg-green-100 text-green-700' },
    preparing: { label: 'Preparando', color: 'bg-yellow-100 text-yellow-700' },
    ready: { label: 'Listo', color: 'bg-indigo-100 text-indigo-700' },
    shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-700' },
    delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
    refunded: { label: 'Reembolsado', color: 'bg-orange-100 text-orange-700' },
};

const paymentLabels: Record<string, string> = {
    contrarembolso: 'Contra reembolso',
    efectivo: 'Efectivo',
    transferencia: 'Transferencia',
    tarjeta: 'Tarjeta',
};

export function OrderHistory() {
    const { data: session } = useSession();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        if (!session?.user?.id) return;

        const fetchOrders = async () => {
            try {
                const res = await fetch(`/api/store/customer/orders?page=${page}&limit=5`);
                if (res.ok) {
                    const data = await res.json();
                    setOrders(data.orders);
                    setTotalPages(data.pagination.totalPages);
                }
            } catch (error) {
                console.error('Error loading orders:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [session?.user?.id, page]);

    if (loading) {
        return (
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl animate-pulse">
                <div className="h-6 w-48 bg-gray-200 rounded mb-6" />
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-28 bg-gray-100 rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl">
                <h3 className="text-xl font-bold text-slate-800 mb-6">Historial de pedidos</h3>
                <div className="text-center py-12">
                    <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Aún no tienes pedidos</p>
                    <p className="text-slate-400 text-sm mt-1">Tus pedidos aparecerán aquí cuando realices una compra</p>
                    <Link href="/productos" className="inline-block mt-6 px-6 py-2.5 rounded-full bg-gradient-to-r from-veci-primary to-veci-secondary text-white text-sm font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all">
                        Explorar productos
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl">
            <h3 className="text-xl font-bold text-slate-800 mb-6">Historial de pedidos</h3>
            <div className="space-y-4">
                {orders.map((order) => {
                    const statusInfo = statusLabels[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700' };
                    const addressParts = [order.shippingAddress, order.shippingComuna, order.shippingCity].filter(Boolean);
                    const address = addressParts.length > 0 ? addressParts.join(', ') : 'Retiro en local';
                    const itemsSummary = order.items.map(i => `${i.quantity > 1 ? i.quantity + ' ' : ''}${i.productName}`).slice(0, 3).join(' • ');
                    const moreItems = order.items.length > 3 ? ` +${order.items.length - 3} más` : '';
                    const date = new Date(order.createdAt);

                    return (
                        <div key={order.id} className="bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-white hover:shadow-md transition-all">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                                        <h4 className="font-bold text-slate-700 truncate">{address}</h4>
                                        <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${statusInfo.color}`}>
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm text-slate-500 mb-3 flex-wrap">
                                        <span className="font-medium">{format(date, "dd MMM yyyy", { locale: es })}</span>
                                        <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                                        <span className="font-bold text-slate-800 text-base">${order.total.toLocaleString('es-CL')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                                        <span className="font-bold text-veci-secondary">#{order.orderNumber}</span>
                                        <span>•</span>
                                        <span className="truncate">{itemsSummary}{moreItems}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-3 min-w-[140px]">
                                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
                                        <span className="text-sm font-medium text-slate-600">
                                            {paymentLabels[order.paymentMethod || ''] || order.paymentMethod || 'Sin definir'}
                                        </span>
                                    </div>
                                    <Link href={`/cuenta/pedidos?id=${order.id}`}
                                        className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-sm font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all">
                                        Ver detalle <ChevronRight className="w-3.5 h-3.5" />
                                    </Link>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {totalPages > 1 && (
                <div className="mt-8 flex justify-center gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 rounded-full bg-white/50 text-slate-600 font-medium text-sm border border-white hover:bg-white/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        Anterior
                    </button>
                    <span className="px-4 py-2 text-sm text-slate-500 font-medium">
                        {page} de {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-600 font-bold text-sm hover:bg-indigo-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        Siguiente
                    </button>
                </div>
            )}
        </div>
    );
}
