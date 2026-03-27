"use client";

import React, { useEffect, useState } from "react";
import { Crown, Search, RefreshCw, ChevronDown, ChevronUp, Calendar, CreditCard, Mail, Phone, User } from "lucide-react";

interface PaymentRecord {
    date: string;
    amount: number;
    paymentId: string;
    status: string;
}

interface Subscriber {
    id: string;
    customerId: string;
    plan: string;
    status: string;
    startDate: string;
    endDate: string;
    price: number;
    paymentMethod: string | null;
    mpPreApprovalId: string | null;
    paymentHistory: PaymentRecord[] | string | null;
    cancelledAt: string | null;
    createdAt: string | null;
    customerName: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
}

export function SuscriptoresList() {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchData = () => {
        setLoading(true);
        fetch("/api/admin/subscriptions")
            .then(r => r.json())
            .then(data => {
                setSubscribers(data.subscriptions || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    const formatDate = (d: string) => new Date(d).toLocaleDateString("es-CL", {
        day: "numeric", month: "short", year: "numeric"
    });

    const formatCurrency = (n: number) => `$${n.toLocaleString("es-CL")}`;

    const filtered = subscribers.filter(sub => {
        const matchSearch = !search ||
            (sub.customerName?.toLowerCase().includes(search.toLowerCase())) ||
            (sub.customerEmail?.toLowerCase().includes(search.toLowerCase())) ||
            (sub.customerPhone?.includes(search));
        const matchStatus = statusFilter === "all" || sub.status === statusFilter;
        return matchSearch && matchStatus;
    });

    const getHistory = (sub: Subscriber): PaymentRecord[] => {
        if (!sub.paymentHistory) return [];
        if (typeof sub.paymentHistory === 'string') {
            try { return JSON.parse(sub.paymentHistory); } catch { return []; }
        }
        return sub.paymentHistory;
    };

    const daysLeft = (endDate: string) => {
        const d = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return Math.max(0, d);
    };

    if (loading) {
        return (
            <div className="p-6 space-y-4 animate-pulse">
                <div className="h-10 rounded-lg bg-gray-200 w-80" />
                {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-gray-200" />)}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="p-4 border-b flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-md">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, email, teléfono..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                >
                    <option value="all">Todos los estados</option>
                    <option value="active">Activas</option>
                    <option value="cancelled">Canceladas</option>
                    <option value="expired">Expiradas</option>
                </select>
                <button onClick={fetchData} className="p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer" title="Actualizar">
                    <RefreshCw size={16} className="text-slate-500" />
                </button>
                <span className="text-xs text-slate-500 ml-auto">{filtered.length} suscriptores</span>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50">
                        <tr className="text-left text-xs text-slate-500 border-b">
                            <th className="px-4 py-3 font-semibold">Cliente</th>
                            <th className="px-4 py-3 font-semibold">Correo</th>
                            <th className="px-4 py-3 font-semibold">Teléfono</th>
                            <th className="px-4 py-3 font-semibold">Estado</th>
                            <th className="px-4 py-3 font-semibold">Inicio</th>
                            <th className="px-4 py-3 font-semibold">Próximo Cobro</th>
                            <th className="px-4 py-3 font-semibold">Días Rest.</th>
                            <th className="px-4 py-3 font-semibold">Precio</th>
                            <th className="px-4 py-3 font-semibold">Método</th>
                            <th className="px-4 py-3 font-semibold w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="px-4 py-16 text-center text-slate-400">
                                    <Crown size={40} className="mx-auto mb-3 text-slate-300" />
                                    <p className="font-medium">No se encontraron suscriptores</p>
                                    <p className="text-xs mt-1">Ajusta los filtros o espera a que alguien se suscriba</p>
                                </td>
                            </tr>
                        ) : (
                            filtered.map(sub => {
                                const isExpanded = expandedId === sub.id;
                                const history = getHistory(sub);

                                return (
                                    <React.Fragment key={sub.id}>
                                        <tr
                                            className="border-b hover:bg-slate-50 cursor-pointer"
                                            onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white text-xs font-bold">
                                                        {(sub.customerName || "?").charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-slate-800">{sub.customerName || "—"}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{sub.customerEmail || "—"}</td>
                                            <td className="px-4 py-3 text-slate-600">{sub.customerPhone || "—"}</td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    sub.status === "active" ? "bg-emerald-100 text-emerald-700" :
                                                    sub.status === "cancelled" ? "bg-red-100 text-red-700" :
                                                    "bg-yellow-100 text-yellow-700"
                                                }`}>
                                                    {sub.status === "active" ? "Activa" : sub.status === "cancelled" ? "Cancelada" : "Expirada"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{formatDate(sub.startDate)}</td>
                                            <td className="px-4 py-3 text-slate-600">{formatDate(sub.endDate)}</td>
                                            <td className="px-4 py-3">
                                                {sub.status === "active" ? (
                                                    <span className={`font-bold ${daysLeft(sub.endDate) <= 5 ? "text-red-600" : "text-slate-800"}`}>
                                                        {daysLeft(sub.endDate)}
                                                    </span>
                                                ) : "—"}
                                            </td>
                                            <td className="px-4 py-3 font-semibold text-slate-800">{formatCurrency(sub.price)}</td>
                                            <td className="px-4 py-3 text-slate-600 capitalize">{sub.paymentMethod || "—"}</td>
                                            <td className="px-4 py-3">
                                                {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-slate-50 border-b">
                                                <td colSpan={10} className="px-4 py-4">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {/* Subscription Details */}
                                                        <div className="bg-white rounded-lg border p-4">
                                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Detalles de Suscripción</h4>
                                                            <div className="space-y-2 text-sm">
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-500">ID Suscripción</span>
                                                                    <span className="font-mono text-xs text-slate-700">{sub.id.slice(0, 12)}...</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-500">MP PreApproval ID</span>
                                                                    <span className="font-mono text-xs text-slate-700">{sub.mpPreApprovalId || "—"}</span>
                                                                </div>
                                                                <div className="flex justify-between">
                                                                    <span className="text-slate-500">Creada</span>
                                                                    <span className="text-slate-700">{sub.createdAt ? formatDate(sub.createdAt) : "—"}</span>
                                                                </div>
                                                                {sub.cancelledAt && (
                                                                    <div className="flex justify-between">
                                                                        <span className="text-slate-500">Cancelada</span>
                                                                        <span className="text-red-600 font-medium">{formatDate(sub.cancelledAt)}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Payment History */}
                                                        <div className="bg-white rounded-lg border p-4">
                                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Historial de Pagos</h4>
                                                            {history.length === 0 ? (
                                                                <p className="text-sm text-slate-400">Sin pagos registrados</p>
                                                            ) : (
                                                                <div className="space-y-2">
                                                                    {history.map((p, i) => (
                                                                        <div key={i} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2 last:border-0">
                                                                            <div>
                                                                                <p className="text-slate-700 font-medium">{formatDate(p.date)}</p>
                                                                                <p className="text-xs text-slate-400 font-mono">ID: {p.paymentId}</p>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <p className="font-semibold text-slate-800">{formatCurrency(p.amount || 0)}</p>
                                                                                <span className={`text-xs font-bold ${
                                                                                    p.status === "approved" ? "text-emerald-600" :
                                                                                    p.status === "pending" ? "text-yellow-600" : "text-red-600"
                                                                                }`}>
                                                                                    {p.status === "approved" ? "Aprobado" : p.status === "pending" ? "Pendiente" : "Rechazado"}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
