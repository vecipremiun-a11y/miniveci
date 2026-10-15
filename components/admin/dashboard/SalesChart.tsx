"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { useEffect, useState } from "react";
import { formatCLP } from "@/lib/bakery-shared";
import type { DashboardData } from "@/lib/admin-dashboard";

type Period = keyof DashboardData["sales"];

const PERIODS: { key: Period; label: string; caption: string }[] = [
    { key: "hoy", label: "Hoy", caption: "por hora" },
    { key: "semana", label: "Semana", caption: "últimos 7 días" },
    { key: "mes", label: "Mes", caption: "últimos 30 días" },
];

const compactCLP = new Intl.NumberFormat("es-CL", { notation: "compact", maximumFractionDigits: 1 });

export function SalesChart({ sales }: { sales: DashboardData["sales"] }) {
    const [period, setPeriod] = useState<Period>("semana");
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const data = sales[period];
    const total = data.reduce((sum, p) => sum + p.tienda + p.encargos, 0);
    const caption = PERIODS.find((p) => p.key === period)?.caption;

    return (
        <Card className="col-span-4">
            <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="space-y-1">
                    <CardTitle>Resumen de Ventas</CardTitle>
                    <p className="text-sm text-muted-foreground">
                        <span className="font-semibold text-slate-900">{formatCLP(total)}</span> · {caption}
                    </p>
                </div>
                <div className="flex space-x-1 rounded-lg bg-slate-100 p-1">
                    {PERIODS.map((p) => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${period === p.key ? "bg-slate-900 text-white shadow-sm" : "text-slate-700 hover:bg-white"}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[300px] w-full">
                    {!isMounted ? (
                        <div className="h-full w-full rounded-2xl bg-slate-100/80" aria-hidden="true" />
                    ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorTienda" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorEncargos" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="label"
                                stroke="#64748b"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={16}
                            />
                            <YAxis
                                stroke="#64748b"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                width={48}
                                tickFormatter={(value: number) => `$${compactCLP.format(value)}`}
                            />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <Tooltip
                                formatter={(value, name) => [formatCLP(Number(value)), name]}
                                contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                            <Area
                                type="monotone"
                                dataKey="tienda"
                                name="Tienda"
                                stackId="ventas"
                                stroke="#0f172a"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorTienda)"
                            />
                            <Area
                                type="monotone"
                                dataKey="encargos"
                                name="Encargos"
                                stackId="ventas"
                                stroke="#d97706"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorEncargos)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
