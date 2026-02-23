import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export function SystemAlerts() {
    const alerts = [
        { type: "error", message: "3 productos sin stock crítico", icon: XCircle },
        { type: "warning", message: "Última sync POS hace 2 horas", icon: AlertTriangle },
        { type: "info", message: "2 pedidos sin confirmar pago (Transferencia)", icon: AlertCircle },
        { type: "error", message: "1 webhook de POS fallido", icon: ActivityIcon },
    ];

    function ActivityIcon(props: any) {
        return <AlertCircle {...props} className="h-4 w-4 text-red-500" />
    }

    return (
        <Card className="col-span-4 lg:col-span-2">
            <CardHeader>
                <CardTitle>Alertas del Sistema</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {alerts.map((alert, i) => {
                        const Icon = alert.icon;
                        return (
                            <div key={i} className="flex items-start gap-4 rounded-lg bg-gray-50 p-3">
                                <Icon
                                    className={`mt-0.5 h-5 w-5 ${alert.type === 'error' ? 'text-red-500' :
                                            alert.type === 'warning' ? 'text-yellow-500' :
                                                'text-blue-500'
                                        }`}
                                />
                                <div className="text-sm">
                                    <p className="font-medium text-gray-900">{alert.message}</p>
                                    <p className="text-xs text-gray-500">Hace unos momentos</p>
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex items-start gap-4 rounded-lg bg-green-50 p-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-500" />
                        <div className="text-sm">
                            <p className="font-medium text-gray-900">Base de datos sincronizada</p>
                            <p className="text-xs text-gray-500">Estado operativo normal</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
