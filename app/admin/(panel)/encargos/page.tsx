"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    Cookie, Search, Loader2, MapPin, Store, Phone, Clock, Sparkles,
    Check, ChefHat, PackageCheck, Truck, X as XIcon, Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type BakeryStatus = "pending" | "confirmed" | "preparing" | "ready" | "out_for_delivery" | "delivered" | "cancelled";

interface OrderItem {
    id: string;
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
    customer: { name: string | null; email: string | null; phone: string | null };
}

const STATUS_LABEL: Record<BakeryStatus, string> = {
    pending: "Pendiente",
    confirmed: "Confirmado",
    preparing: "Preparando",
    ready: "Listo",
    out_for_delivery: "En reparto",
    delivered: "Entregado",
    cancelled: "Cancelado",
};

const STATUS_COLOR: Record<BakeryStatus, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    confirmed: "bg-blue-100 text-blue-700 border-blue-200",
    preparing: "bg-violet-100 text-violet-700 border-violet-200",
    ready: "bg-emerald-100 text-emerald-700 border-emerald-200",
    out_for_delivery: "bg-cyan-100 text-cyan-700 border-cyan-200",
    delivered: "bg-slate-100 text-slate-600 border-slate-200",
    cancelled: "bg-rose-100 text-rose-700 border-rose-200",
};

// Avance lineal por defecto. El caso ready→ se decide según método en el componente.
const NEXT_STATUS: Record<BakeryStatus, BakeryStatus | null> = {
    pending: "confirmed",
    confirmed: "preparing",
    preparing: "ready",
    ready: "delivered",
    out_for_delivery: "delivered",
    delivered: null,
    cancelled: null,
};

const STATUS_BTN_LABEL: Record<BakeryStatus, string> = {
    pending: "Confirmar",
    confirmed: "Empezar",
    preparing: "Listo",
    ready: "Entregado",
    out_for_delivery: "Entregado",
    delivered: "—",
    cancelled: "—",
};

/** Próximo estado considerando el método (delivery pasa por out_for_delivery). */
function nextStatusFor(order: { status: BakeryStatus; method: "pickup" | "delivery" }): BakeryStatus | null {
    if (order.status === "ready" && order.method === "delivery") return "out_for_delivery";
    return NEXT_STATUS[order.status];
}

/** Etiqueta del botón de avance considerando el método. */
function advanceBtnLabel(order: { status: BakeryStatus; method: "pickup" | "delivery" }): string {
    if (order.status === "ready" && order.method === "delivery") return "A reparto";
    return STATUS_BTN_LABEL[order.status];
}

