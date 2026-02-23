"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ServerCog, Copy, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PosLogsCard() {
    const [logs, setLogs] = useState<any[]>([]);
    const [hooks, setHooks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [resLogs, resHooks] = await Promise.all([
                fetch("/api/admin/pos/logs?limit=10"),
                fetch("/api/admin/pos/webhooks?limit=10")
            ]);

            // Si las APIs están desactivadas (503), simplemente dejamos las listas vacías
            if (resLogs.ok) {
                const logsData = await resLogs.json();
                if (!logsData.disabled) setLogs(logsData.data || []);
            }
            if (resHooks.ok) {
                const hooksData = await resHooks.json();
                if (!hooksData.disabled) setHooks(hooksData.data || []);
            }
        } catch (error) {
            // Silenciar errores cuando POS está desactivado
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const copyWebhookUrl = () => {
        navigator.clipboard.writeText("https://miniveci.cl/api/admin/pos/webhooks");
        toast.success("URL copiada al portapapeles");
    };

    const handleReprocess = async (id: string) => {
        try {
            const res = await fetch(`/api/admin/pos/webhooks/${id}/reprocess`, { method: "POST" });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Webhook reprocesado");
                fetchData();
            } else {
                toast.error(data.message || "Fallo en reprocesado");
            }
        } catch (e) {
            toast.error("Error de conexión");
        }
    }

    if (isLoading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2"><ServerCog className="w-5 h-5" /> Webhooks Públicos</CardTitle>
                            <CardDescription>Transacciones reportadas en tiempo real por el Punto de Venta</CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700">Activo ✓</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-slate-50 border p-3 rounded flex justify-between items-center text-sm font-mono text-slate-600">
                        https://miniveci.cl/api/admin/pos/webhooks
                        <Button variant="ghost" size="sm" onClick={copyWebhookUrl}><Copy className="w-4 h-4" /></Button>
                    </div>

                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Evento</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {hooks.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground h-24">No hay webhooks registrados.</TableCell>
                                    </TableRow>
                                ) : hooks.map((hook) => (
                                    <TableRow key={hook.id}>
                                        <TableCell className="text-xs">{format(new Date(hook.createdAt), "dd MMM HH:mm", { locale: es })}</TableCell>
                                        <TableCell className="font-medium text-xs uppercase">{hook.eventType}</TableCell>
                                        <TableCell>
                                            {hook.processed ? <Badge variant="secondary" className="bg-green-100 text-green-700">Procesado</Badge> : <Badge variant="destructive">Fallido ({hook.retryCount})</Badge>}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" title="Reprocesar" onClick={() => handleReprocess(hook.id)}>
                                                <RefreshCw className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Últimas Sincronizaciones (Logs)</CardTitle>
                    <CardDescription>Historial de tareas automáticas y manuales del sincronizador de datos.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Ejecución</TableHead>
                                    <TableHead>Proc. / Creados / Actualizados</TableHead>
                                    <TableHead>Errores</TableHead>
                                    <TableHead>Duración</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground h-24">No hay logs de sincronización recientes.</TableCell>
                                    </TableRow>
                                ) : logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-xs">{format(new Date(log.createdAt), "dd MMM HH:mm:ss", { locale: es })}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize text-xs">{log.eventType.replace('_', ' ')}</Badge>
                                        </TableCell>
                                        <TableCell className="text-xs font-mono">
                                            {log.productsProcessed} / <span className="text-blue-600">{log.productsCreated}</span> / <span className="text-green-600">{log.productsUpdated}</span>
                                        </TableCell>
                                        <TableCell>
                                            {log.errorsCount > 0 ? <span className="text-red-500 font-bold">{log.errorsCount}</span> : "0"}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{log.durationMs}ms</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
