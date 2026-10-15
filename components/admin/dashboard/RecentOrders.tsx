import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatCLP } from "@/lib/bakery-shared";
import type { DashboardData } from "@/lib/admin-dashboard";

// Mismos rótulos y colores que la tabla de pedidos (OrderTable es "use client",
// así que no se puede importar su statusConfig desde este server component).
const STATUS: Record<string, { label: string; color: string }> = {
    new: { label: "Nuevo", color: "bg-blue-100 text-blue-800 border-blue-200" },
    confirmed: { label: "Confirmado", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
    paid: { label: "Pagado", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    preparing: { label: "Preparando", color: "bg-orange-100 text-orange-800 border-orange-200" },
    ready: { label: "Listo", color: "bg-green-100 text-green-800 border-green-200" },
    shipped: { label: "En Camino", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
    delivered: { label: "Entregado", color: "bg-slate-100 text-slate-800 border-slate-200" },
    cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800 border-red-200" },
    refunded: { label: "Reembolsado", color: "bg-red-100 text-red-800 border-red-200" },
};

const dateFmt = new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Santiago",
    day: "numeric",
    month: "short",
});

function timeAgo(iso: string, now: number): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return "";
    const minutes = Math.max(0, Math.round((now - then) / 60_000));
    if (minutes < 1) return "Recién";
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `Hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
    const days = Math.round(hours / 24);
    if (days < 7) return `Hace ${days} ${days === 1 ? "día" : "días"}`;
    return dateFmt.format(new Date(iso));
}

export function RecentOrders({ orders }: { orders: DashboardData["recentOrders"] }) {
    const now = Date.now();

    return (
        <Card className="lg:col-span-3 min-w-0">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Pedidos Recientes</CardTitle>
                <Link
                    href="/admin/pedidos"
                    className="flex items-center text-sm text-blue-600 hover:text-blue-800"
                >
                    Ver todos <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
            </CardHeader>
            <CardContent>
                {orders.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay pedidos.</p>
                ) : (
                    <div className="space-y-1">
                        {orders.map((order) => {
                            const status = STATUS[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-700 border-gray-200" };
                            return (
                                <Link
                                    key={order.id}
                                    href={`/admin/pedidos/${order.id}`}
                                    className="flex items-center justify-between gap-3 rounded-md border-b px-2 py-3 last:border-0 hover:bg-slate-50"
                                >
                                    <div className="min-w-0 space-y-1">
                                        <p className="truncate text-sm font-medium leading-none">{order.customerName}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {order.orderNumber} • {timeAgo(order.createdAt, now)}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                                        <Badge variant="outline" className={status.color}>
                                            {status.label}
                                        </Badge>
                                        <div className="w-20 text-right font-medium">{formatCLP(order.total)}</div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