export default function EncargosPage() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [summary, setSummary] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>("all");
    const [date, setDate] = useState<string>("");
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [streamConnected, setStreamConnected] = useState(false);
    const [newOrderFlash, setNewOrderFlash] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    async function fetchOrders() {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter !== "all") params.set("status", filter);
            if (date) params.set("date", date);
            if (search) params.set("search", search);
            const res = await fetch(`/api/admin/bakery/orders?${params}`);
            const json = await res.json();
            setOrders(json.orders || []);
            setSummary(json.summary || {});
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        const t = setTimeout(fetchOrders, 200);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, date, search]);

    // SSE
    useEffect(() => {
        const es = new EventSource("/api/admin/bakery/orders/stream");
        es.addEventListener("ready", () => setStreamConnected(true));
        es.addEventListener("order.created", (e: MessageEvent) => {
            try {
                const data = JSON.parse(e.data);
                toast.success(`Nuevo encargo ${data.order.publicCode}`, { description: `${data.order.items.length} item(s) · $${data.order.total.toLocaleString("es-CL")}` });
                setNewOrderFlash(data.order.id);
                setTimeout(() => setNewOrderFlash((v) => (v === data.order.id ? null : v)), 4000);
                audioRef.current?.play().catch(() => {});
                fetchOrders();
            } catch { /* ignore */ }
        });
        es.addEventListener("order.status_changed", () => {
            fetchOrders();
        });
        es.onerror = () => setStreamConnected(false);
        return () => es.close();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectedOrder = useMemo(() => orders.find((o) => o.id === selectedId) || null, [orders, selectedId]);

    async function updateStatus(orderId: string, status: BakeryStatus) {
        const res = await fetch(`/api/admin/bakery/orders/${orderId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        });
        const data = await res.json();
        if (!res.ok) return toast.error(data.message || "Error");
        toast.success(`Encargo ${STATUS_LABEL[status].toLowerCase()}`);
        fetchOrders();
    }

    return (
        <div className="space-y-4">
            <audio ref={audioRef} src="/notification.mp3" preload="auto" />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Cookie className="h-7 w-7 text-amber-500" />
                        Encargos amasandería
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Pedidos a futuro de panes y sándwiches. Tiempo real activo {streamConnected
                            ? <span className="text-emerald-600 font-semibold">● conectado</span>
                            : <span className="text-amber-600 font-semibold">○ reconectando</span>}.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                    {(["pending", "confirmed", "preparing", "ready"] as BakeryStatus[]).map((s) => (
                        <button
                            key={s}
                            onClick={() => setFilter(filter === s ? "all" : s)}
                            className={`px-3 py-1.5 rounded-full border transition ${filter === s ? "bg-veci-primary text-white border-veci-primary" : STATUS_COLOR[s]}`}
                        >
                            {STATUS_LABEL[s]}{summary[s] != null && <span className="ml-1.5 opacity-80">({summary[s]})</span>}
                        </button>
                    ))}
                </div>
            </div>

            <Card>
                <CardContent className="p-3 flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por código (MV-...), teléfono o dirección"
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Input type="date" className="sm:w-48" value={date} onChange={(e) => setDate(e.target.value)} />
                    <Select value={filter} onValueChange={setFilter}>
                        <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            <SelectItem value="pending">Pendiente</SelectItem>
                            <SelectItem value="confirmed">Confirmado</SelectItem>
                            <SelectItem value="preparing">Preparando</SelectItem>
                            <SelectItem value="ready">Listo</SelectItem>
                            <SelectItem value="delivered">Entregado</SelectItem>
                            <SelectItem value="cancelled">Cancelado</SelectItem>
                        </SelectContent>
                    </Select>
                    {(date || search || filter !== "all") && (
                        <Button variant="outline" size="sm" onClick={() => { setFilter("all"); setDate(""); setSearch(""); }}>
                            <XIcon className="h-4 w-4 mr-1" /> Limpiar
                        </Button>
                    )}
                </CardContent>
            </Card>

            <div className="grid lg:grid-cols-[1fr_400px] gap-4">
                {/* Lista */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : orders.length === 0 ? (
                        <Card>
                            <CardContent className="py-16 text-center">
                                <Cookie className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                                <p className="text-sm text-muted-foreground">No hay encargos con esos filtros.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        orders.map((o) => (
                            <OrderCard
                                key={o.id}
                                order={o}
                                selected={o.id === selectedId}
                                flash={o.id === newOrderFlash}
                                onSelect={() => setSelectedId(o.id)}
                                onAdvance={() => {
                                    const next = nextStatusFor(o);
                                    if (next) updateStatus(o.id, next);
                                }}
                                onCancel={() => {
                                    if (confirm(`¿Cancelar el encargo ${o.publicCode}?`)) updateStatus(o.id, "cancelled");
                                }}
                            />
                        ))
                    )}
                </div>

                {/* Detalle */}
                <div className="lg:sticky lg:top-4 self-start">
                    {selectedOrder ? (
                        <OrderDetail order={selectedOrder} onClose={() => setSelectedId(null)} />
                    ) : (
                        <Card>
                            <CardContent className="py-12 text-center text-sm text-muted-foreground">
                                Selecciona un encargo para ver el detalle.
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

function OrderCard({
    order, selected, flash, onSelect, onAdvance, onCancel,
}: {
    order: Order; selected: boolean; flash: boolean;
    onSelect: () => void; onAdvance: () => void; onCancel: () => void;
}) {
    const next = nextStatusFor(order);
    const dt = new Date(order.scheduledFor);
    return (
        <div
            onClick={onSelect}
            className={`rounded-2xl border bg-white p-4 cursor-pointer transition ${
                selected ? "border-veci-primary shadow-md" :
                flash ? "border-amber-400 shadow-lg ring-2 ring-amber-300 animate-pulse" :
                "border-slate-200 hover:border-slate-300"
            }`}
        >
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                    <p className="font-mono text-xl font-extrabold text-veci-primary leading-none">{order.publicCode}</p>
                    <p className="text-[10px] text-slate-400 mt-1">{new Date(order.createdAt).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        {dt.toLocaleDateString("es-CL", { weekday: "short", day: "2-digit", month: "short" })}
                        <Clock className="h-3.5 w-3.5 text-slate-500 ml-1" />
                        {dt.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-0.5">
                        {order.method === "pickup" ? <Store className="h-3 w-3" /> : <Truck className="h-3 w-3" />}
                        {order.method === "pickup" ? "Retiro local" : "Delivery"} · {order.items.length} item(s)
                    </div>
                    {order.customer.name && (
                        <p className="text-xs text-slate-500 mt-1 truncate">{order.customer.name}{order.contactPhone || order.customer.phone ? ` · ${order.contactPhone || order.customer.phone}` : ""}</p>
                    )}
                </div>
                <div className="flex-shrink-0 text-right">
                    <p className="text-base font-extrabold text-slate-800">${order.total.toLocaleString("es-CL")}</p>
                    <Badge variant="outline" className={`mt-1 ${STATUS_COLOR[order.status]}`}>
                        {STATUS_LABEL[order.status]}
                    </Badge>
                </div>
            </div>

            {next && (
                <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" className="flex-1" onClick={onAdvance}>
                        {order.status === "pending" && <Check className="h-3.5 w-3.5 mr-1" />}
                        {order.status === "confirmed" && <ChefHat className="h-3.5 w-3.5 mr-1" />}
                        {order.status === "preparing" && <PackageCheck className="h-3.5 w-3.5 mr-1" />}
                        {order.status === "ready" && (order.method === "pickup" ? <Store className="h-3.5 w-3.5 mr-1" /> : <Truck className="h-3.5 w-3.5 mr-1" />)}
                        {order.status === "out_for_delivery" && <PackageCheck className="h-3.5 w-3.5 mr-1" />}
                        {advanceBtnLabel(order)}
                    </Button>
                    {order.status !== "delivered" && order.status !== "cancelled" && (
                        <Button size="sm" variant="outline" onClick={onCancel}>
                            <XIcon className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}

function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
    return (
        <Card>
            <CardContent className="p-4 space-y-4">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="font-mono text-2xl font-black text-veci-primary leading-none">{order.publicCode}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(order.createdAt).toLocaleString("es-CL")}</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>

                <Badge className={STATUS_COLOR[order.status]}>{STATUS_LABEL[order.status]}</Badge>

                <div className="text-sm space-y-2">
                    <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-slate-400" /> {new Date(order.scheduledFor).toLocaleString("es-CL", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" })}</div>
                    <div className="flex items-center gap-2">
                        {order.method === "pickup" ? <Store className="h-4 w-4 text-slate-400" /> : <Truck className="h-4 w-4 text-slate-400" />}
                        <span>{order.method === "pickup" ? "Retiro en local" : "Delivery"}</span>
                    </div>
                    {order.method === "delivery" && order.address && (
                        <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" /> <span className="text-slate-700">{order.address}</span></div>
                    )}
                    {(order.contactPhone || order.customer.phone) && (
                        <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> {order.contactPhone || order.customer.phone}</div>
                    )}
                    {order.customer.name && (
                        <p className="text-xs text-slate-500">{order.customer.name} · {order.customer.email}</p>
                    )}
                </div>

                <div className="border-t pt-3 space-y-2">
                    {order.items.map((it) => {
                        const weightStr = it.pricingMode === "kg" && it.gramsPerUnit
                            ? ` (~${((it.quantity * it.gramsPerUnit) / 1000).toFixed(2)} kg)`
                            : "";
                        return (
                            <div key={it.id} className="text-sm">
                                <div className="flex justify-between gap-2">
                                    <span className="flex-1 min-w-0">
                                        <strong>{it.quantity}x</strong> {it.productName}
                                        <span className="text-xs text-slate-400">{weightStr}</span>
                                    </span>
                                    <span className="font-semibold">${it.subtotal.toLocaleString("es-CL")}</span>
                                </div>
                                {it.notes && (
                                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-0.5 mt-1 inline-block">📝 {it.notes}</p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {order.generalNotes && (
                    <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-xs text-amber-900">
                        <strong>Notas:</strong> {order.generalNotes}
                    </div>
                )}

                <div className="border-t pt-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>${order.subtotal.toLocaleString("es-CL")}</span></div>
                    {order.deliveryFee > 0 && (
                        <div className="flex justify-between"><span className="text-slate-500">Delivery</span><span>${order.deliveryFee.toLocaleString("es-CL")}</span></div>
                    )}
                    <div className="flex justify-between font-extrabold text-base pt-1 border-t">
                        <span>Total</span><span>${order.total.toLocaleString("es-CL")}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
