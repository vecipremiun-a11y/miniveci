"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronDown, Cookie, Loader2, MapPin, NotebookPen, Phone, Store, Truck } from "lucide-react";
import { formatCLP, formatKg } from "@/lib/bakery-shared";

type BakeryStatus = "pending" | "confirmed" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";

interface OrderItem {
    id: string;
    productId: string;
    productName: string;
    pricingMode: "unit" | "kg";
    unitPrice: number;
    gramsPerUnit: number | null;
    quantity: number;
    notes: string | null;
    subtotal: number;
}

interface Order {
    id: string;
    publicCode: string;
    scheduledFor: string;
    method: "pickup" | "delivery";
    address: string | null;
    generalNotes: string | null;
    status: BakeryStatus;
    items: OrderItem[];
    subtotal: number;
    deliveryFee: number;
    total: number;
    contactPhone: string | null;
    createdAt: string;
}

const STATUS_LABEL: Record<BakeryStatus, string> = {
    pending: "Pendiente",
    confirmed: "Confirmado",
    preparing: "Preparando",
    ready: "Listo para retiro",
    out_for_delivery: "En reparto",
    delivered: "Entregado",
    cancelled: "Cancelado",
};

const STATUS_STYLE: Record<BakeryStatus, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    confirmed: "bg-blue-100 text-blue-700 border-blue-200",
    preparing: "bg-violet-100 text-violet-700 border-violet-200",
    ready: "bg-emerald-100 text-emerald-700 border-emerald-200",
    out_for_delivery: "bg-cyan-100 text-cyan-700 border-cyan-200",
    delivered: "bg-slate-100 text-slate-600 border-slate-200",
    cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function MisEncargosPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/bakery/orders")
            .then(async (r) => {
                if (r.status === 401) {
                    setError("Inicia sesión para ver tus encargos");
                    return null;
                }
                const data = await r.json();
                return data;
            })
            .then((data) => {
                if (data?.orders) setOrders(data.orders);
            })
            .catch(() => setError("No pudimos cargar tus encargos"))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white/70 backdrop-blur-md border border-white rounded-3xl p-8 text-center">
                <Cookie className="w-12 h-12 mx-auto text-amber-400 mb-3" />
                <p className="text-slate-700 font-bold mb-1">{error}</p>
                <Link href="/login" className="text-sm text-veci-primary font-semibold hover:underline">Iniciar sesión</Link>
            </div>
        );
    }

    return (
        <div className="space-y-4">

            <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Cookie className="w-6 h-6 text-amber-500" />
                        Mis Encargos
                    </h2>
                    <p className="text-sm text-slate-500">Tus reservas de amasandería.</p>
                </div>
                <Link
                    href="/amasanderia"
                    className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full bg-gradient-to-r from-veci-primary to-rose-400 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition shrink-0"
                >
                    Nuevo encargo
                </Link>
            </div>

            {orders.length === 0 ? (
                <div className="bg-white/70 backdrop-blur-md border border-white rounded-3xl p-10 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-4">
                        <Cookie className="w-8 h-8 text-amber-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700">Aún no tienes encargos</h3>
                    <p className="text-sm text-slate-500 mt-1">Cuando hagas tu primer encargo, aparecerá aquí.</p>
                    <Link
                        href="/amasanderia"
                        className="mt-5 inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-gradient-to-r from-veci-primary to-rose-400 text-white text-sm font-bold shadow-md hover:shadow-lg transition"
                    >
                        Explorar amasandería
                    </Link>
                </div>
            ) : (
                <ul className="space-y-3">
                    {orders.map((order) => {
                        const expanded = expandedId === order.id;
                        const dt = new Date(order.scheduledFor);
                        return (
                            <li key={order.id} className="bg-white/70 backdrop-blur-md border border-white rounded-2xl overflow-hidden transition shadow-sm hover:shadow-md">
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(expanded ? null : order.id)}
                                    className="w-full text-left px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4"
                                >
                                    <div className="hidden sm:flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 shrink-0">
                                        <span className="text-[10px] uppercase font-bold text-amber-700 leading-none">{dt.toLocaleDateString("es-CL", { month: "short" })}</span>
                                        <span className="text-xl font-extrabold text-amber-800 leading-none mt-0.5">{dt.getDate()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 flex-wrap">
                                            <p className="font-mono text-base sm:text-lg font-extrabold text-veci-dark">{order.publicCode}</p>
                                            <span className={`text-[10px] sm:text-xs font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLE[order.status]}`}>
                                                {STATUS_LABEL[order.status]}
                                            </span>
                                        </div>
                                        <p className="text-xs sm:text-sm text-slate-600 mt-1 flex items-center gap-1.5 flex-wrap">
                                            <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                            {dt.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}
                                            {" · "}
                                            {dt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                                            {order.method === "pickup" ? (
                                                <span className="inline-flex items-center gap-1 text-slate-500 ml-1"><Store className="w-3.5 h-3.5" /> Retiro</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-slate-500 ml-1"><Truck className="w-3.5 h-3.5" /> Delivery</span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="font-extrabold text-veci-dark">{formatCLP(order.total)}</p>
                                        <p className="text-[10px] text-slate-500">{order.items.length} ítem{order.items.length === 1 ? "" : "s"}</p>
                                    </div>
                                    <ChevronDown className={`w-5 h-5 text-slate-400 transition ${expanded ? "rotate-180" : ""}`} />
                                </button>

                                {expanded && (
                                    <div className="px-4 sm:px-5 pb-5 border-t border-slate-100 pt-4 space-y-4">

                                        {/* Items */}
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Productos</p>
                                            <ul className="space-y-2">
                                                {order.items.map((it) => {
                                                    const grams = it.pricingMode === "kg" && it.gramsPerUnit ? it.quantity * it.gramsPerUnit : null;
                                                    return (
                                                        <li key={it.id} className="flex justify-between gap-3 text-sm">
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-slate-800"><strong>{it.quantity}×</strong> {it.productName}</p>
                                                                {grams != null && <p className="text-[11px] text-slate-500">≈ {formatKg(grams)}</p>}
                                                                {it.notes && <p className="text-[11px] text-amber-700 italic mt-0.5">📝 {it.notes}</p>}
                                                            </div>
                                                            <span className="font-semibold text-slate-700 shrink-0">{formatCLP(it.subtotal)}</span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>

                                        {/* Address & contact */}
                                        {order.method === "delivery" && order.address && (
                                            <div className="flex items-start gap-2 text-sm text-slate-700">
                                                <MapPin className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                                <span>{order.address}</span>
                                            </div>
                                        )}
                                        {order.contactPhone && (
                                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                                <Phone className="w-4 h-4 text-amber-600 shrink-0" />
                                                <span>{order.contactPhone}</span>
                                            </div>
                                        )}
                                        {order.generalNotes && (
                                            <div className="flex items-start gap-2 text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                                                <NotebookPen className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                                <span>{order.generalNotes}</span>
                                            </div>
                                        )}

                                        {/* Totals */}
                                        <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
                                            <div className="flex justify-between text-slate-600">
                                                <span>Subtotal</span><span>{formatCLP(order.subtotal)}</span>
                                            </div>
                                            {order.deliveryFee > 0 && (
                                                <div className="flex justify-between text-slate-600">
                                                    <span>Delivery</span><span>{formatCLP(order.deliveryFee)}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between font-extrabold text-base pt-1 border-t border-slate-100">
                                                <span>Total</span><span className="text-veci-dark">{formatCLP(order.total)}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-500 pt-1">Pagas al retirar / recibir.</p>
                                        </div>

                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
