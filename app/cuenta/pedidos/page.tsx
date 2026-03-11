'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { AccountSidebar } from '@/components/account/AccountSidebar';
import { Package, ChevronRight, Clock, MapPin, CreditCard, ArrowLeft, ShoppingBag, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

interface OrderItem {
    id: string;
    productName: string;
    productSku: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    imageUrl: string | null;
}

interface Order {
    id: string;
    orderNumber: string;
    status: string;
    total: number;
    subtotal: number;
    shippingCost: number;
    discount: number;
    paymentMethod: string | null;
    paymentStatus: string | null;
    deliveryType: string;
    deliveryDate: string | null;
    deliveryTimeSlot: string | null;
    shippingAddress: string | null;
    shippingComuna: string | null;
    shippingCity: string | null;
    shippingNotes: string | null;
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

export default function PedidosPage() {
    return (
        <Suspense fallback={
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-3"><AccountSidebar /></div>
                <div className="lg:col-span-9">
                    <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                    </div>
                </div>
            </div>
        }>
            <PedidosContent />
        </Suspense>
    );
}

function PedidosContent() {
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const selectedOrderId = searchParams.get('id');

    const [orders, setOrders] = useState<Order[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        if (!session?.user?.id) return;
        const fetchOrders = async () => {
            try {
                const res = await fetch(`/api/store/customer/orders?page=${page}&limit=10`);
                if (res.ok) {
                    const data = await res.json();
                    setOrders(data.orders);
                    setTotalPages(data.pagination.totalPages);
                    if (selectedOrderId) {
                        const found = data.orders.find((o: Order) => o.id === selectedOrderId);
                        if (found) setSelectedOrder(found);
                    }
                }
            } catch (error) {
                console.error('Error loading orders:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchOrders();
    }, [session?.user?.id, page, selectedOrderId]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-3"><AccountSidebar /></div>
            <div className="lg:col-span-9">
                {selectedOrder ? (
                    <OrderDetail order={selectedOrder} onBack={() => setSelectedOrder(null)} />
                ) : (
                    <OrderList
                        orders={orders}
                        loading={loading}
                        page={page}
                        totalPages={totalPages}
                        onPageChange={setPage}
                        onSelectOrder={setSelectedOrder}
                    />
                )}
            </div>
        </div>
    );
}

function OrderList({ orders, loading, page, totalPages, onPageChange, onSelectOrder }: {
    orders: Order[];
    loading: boolean;
    page: number;
    totalPages: number;
    onPageChange: (p: number) => void;
    onSelectOrder: (o: Order) => void;
}) {
    if (loading) {
        return (
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl animate-pulse">
                <div className="h-7 w-48 bg-gray-200 rounded mb-6" />
                {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl mb-4" />)}
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl text-center py-16">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-700 mb-2">No tienes pedidos aún</h3>
                <p className="text-slate-400 mb-6">Cuando realices tu primera compra, aparecerá aquí</p>
                <Link href="/productos" className="px-6 py-3 rounded-full bg-gradient-to-r from-veci-primary to-veci-secondary text-white font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all">
                    Explorar productos
                </Link>
            </div>
        );
    }

    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl">
            <h2 className="text-xl font-bold text-slate-800 mb-6">Mis Pedidos</h2>
            <div className="space-y-3">
                {orders.map(order => {
                    const statusInfo = statusLabels[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700' };
                    const date = new Date(order.createdAt);
                    const itemsSummary = order.items.map(i => i.productName).slice(0, 3).join(', ');

                    return (
                        <button key={order.id} onClick={() => onSelectOrder(order)}
                            className="w-full text-left bg-white/50 backdrop-blur-sm p-5 rounded-2xl border border-white hover:shadow-md hover:bg-white/70 transition-all group">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1.5">
                                        <span className="font-bold text-slate-700">#{order.orderNumber}</span>
                                        <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${statusInfo.color}`}>
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-slate-500 truncate">{itemsSummary}</p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        {format(date, "dd 'de' MMMM, yyyy", { locale: es })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-slate-800 text-lg">${order.total.toLocaleString('es-CL')}</span>
                                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-veci-primary transition-colors" />
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {totalPages > 1 && (
                <div className="mt-8 flex justify-center gap-2">
                    <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
                        className="px-4 py-2 rounded-full bg-white/50 text-slate-600 font-medium text-sm border border-white hover:bg-white/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        Anterior
                    </button>
                    <span className="px-4 py-2 text-sm text-slate-500 font-medium">{page} de {totalPages}</span>
                    <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                        className="px-4 py-2 rounded-full bg-indigo-500/10 text-indigo-600 font-bold text-sm hover:bg-indigo-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        Siguiente
                    </button>
                </div>
            )}
        </div>
    );
}

function OrderDetail({ order, onBack }: { order: Order; onBack: () => void }) {
    const statusInfo = statusLabels[order.status] || { label: order.status, color: 'bg-gray-100 text-gray-700' };
    const date = new Date(order.createdAt);
    const addressParts = [order.shippingAddress, order.shippingComuna, order.shippingCity].filter(Boolean);
    const address = addressParts.length > 0 ? addressParts.join(', ') : null;

    return (
        <div className="space-y-6">
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl">
                <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-500 hover:text-veci-primary transition-colors mb-6">
                    <ArrowLeft className="w-4 h-4" /> Volver a mis pedidos
                </button>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Pedido #{order.orderNumber}</h2>
                        <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            {format(date, "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                        </div>
                    </div>
                    <span className={`text-xs font-bold uppercase px-3 py-1.5 rounded-full ${statusInfo.color}`}>
                        {statusInfo.label}
                    </span>
                </div>

                {/* Products */}
                <div className="divide-y border rounded-2xl overflow-hidden bg-white/50">
                    {order.items.map(item => (
                        <div key={item.id} className="p-4 flex gap-4 items-center">
                            <div className="w-14 h-14 bg-gray-100 rounded-xl flex-shrink-0 flex items-center justify-center border border-gray-200 overflow-hidden">
                                {item.imageUrl ? (
                                    <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                                ) : (
                                    <ShoppingBag className="w-5 h-5 text-gray-400" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm text-slate-800 truncate">{item.productName}</p>
                                <p className="text-xs text-slate-400">x{item.quantity}</p>
                            </div>
                            <p className="font-bold text-sm text-slate-800">${item.totalPrice.toLocaleString('es-CL')}</p>
                        </div>
                    ))}
                </div>

                {/* Totals */}
                <div className="mt-4 bg-slate-50 rounded-2xl p-5 space-y-2">
                    <div className="flex justify-between text-sm text-slate-500">
                        <span>Subtotal</span>
                        <span>${order.subtotal.toLocaleString('es-CL')}</span>
                    </div>
                    {order.discount > 0 && (
                        <div className="flex justify-between text-sm text-red-500">
                            <span>Descuento</span>
                            <span>-${order.discount.toLocaleString('es-CL')}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm text-slate-500">
                        <span>Envío</span>
                        <span>${(order.shippingCost || 0).toLocaleString('es-CL')}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between text-lg font-bold text-slate-800">
                        <span>Total</span>
                        <span>${order.total.toLocaleString('es-CL')}</span>
                    </div>
                </div>
            </div>

            {/* Shipping & Payment info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin className="w-5 h-5 text-veci-primary" />
                        <h3 className="font-bold text-slate-700">Entrega</h3>
                    </div>
                    <p className="text-sm text-slate-600 capitalize mb-1">
                        {order.deliveryType === 'delivery' ? 'Despacho a domicilio' : 'Retiro en tienda'}
                    </p>
                    {address && <p className="text-sm text-slate-500">{address}</p>}
                    {order.shippingNotes && <p className="text-xs text-slate-400 mt-2 italic">{order.shippingNotes}</p>}
                    {order.deliveryDate && (
                        <p className="text-sm text-slate-500 mt-2">
                            Fecha: {format(new Date(order.deliveryDate), "dd MMM yyyy", { locale: es })}
                            {order.deliveryTimeSlot && ` • ${order.deliveryTimeSlot}`}
                        </p>
                    )}
                </div>
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-xl">
                    <div className="flex items-center gap-2 mb-4">
                        <CreditCard className="w-5 h-5 text-veci-primary" />
                        <h3 className="font-bold text-slate-700">Pago</h3>
                    </div>
                    <p className="text-sm text-slate-600">
                        {paymentLabels[order.paymentMethod || ''] || order.paymentMethod || 'Sin definir'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 capitalize">
                        Estado: {order.paymentStatus || 'pendiente'}
                    </p>
                </div>
            </div>
        </div>
    );
}
