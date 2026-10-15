import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cookie, Package } from "lucide-react";
import { formatCLP } from "@/lib/bakery-shared";
import type { DashboardData } from "@/lib/admin-dashboard";

export function TopProducts({ products }: { products: DashboardData["topProducts"] }) {
    return (
        <Card className="lg:col-span-2 min-w-0">
            <CardHeader>
                <CardTitle>Más Vendidos</CardTitle>
                <p className="text-sm text-muted-foreground">Tienda y amasandería, últimos 30 días</p>
            </CardHeader>
            <CardContent>
                {products.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Sin ventas en los últimos 30 días.</p>
                ) : (
                    <div className="space-y-5">
                        {products.map((product) => {
                            const isBakery = product.source === "amasanderia";
                            const Icon = isBakery ? Cookie : Package;
                            return (
                                <div key={`${product.source}-${product.name}`} className="flex items-center gap-4">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded ${isBakery ? "bg-amber-100" : "bg-slate-100"}`}>
                                        <Icon className={`h-5 w-5 ${isBakery ? "text-amber-700" : "text-slate-600"}`} />
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-1">
                                        <p className="truncate text-sm font-medium leading-none">{product.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {product.quantity.toLocaleString("es-CL")} {product.quantity === 1 ? "unidad" : "unidades"} · {isBakery ? "Amasandería" : "Tienda"}
                                        </p>
                                    </div>
                                    <div className="shrink-0 font-medium">{formatCLP(product.revenue)}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
