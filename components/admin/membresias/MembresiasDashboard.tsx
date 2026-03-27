"use client";

import { useEffect, useState } from "react";
import { Crown, Users, DollarSign, TrendingDown, TrendingUp, CreditCard, UserMinus, RefreshCw } from "lucide-react";

interface Stats {
    totalActive: number;
    totalCancelled: number;
    totalExpired: number;
    totalAll: number;
    monthlyRevenue: number;
    totalRevenue: number;
    churnRate: number;
}

interface SubRecord {
    id: string;
    customerName: string | null;
    customerEmail: string | null;
    status: string;
    startDate: string;
    endDate: string;
    price: number;
    createdAt: string | null;
}

export function MembresiasDashboard() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [recentSubs, setRecentSubs] = useState<SubRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = () => {
        setLoading(true);
        fetch("/api/admin/subscriptions")
            .then(r => r.json())
            .then(data => {
                setStats(data.stats);
                setRecentSubs(data.subscriptions?.slice(0, 5) || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, []);

    const fmt = (n: number) => `$${n.toLocaleString("es-CL")}`;
    const formatDate = (d: string) => new Date(d).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-gray-200" />)}
                </div>
                <div className="h-64 rounded-xl bg-gray-200" />
            </div>
        );
    }

    const statCards = [
        {
            label: "Suscriptores Activos",
            value: stats?.totalActive ?? 0,
            icon: Crown,
            color: "text-amber-600 bg-amber-50",
            trend: null,
        },
        {
            label: "Recaudo Mensual",
            value: fmt(stats?.monthlyRevenue ?? 0),
            icon: DollarSign,
            color: "text-emerald-600 bg-emerald-50",
            trend: null,
        },
        {
            label: "Total Recaudado",
            value: fmt(stats?.totalRevenue ?? 0),
            icon: CreditCard,
            color: "text-blue-600 bg-blue-50",
            trend: null,
        },
        {
            label: "Tasa de Cancelación",
            value: `${stats?.churnRate ?? 0}%`,
            icon: UserMinus,
            color: "text-red-600 bg-red-50",
            trend: null,
        },
    ];

    return (
        <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map((card) => (
                    <div key={card.label} className="bg-white rounded-xl border shadow-sm p-5">
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</span>
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color}`}>
                                <card.icon size={18} />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-slate-900">{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-sm font-medium text-slate-700">Activas</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{stats?.totalActive ?? 0}</p>
                    <p className="text-xs text-slate-500 mt-1">suscripciones generando ingresos</p>
                </div>
                <div className="bg-white rounded-xl border shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-sm font-medium text-slate-700">Canceladas</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{stats?.totalCancelled ?? 0}</p>
                    <p className="text-xs text-slate-500 mt-1">suscripciones canceladas</p>
                </div>
                <div className="bg-white rounded-xl border shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="text-sm font-medium text-slate-700">Expiradas</span>
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{stats?.totalExpired ?? 0}</p>
                    <p className="text-xs text-slate-500 mt-1">suscripciones vencidas</p>
                </div>
            </div>

            {/* Recent Subscriptions */}
            <div className="bg-white rounded-xl border shadow-sm">
                <div className="p-5 border-b flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">Suscripciones Recientes</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Últimas 5 suscripciones registradas</p>
                    </div>
                    <button onClick={fetchData} className="p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer" title="Actualizar">
                        <RefreshCw size={16} className="text-slate-500" />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs text-slate-500 border-b bg-slate-50">
                                <th className="px-5 py-3 font-semibold">Cliente</th>
                                <th className="px-5 py-3 font-semibold">Email</th>
                                <th className="px-5 py-3 font-semibold">Plan</th>
                                <th className="px-5 py-3 font-semibold">Estado</th>
                                <th className="px-5 py-3 font-semibold">Fecha</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentSubs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                                        No hay suscripciones registradas
                                    </td>
                                </tr>
                            ) : (
                                recentSubs.map((sub) => (
                                    <tr key={sub.id} className="border-b last:border-0 hover:bg-slate-50">
                                        <td className="px-5 py-3 font-medium text-slate-800">{sub.customerName || "—"}</td>
                                        <td className="px-5 py-3 text-slate-600">{sub.customerEmail || "—"}</td>
                                        <td className="px-5 py-3">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
                                                <Crown size={12} /> Premium
                                            </span>
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                                sub.status === "active" ? "bg-emerald-100 text-emerald-700" :
                                                sub.status === "cancelled" ? "bg-red-100 text-red-700" :
                                                "bg-yellow-100 text-yellow-700"
                                            }`}>
                                                {sub.status === "active" ? "Activa" : sub.status === "cancelled" ? "Cancelada" : "Expirada"}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-slate-500">{sub.createdAt ? formatDate(sub.createdAt) : "—"}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
