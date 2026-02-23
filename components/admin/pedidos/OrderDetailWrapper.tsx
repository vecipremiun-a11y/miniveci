"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Clock, MapPin, CreditCard, ShoppingBag, Truck, Check, X, Printer, Bell, RefreshCw, AlertTriangle, MessageCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { statusConfig, paymentStatusConfig } from "@/components/admin/pedidos/OrderTable";

export function OrderDetailWrapper({ orderId, initialOrderNumber }: { orderId: string, initialOrderNumber: string }) {
    const router = useRouter();
    const [order, setOrder] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchOrder = async () => {
            try {
                const res = await fetch(`/api/admin/orders/${orderId}`);
                if (!res.ok) throw new Error("Failed to fetch order");
                const data = await res.json();
                if (isMounted) {
                    setOrder(data);
                }
            } catch (error) {
                console.error(error);
                toast.error("Error al cargar detalles del pedido");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchOrder();
        return () => { isMounted = false; };
    }, [orderId]);

    const handleStatusChange = async (newStatus: string) => {
        setIsUpdating(true);
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/status`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || "Error al actualizar estado");
            }

            toast.success(`Estado actualizado a ${statusConfig[newStatus]?.label || newStatus}`);
            // Refresh local state without full reload
            setOrder((prev: any) => ({
                ...prev,
                status: newStatus,
                history: [
                    {
                        id: Date.now().toString(),
                        status: newStatus,
                        createdAt: new Date().toISOString(),
                        notes: `El estado cambió a ${newStatus}`,
                        changedBy: "admin"
                    },
                    ...prev.history
                ]
            }));

        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsUpdating(false);
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="flex items-center gap-4">
                    <div className="h-8 w-8 bg-gray-200 rounded"></div>
                    <div className="h-8 w-48 bg-gray-200 rounded"></div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 h-[500px] bg-gray-100 rounded-lg"></div>
                    <div className="space-y-6">
                        <div className="h-48 bg-gray-100 rounded-lg"></div>
                        <div className="h-48 bg-gray-100 rounded-lg"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!order) return null;

    const statusObj = statusConfig[order.status] || { label: order.status, color: "bg-gray-100" };
    const date = new Date(order.createdAt);

    return (
        <div className="space-y-6 pb-20">
            {/* Header Actions */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold tracking-tight">Pedido #{order.orderNumber}</h2>
                            <Badge variant="outline" className={`${statusObj.color} border px-2.5 py-0.5 rounded-full text-xs uppercase`}>
                                {statusObj.label}
                            </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            {format(date, "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es })}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="text-sm font-medium mr-2 flex-shrink-0">Cambiar estado:</div>
                    <Select value={order.status} onValueChange={handleStatusChange} disabled={isUpdating}>
                        <SelectTrigger className="w-full sm:w-[180px] bg-white">
                            <SelectValue placeholder="Estado..." />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="new">Nuevo</SelectItem>
                            <SelectItem value="paid">Pagado</SelectItem>
                            <SelectItem value="preparing">Preparando</SelectItem>
                            <SelectItem value="ready">Listo</SelectItem>
                            <SelectItem value="shipped">Despachado</SelectItem>
                            <SelectItem value="delivered">Entregado</SelectItem>
                            <SelectItem value="cancelled" className="text-red-500 font-medium focus:text-red-600 focus:bg-red-50">Cancelar Pedido</SelectItem>
                            <SelectItem value="refunded" className="text-orange-500 focus:text-orange-600 focus:bg-orange-50">Reembolsado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT COLUMN: Items & Timeline */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Items Card */}
                    <Card>
                        <CardHeader className="pb-3 border-b bg-gray-50/50">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <ShoppingBag className="w-4 h-4 text-primary" /> Productos ({order.items?.length || 0})
                                </CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y">
                                {order.items?.map((item: any) => (
                                    <div key={item.id} className="p-4 flex gap-4 items-center">
                                        <div className="w-12 h-12 bg-gray-100 rounded-md flex-shrink-0 flex items-center justify-center border border-gray-200">
                                            <ShoppingBag className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm text-gray-900 truncate">{item.productName}</p>
                                            <p className="text-xs text-muted-foreground">{item.productSku}</p>
                                            <div className="text-xs text-muted-foreground mt-1">
                                                Stock devengado de: <span className="uppercase font-semibold">{item.stockSource || 'GLOBAL'}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-medium text-sm">${(item.unitPrice).toLocaleString('es-CL')}</p>
                                            <p className="text-xs text-muted-foreground">x {item.quantity}</p>
                                        </div>
                                        <div className="pl-4 text-right min-w-[80px]">
                                            <p className="font-bold text-sm">${(item.totalPrice).toLocaleString('es-CL')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Totals */}
                            <div className="bg-gray-50 border-t p-4 space-y-2">
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Subtotal ({order.items?.reduce((a: any, b: any) => a + b.quantity, 0)} items)</span>
                                    <span>${(order.subtotal || 0).toLocaleString('es-CL')}</span>
                                </div>
                                {order.discount > 0 && (
                                    <div className="flex justify-between text-sm text-red-500">
                                        <span>Descuento {order.couponCode ? `(${order.couponCode})` : ''}</span>
                                        <span>-${order.discount.toLocaleString('es-CL')}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>Envío</span>
                                    <span>${(order.shippingCost || 0).toLocaleString('es-CL')}</span>
                                </div>
                                <Separator className="my-2" />
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total</span>
                                    <span>${(order.total || 0).toLocaleString('es-CL')}</span>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">
                                    Pagado: <span className="uppercase font-semibold">{paymentStatusConfig[order.paymentStatus]?.label || order.paymentStatus}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Timeline Card */}
                    <Card>
                        <CardHeader className="pb-3 border-b bg-gray-50/50">
                            <CardTitle className="text-base flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-muted-foreground" /> Historial y Trazabilidad
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4">
                                {order.history?.map((entry: any, index: number) => {
                                    const config = statusConfig[entry.status] || { label: entry.status, color: "bg-gray-200" };
                                    return (
                                        <div key={entry.id} className="relative pl-6">
                                            <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white ${config.color.split(' ')[0]}`}></div>
                                            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                                                <div>
                                                    <p className="font-medium text-sm">{entry.notes || `Pedido marcado como ${config.label}`}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">Por: {entry.changedBy}</p>
                                                </div>
                                                <span className="text-xs text-slate-500 whitespace-nowrap">
                                                    {format(new Date(entry.createdAt), "dd MMM HH:mm", { locale: es })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Internal Notes */}
                    <Card>
                        <CardHeader className="pb-3 bg-yellow-50/50 border-b border-yellow-100">
                            <CardTitle className="text-base text-yellow-800 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Notas Internas
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <p className="text-sm text-muted-foreground">
                                {order.internalNotes || "No hay notas internas para este pedido."}
                            </p>
                            <Button variant="outline" size="sm" className="mt-4">Editar Notas</Button>
                        </CardContent>
                    </Card>

                </div>

                {/* RIGHT COLUMN: Customer, Shipping, POS */}
                <div className="space-y-6">

                    {/* Customer Info */}
                    <Card>
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-base">Información del Cliente</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div>
                                <p className="font-semibold text-sm">{order.customerName}</p>
                                <a href={`mailto:${order.customerEmail}`} className="text-sm text-primary hover:underline">{order.customerEmail}</a>
                                {order.customerPhone && <p className="text-sm text-muted-foreground">{order.customerPhone}</p>}
                                {order.customerRut && <p className="text-sm text-muted-foreground mt-1">RUT: {order.customerRut}</p>}
                            </div>

                            <Separator />

                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground uppercase font-semibold">Dirección de {order.deliveryType === 'delivery' ? 'Despacho' : 'Facturación'}</p>
                                {order.deliveryType === 'delivery' ? (
                                    <>
                                        <p className="text-sm">{order.shippingAddress || 'No especificada'}</p>
                                        <p className="text-sm">{order.shippingComuna}, {order.shippingCity}</p>
                                        {order.shippingNotes && (
                                            <p className="text-xs text-muted-foreground mt-2 italic flex gap-1 items-start">
                                                <span className="font-semibold not-italic text-amber-600">Nota:</span>
                                                {order.shippingNotes}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground italic">Retiro en local</p>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" size="sm" className="flex-1 whitespace-nowrap"><MapPin className="w-3 h-3 mr-2" /> Ver Mapa</Button>
                                <Button variant="outline" size="sm" className="hidden 2xl:flex"><Bell className="w-3 h-3 mr-2" /> Notificar</Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Delivery Method */}
                    <Card>
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-base">Método de Entrega</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    {order.deliveryType === 'delivery' ? <Truck className="w-5 h-5 text-slate-600" /> : <ShoppingBag className="w-5 h-5 text-slate-600" />}
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-sm">{order.deliveryType === 'delivery' ? 'Delivery (Despacho a Domicilio)' : 'Retiro en Tienda'}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {order.deliveryDate ? `Programado para ${format(new Date(order.deliveryDate), "dd/MM/yyyy")}` : 'Lo antes posible'}
                                    </p>
                                    {order.deliveryTimeSlot && (
                                        <Badge variant="secondary" className="mt-2 text-xs font-normal">
                                            Rango: {order.deliveryTimeSlot}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* POS Status & Payment */}
                    <Card>
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-base">Sincronización POS & Pago</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-sm border-b pb-2">
                                    <span className="text-muted-foreground">Método Pago</span>
                                    <span className="font-medium capitalize flex items-center gap-1">
                                        {order.paymentMethod === 'card' ? <CreditCard className="w-3 h-3" /> : null}
                                        {order.paymentMethod || 'No especificado'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-sm border-b pb-2">
                                    <span className="text-muted-foreground">ID Transacción</span>
                                    <span className="font-medium text-slate-600 font-mono text-xs">{order.paymentId || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm pt-2">
                                    <span className="text-muted-foreground">Estado POS</span>
                                    {order.posSynced ? (
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5"><Check className="w-3 h-3" /> Sincronizado</Badge>
                                    ) : order.posSyncError ? (
                                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 gap-1.5"><AlertTriangle className="w-3 h-3" /> Error Sync</Badge>
                                    ) : (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5"><Clock className="w-3 h-3" /> Pendiente</Badge>
                                    )}
                                </div>
                                {order.posSynced && order.posOrderId && (
                                    <div className="flex justify-between items-center text-sm pt-2">
                                        <span className="text-muted-foreground">ID Boiler POS</span>
                                        <span className="font-medium font-mono text-xs text-primary">{order.posOrderId}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2 pt-2">
                                <Button variant="outline" size="sm" className="flex-1" disabled={order.posSynced}>
                                    <RefreshCw className="w-3 h-3 mr-2" /> Forzar Sync
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>

            {/* Sticky Action Footer purely for UX visibility */}
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 border-t bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40 flex justify-between items-center">
                <Button variant="ghost" className="text-muted-foreground" onClick={() => router.back()}>Volver</Button>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => {
                            const currentPhone = order.customerPhone || "";
                            // Basic formatting: remove spaces/pluses and prepend country code if needed. Assuming Chile (+56)
                            let cleanPhone = currentPhone.replace(/[^\d]/g, '');
                            if (cleanPhone && cleanPhone.length === 9) cleanPhone = `56${cleanPhone}`; // Add country code if it's 9 digits

                            const msg = encodeURIComponent(`Hola ${order.customerName},\nTe contactamos de MiniVeci sobre tu pedido #${order.orderNumber}. `);
                            window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
                        }}
                    >
                        <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                    </Button>
                    <Button variant="outline"><Printer className="w-4 h-4 mr-2" /> Imprimir OT</Button>
                    {order.status === 'new' && (
                        <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => handleStatusChange('preparing')}>
                            <ShoppingBag className="w-4 h-4 mr-2" /> Comenzar a Preparar
                        </Button>
                    )}
                    {order.status === 'preparing' && (
                        <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleStatusChange('ready')}>
                            <Check className="w-4 h-4 mr-2" /> Marcar como Listo
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
