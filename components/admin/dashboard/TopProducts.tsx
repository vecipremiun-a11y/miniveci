import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package } from "lucide-react";

export function TopProducts() {
    return (
        <Card className="col-span-4 lg:col-span-2">
            <CardHeader>
                <CardTitle>Más Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {[
                        { name: "Coca Cola 3L", sold: 145, img: null },
                        { name: "Pan Hallulla kg", sold: 120, img: null },
                        { name: "Leche Colun Entera", sold: 85, img: null },
                        { name: "Huevos x12", sold: 60, img: null },
                        { name: "Harina Selecta", sold: 45, img: null },
                    ].map((product, i) => (
                        <div key={i} className="flex items-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-slate-100">
                                <Package className="h-5 w-5 text-slate-500" />
                            </div>
                            <div className="ml-4 space-y-1">
                                <p className="text-sm font-medium leading-none">{product.name}</p>
                                <p className="text-xs text-muted-foreground">En stock: 50</p>
                            </div>
                            <div className="ml-auto font-medium">+{product.sold}</div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
