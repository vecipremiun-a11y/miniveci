'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Package, ChevronRight, Clock, MapPin, CreditCard, ArrowLeft, ShoppingBag, Loader2, RefreshCw, AlertCircle, Banknote, Building2, Wallet, Upload, Copy, Check, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
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
    paymentId: string | null;
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
    mercadopago: 'Mercado Pago',
};

const paymentStatusInfo: Record<string, { label: string; color: string }> = {
    pending: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700' },
    paid: { label: 'Pagado', color: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
    refunded: { label: 'Reembolsado', color: 'bg-orange-100 text-orange-700' },
};

export default function PedidosPage() {
    return (
        <Suspense fallback={
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
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
        <>
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
        </>
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
                                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                        <span className="font-bold text-slate-700">#{order.orderNumber}</span>
                                        <span className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${statusInfo.color}`}>
                                            {statusInfo.label}
                                        </span>
                                        {order.paymentStatus === 'pending' && order.paymentMethod !== 'contrarembolso' && !(order.paymentMethod === 'transferencia' && order.paymentId) && (
                                            <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> Pago pendiente
                                            </span>
                                        )}
                                        {order.paymentMethod === 'contrarembolso' && order.paymentId === 'confirmed' && (
                                            <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                                Contra entrega
                                            </span>
                                        )}
                                        {order.paymentMethod === 'transferencia' && !!order.paymentId && (
                                            <span className="text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                                Comprobante enviado
                                            </span>
                                        )}
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
    const [retrying, setRetrying] = useState(false);
    const [retryError, setRetryError] = useState('');
    const [showPaymentOptions, setShowPaymentOptions] = useState(false);
    const [selectedRetryMethod, setSelectedRetryMethod] = useState<string | null>(null);
    // Transfer receipt flow
    const [showTransferDetails, setShowTransferDetails] = useState(false);
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState('');
    const [receiptUrl, setReceiptUrl] = useState('');
    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const [copiedField, setCopiedField] = useState('');
    // Contra entrega confirmation
    const [contraEntregaConfirmed, setContraEntregaConfirmed] = useState(false);

    const isContraEntregaChosen = order.paymentMethod === 'contrarembolso' && order.paymentId === 'confirmed';
    const isTransferenciaChosen = order.paymentMethod === 'transferencia' && !!order.paymentId;
    const canRetryPayment = order.paymentStatus === 'pending' && order.status !== 'cancelled' && order.status !== 'delivered' && !isContraEntregaChosen && !isTransferenciaChosen;

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedField(key);
        setTimeout(() => setCopiedField(''), 2000);
    };

    const handleReceiptUpload = async (file: File) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            setRetryError('Formato no válido. Sube una imagen (JPG, PNG, WebP) o PDF.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setRetryError('El archivo es muy grande. Máximo 5MB.');
            return;
        }
        setReceiptFile(file);
        setRetryError('');
        if (file.type.startsWith('image/')) {
            setReceiptPreview(URL.createObjectURL(file));
        } else {
            setReceiptPreview('');
        }
        setUploadingReceipt(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/store/upload-receipt', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) {
                setRetryError(data.error || 'Error al subir comprobante.');
                setReceiptFile(null);
                setReceiptPreview('');
                return;
            }
            setReceiptUrl(data.url);
        } catch {
            setRetryError('Error de conexión al subir comprobante.');
            setReceiptFile(null);
            setReceiptPreview('');
        } finally {
            setUploadingReceipt(false);
        }
    };

    const handleConfirmTransfer = async () => {
        if (!receiptUrl) {
            setRetryError('Sube el comprobante de transferencia antes de confirmar.');
            return;
        }
        setRetrying(true);
        setRetryError('');
        try {
            const res = await fetch('/api/store/payments/retry', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id, paymentMethod: 'transferencia', receiptUrl }),
            });
            const data = await res.json();
            if (!res.ok) {
                setRetryError(data.error || 'Error al confirmar transferencia.');
                return;
            }
            window.location.reload();
        } catch {
            setRetryError('Error de conexión. Intenta de nuevo.');
        } finally {
            setRetrying(false);
        }
    };

    const handleRetryPayment = async (method: string) => {
        setRetrying(true);
        setRetryError('');
        setSelectedRetryMethod(method);

        if (method === 'mercadopago') {
            try {
                const res = await fetch('/api/store/payments/retry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order.id }),
                });
                const data = await res.json();
                if (!res.ok) {
                    setRetryError(data.error || 'Error al reintentar el pago');
                    return;
                }
                const redirectUrl = data.initPoint || data.sandboxInitPoint;
                if (redirectUrl) {
                    window.location.href = redirectUrl;
                } else {
                    setRetryError('No se pudo obtener la URL de pago');
                }
            } catch {
                setRetryError('Error de conexión. Intenta de nuevo.');
            } finally {
                setRetrying(false);
            }
        } else if (method === 'contrarembolso') {
            try {
                const res = await fetch('/api/store/payments/retry', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: order.id, paymentMethod: 'contrarembolso' }),
                });
                const data = await res.json();
                if (!res.ok) {
                    setRetryError(data.error || 'Error al cambiar método de pago');
                    return;
                }
                setContraEntregaConfirmed(true);
                setShowPaymentOptions(false);
            } catch {
                setRetryError('Error de conexión. Intenta de nuevo.');
            } finally {
                setRetrying(false);
            }
        } else if (method === 'transferencia') {
            setShowTransferDetails(true);
            setShowPaymentOptions(false);
            setRetrying(false);
        }
    };

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
                    <div className="mt-2">
                        {(() => {
                            const ps = paymentStatusInfo[order.paymentStatus || 'pending'] || { label: order.paymentStatus || 'Pendiente', color: 'bg-gray-100 text-gray-600' };
                            return (
                                <span className={`text-xs font-bold uppercase px-2.5 py-1 rounded-full ${ps.color}`}>
                                    {ps.label}
                                </span>
                            );
                        })()}
                    </div>

                    {/* Show info when method already chosen */}
                    {isContraEntregaChosen && (
                        <div className="mt-5">
                            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-2">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                                <p className="font-bold text-emerald-800">Pago contra entrega confirmado</p>
                                <p className="text-xs text-emerald-600">Pagarás en efectivo o tarjeta cuando recibas tu pedido. No necesitas hacer nada más.</p>
                            </div>
                        </div>
                    )}
                    {isTransferenciaChosen && (
                        <div className="mt-5">
                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-center space-y-2">
                                <CheckCircle2 className="w-10 h-10 text-blue-500 mx-auto" />
                                <p className="font-bold text-blue-800">Comprobante enviado</p>
                                <p className="text-xs text-blue-600">Tu comprobante de transferencia fue recibido. Estamos verificando el pago.</p>
                            </div>
                        </div>
                    )}

                    {canRetryPayment && (
                        <div className="mt-5 space-y-3">
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-semibold text-amber-800">Pago pendiente</p>
                                        <p className="text-xs text-amber-600 mt-1">
                                            Elige cómo deseas completar el pago de este pedido.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {contraEntregaConfirmed ? (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-2">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                                    <p className="font-bold text-emerald-800">¡Pago contra entrega confirmado!</p>
                                    <p className="text-xs text-emerald-600">Pagarás en efectivo o tarjeta cuando recibas tu pedido. No necesitas hacer nada más.</p>
                                </div>
                            ) : showTransferDetails ? (
                                <div className="space-y-3">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Datos para transferir</p>
                                    <div className="space-y-2">
                                        {[
                                            { label: 'Banco', value: 'Banco Estado', key: 'banco' },
                                            { label: 'Nombre', value: 'Kevin Javier', key: 'nombre' },
                                            { label: 'Tipo de cuenta', value: 'Chequera Electrónica (Cuenta Vista)', key: 'tipo' },
                                            { label: 'N° de cuenta', value: '1371455597', key: 'cuenta' },
                                            { label: 'Monto a transferir', value: `$${order.total.toLocaleString('es-CL')}`, key: 'monto' },
                                        ].map(({ label, value, key }) => (
                                            <div key={key} className="flex items-center justify-between bg-white/80 rounded-xl px-3 py-2.5">
                                                <div>
                                                    <p className="text-[10px] uppercase tracking-wider text-purple-400 font-bold">{label}</p>
                                                    <p className={`text-sm font-bold ${key === 'monto' ? 'text-emerald-700' : 'text-slate-800'}`}>{value}</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => copyToClipboard(key === 'monto' ? String(order.total) : value, key)}
                                                    className="p-1.5 rounded-lg hover:bg-purple-100 transition-colors"
                                                >
                                                    {copiedField === key ? (
                                                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                    ) : (
                                                        <Copy className="w-3.5 h-3.5 text-purple-400" />
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="pt-2 border-t border-purple-200/50">
                                        <p className="text-xs font-bold text-slate-600 mb-1">📎 Comprobante de transferencia</p>
                                        <p className="text-[11px] text-slate-400 mb-2">Sube una captura o foto del comprobante para validar tu pago</p>

                                        {!receiptFile ? (
                                            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-purple-300/60 hover:border-purple-400 bg-white/50 hover:bg-white/80 p-5 cursor-pointer transition-colors">
                                                <Upload className="w-6 h-6 text-slate-400" />
                                                <div className="text-center">
                                                    <p className="text-xs font-bold text-slate-600">Haz clic para subir tu comprobante</p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5">JPG, PNG, WebP o PDF — Máx 5MB</p>
                                                </div>
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp,application/pdf"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0];
                                                        if (f) handleReceiptUpload(f);
                                                    }}
                                                />
                                            </label>
                                        ) : (
                                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                                                <div className="flex items-start gap-3">
                                                    {receiptPreview ? (
                                                        <img src={receiptPreview} alt="Comprobante" className="w-16 h-16 rounded-lg object-cover border border-slate-200" />
                                                    ) : (
                                                        <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center">
                                                            <ImageIcon className="w-6 h-6 text-slate-400" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-slate-700 truncate">{receiptFile.name}</p>
                                                        <p className="text-xs text-slate-400 mt-0.5">{(receiptFile.size / 1024).toFixed(0)} KB</p>
                                                        {uploadingReceipt && (
                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                                                                <span className="text-xs font-semibold text-purple-500">Subiendo...</span>
                                                            </div>
                                                        )}
                                                        {receiptUrl && !uploadingReceipt && (
                                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                                <span className="text-xs font-semibold text-emerald-600">Comprobante subido</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setReceiptFile(null); setReceiptPreview(''); setReceiptUrl(''); }}
                                                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                                                    >
                                                        Quitar
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleConfirmTransfer}
                                        disabled={retrying || !receiptUrl || uploadingReceipt}
                                        className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {retrying ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Confirmando...</>
                                        ) : (
                                            <><Check className="w-4 h-4" /> Confirmar transferencia</>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => { setShowTransferDetails(false); setShowPaymentOptions(true); }}
                                        className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        ← Volver a métodos de pago
                                    </button>
                                </div>
                            ) : !showPaymentOptions ? (
                                <button
                                    onClick={() => setShowPaymentOptions(true)}
                                    className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-sm shadow-lg shadow-green-500/25 hover:shadow-xl hover:shadow-green-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Completar pago ahora
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Elige método de pago</p>

                                    <button
                                        onClick={() => handleRetryPayment('mercadopago')}
                                        disabled={retrying}
                                        className="w-full p-4 rounded-2xl border-2 border-blue-200 bg-blue-50/50 hover:border-blue-400 hover:bg-blue-50 transition-all flex items-center gap-3 group disabled:opacity-50"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                                            <Wallet className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="font-bold text-sm text-slate-700">Mercado Pago</p>
                                            <p className="text-xs text-slate-400">Tarjeta de crédito, débito o saldo MP</p>
                                        </div>
                                        {retrying && selectedRetryMethod === 'mercadopago' && (
                                            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                                        )}
                                    </button>

                                    <button
                                        onClick={() => handleRetryPayment('transferencia')}
                                        disabled={retrying}
                                        className="w-full p-4 rounded-2xl border-2 border-purple-200 bg-purple-50/50 hover:border-purple-400 hover:bg-purple-50 transition-all flex items-center gap-3 group disabled:opacity-50"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                                            <Building2 className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="font-bold text-sm text-slate-700">Transferencia bancaria</p>
                                            <p className="text-xs text-slate-400">Realiza una transferencia y envía el comprobante</p>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => handleRetryPayment('contrarembolso')}
                                        disabled={retrying}
                                        className="w-full p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/50 hover:border-amber-400 hover:bg-amber-50 transition-all flex items-center gap-3 group disabled:opacity-50"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                                            <Banknote className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <p className="font-bold text-sm text-slate-700">Pago contra entrega</p>
                                            <p className="text-xs text-slate-400">Paga en efectivo o tarjeta al recibir tu pedido</p>
                                        </div>
                                        {retrying && selectedRetryMethod === 'contrarembolso' && (
                                            <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
                                        )}
                                    </button>

                                    <button
                                        onClick={() => setShowPaymentOptions(false)}
                                        className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            )}

                            {retryError && (
                                <p className="text-xs text-red-500 text-center">{retryError}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
