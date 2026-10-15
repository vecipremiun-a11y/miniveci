import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ShoppingCart, Cookie, Users } from "lucide-react";
import { formatCLP } from "@/lib/bakery-shared";
import type { DashboardData } from "@/lib/admin-dashboard";

function salesDelta(today: number, yesterday: number): string {
    if (yesterday === 0) return today > 0 ? "Ayer: sin ventas" : "Sin ventas ayer ni hoy";
    const pct = Math.round(((today - yesterday) / yesterday) * 100);
    return `${pct >= 0 ? "+" : ""}${pct}% respecto a ayer (${formatCLP(yesterday)})`;
}

export function StatsCards({ stats }: { stats: DashboardData["stats"] }) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ventas Hoy</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCLP(stats.salesToday)}</div>
                    <p className="text-xs text-muted-foreground">
                        {stats.ordersToday} {stats.ordersToday === 1 ? "venta" : "ventas"} · {salesDelta(stats.salesToday, stats.salesYesterday)}
                    </p>
                </CardContent>
            </Card>
            <Link href="/admin/pedidos" className="block">
                <Card className="h-full transition-colors hover:border-slate-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pedidos por Atender</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.storeOpen}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.storeNew} {stats.storeNew === 1 ? "nuevo sin confirmar" : "nuevos sin confirmar"}
                        </p>
                    </CardContent>
                </Card>
            </Link>
            <Link href="/admin/encargos" className="block">
                <Card className="h-full transition-colors hover:border-slate-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Encargos en Curso</CardTitle>
                        <Cookie className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.bakeryOpen}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.bakeryForToday} para hoy{stats.bakeryOverdue > 0 && (
                                <span className="text-amber-700"> · {stats.bakeryOverdue} con fecha vencida</span>
                            )}
                        </p>
                    </CardContent>
                </Card>
            </Link>
            <Link href="/admin/clientes" className="block">
                <Card className="h-full transition-colors hover:border-slate-300">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Clientes Nuevos (7 días)</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">+{stats.customersWeek}</div>
                        <p className="text-xs text-muted-foreground">
                            {stats.customersToday} hoy · {stats.customersTotal.toLocaleString("es-CL")} en total
                        </p>
                    </CardContent>
                </Card>
            </Link>
        </div>
    );
}
