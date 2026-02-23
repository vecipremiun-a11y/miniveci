import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function RecentOrders() {
    return (
        <Card className="col-span-4 lg:col-span-3">
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
                <div className="space-y-4">
                    {/* Mock Rows */}
                    {[
                        { id: "ORD-001", customer: "Juan Pérez", total: "$25,990", status: "preparing", time: "Hace 15 min" },
                        { id: "ORD-002", customer: "María González", total: "$12,500", status: "new", time: "Hace 30 min" },
                        { id: "ORD-003", customer: "Carlos Ruiz", total: "$45,000", status: "ready", time: "Hace 1 hora" },
                        { id: "ORD-004", customer: "Ana López", total: "$8,990", status: "delivered", time: "Hace 2 horas" },
                        { id: "ORD-005", customer: "Pedro Soto", total: "$62,400", status: "paid", time: "Hace 3 horas" },
                    ].map((order) => (
                        <div key={order.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                            <div className="space-y-1">
                                <p className="text-sm font-medium leading-none">{order.customer}</p>
                                <p className="text-xs text-muted-foreground">{order.id} • {order.time}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <Badge
                                    variant={
                                        order.status === 'new' ? 'destructive' :
                                            order.status === 'preparing' ? 'default' :
                                                order.status === 'ready' ? 'secondary' :
                                                    order.status === 'delivered' ? 'outline' : 'default'
                                    }
                                    className={
                                        order.status === 'new' ? 'bg-blue-500 hover:bg-blue-600' :
                                            order.status === 'preparing' ? 'bg-orange-500 hover:bg-orange-600' :
                                                order.status === 'paid' ? 'bg-green-500 hover:bg-green-600' : ''
                                    }
                                >
                                    {order.status === 'new' ? 'Nuevo' :
                                        order.status === 'preparing' ? 'Preparando' :
                                            order.status === 'ready' ? 'Listo' :
                                                order.status === 'paid' ? 'Pagado' :
                                                    order.status === 'delivered' ? 'Entregado' : order.status}
                                </Badge>
                                <div className="font-medium w-16 text-right">{order.total}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
