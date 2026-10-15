import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, XCircle, type LucideIcon } from "lucide-react";
import type { DashboardData } from "@/lib/admin-dashboard";

type Alert = { type: "error" | "warning" | "info"; message: string; detail: string; href: string };

const ICONS: Record<Alert["type"], { icon: LucideIcon; color: string; bg: string }> = {
    error: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    warning: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
    info: { icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-50" },
};

const n = (value: number) => value.toLocaleString("es-CL");
const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

export function SystemAlerts({ alerts: a }: { alerts: DashboardData["alerts"] }) {
    const alerts: Alert[] = [];

    if (a.supportUnread > 0) {
        alerts.push({
            type: "error",
            message: `${n(a.supportUnread)} ${plural(a.supportUnread, "conversación", "conversaciones")} de soporte sin leer`,
            detail: `${n(a.supportOpen)} abiertas en total`,
            href: "/admin/soporte",
        });
    }
    if (a.bakeryPending > 0) {
        alerts.push({
            type: "warning",
            message: `${n(a.bakeryPending)} ${plural(a.bakeryPending, "encargo", "encargos")} por confirmar`,
            detail: "Esperando confirmación en amasandería",
            href: "/admin/encargos",
        });
    }
    if (a.outOfStock > 0) {
        alerts.push({
            type: "error",
            message: `${n(a.outOfStock)} ${plural(a.outOfStock, "producto publicado", "productos publicados")} sin stock`,
            detail: "No se pueden comprar en la tienda",
            href: "/admin/catalogo",
        });
    }
    if (a.lowStock > 0) {
        alerts.push({
            type: "warning",
            message: `${n(a.lowStock)} ${plural(a.lowStock, "producto", "productos")} con stock bajo`,
            detail: "Entre 1 y 5 unidades disponibles",
            href: "/admin/catalogo",
        });
    }
    if (a.awaitingOnlinePayment > 0) {
        alerts.push({
            type: "info",
            message: `${n(a.awaitingOnlinePayment)} ${plural(a.awaitingOnlinePayment, "pedido espera", "pedidos esperan")} pago de Mercado Pago`,
            detail: "Checkout iniciado, pago aún no recibido",
            href: "/admin/pedidos",
        });
    }

    return (
        <Card className="col-span-4 lg:col-span-2">
            <CardHeader>
                <CardTitle>Alertas del Sistema</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {alerts.map((alert) => {
                        const { icon: Icon, color, bg } = ICONS[alert.type];
                        return (
                            <Link
                                key={alert.message}
                                href={alert.href}
                                className={`flex items-start gap-4 rounded-lg p-3 transition-opacity hover:opacity-80 ${bg}`}
                            >
                                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
                                <div className="flex-1 text-sm">
                                    <p className="font-medium text-gray-900">{alert.message}</p>
                                    <p className="text-xs text-gray-600">{alert.detail}</p>
                                </div>
                                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                            </Link>
                        );
                    })}
                    {alerts.length === 0 && (
                        <div className="flex items-start gap-4 rounded-lg bg-green-50 p-3">
                            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                            <div className="text-sm">
                                <p className="font-medium text-gray-900">Todo en orden</p>
                                <p className="text-xs text-gray-600">No hay nada pendiente por revisar</p>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
