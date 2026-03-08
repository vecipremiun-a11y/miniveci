"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useEffect, useState } from "react";

const data = [
    { name: "00:00", total: 0 },
    { name: "04:00", total: 0 },
    { name: "08:00", total: 12000 },
    { name: "12:00", total: 45000 },
    { name: "16:00", total: 89000 },
    { name: "20:00", total: 135000 },
    { name: "23:59", total: 154990 },
];

export function SalesChart() {
    const [period, setPeriod] = useState("hoy"); // hoy, semana, mes
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    return (
        <Card className="col-span-4">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Resumen de Ventas</CardTitle>
                <div className="flex space-x-2">
                    <button
                        onClick={() => setPeriod("hoy")}
                        className={`text-xs px-2 py-1 rounded-md ${period === 'hoy' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                        Hoy
                    </button>
                    <button
                        onClick={() => setPeriod("semana")}
                        className={`text-xs px-2 py-1 rounded-md ${period === 'semana' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                        Semana
                    </button>
                    <button
                        onClick={() => setPeriod("mes")}
                        className={`text-xs px-2 py-1 rounded-md ${period === 'mes' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                        Mes
                    </button>
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
                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0f172a" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="name"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `$${value}`}
                            />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <Tooltip
                                formatter={(value: any) => [`$${value.toLocaleString()}`, 'Ventas']}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="total"
                                stroke="#0f172a"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorTotal)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
