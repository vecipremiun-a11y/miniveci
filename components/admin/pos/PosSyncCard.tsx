"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, RefreshCw, Database, AlertTriangle } from "lucide-react";

export function PosSyncCard() {
    const [isSyncing, setIsSyncing] = useState<"incremental" | "total" | null>(null);

    const handleSync = async (type: "incremental" | "total") => {
        setIsSyncing(type);
        try {
            const res = await fetch("/api/admin/pos/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ type }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Fallo en la sincronización");
            }

            const data = await res.json();

            toast.success(`Sincronización ${type} exitosa`, {
                description: `Procesados: ${data.processed} | Creados: ${data.created} | Actualizados: ${data.updated}${data.errors > 0 ? ` | Errores: ${data.errors}` : ""} | ${(data.durationMs / 1000).toFixed(1)}s`
            });
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSyncing(null);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Sincronización Manual</CardTitle>
                <CardDescription>Fuerza la descarga de datos desde tu POS según tus configuraciones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-6 bg-slate-50 flex flex-col items-center justify-center text-center">
                        <RefreshCw className={`w-10 h-10 mb-2 text-blue-500 ${isSyncing === 'incremental' ? 'animate-spin' : ''}`} />
                        <h3 className="font-semibold text-lg">Sync Incremental</h3>
                        <p className="text-sm text-muted-foreground mb-4">Descarga únicamente los cambios producidos desde la última sincronización. Rápido y ligero.</p>
                        <Button
                            onClick={() => handleSync("incremental")}
                            disabled={isSyncing !== null}
                            className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                        >
                            {isSyncing === 'incremental' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Iniciar
                        </Button>
                    </div>

                    <div className="border rounded-lg p-6 bg-amber-50 flex flex-col items-center justify-center text-center">
                        <Database className="w-10 h-10 mb-2 text-amber-500" />
                        <h3 className="font-semibold text-lg">Sync Total</h3>
                        <p className="text-sm text-muted-foreground mb-4">Descarga el catálogo íntegro del POS. Puede demorar varios minutos dependiendo del volumen.</p>
                        <Button
                            variant="outline"
                            onClick={() => handleSync("total")}
                            disabled={isSyncing !== null}
                            className="text-amber-700 border-amber-300 hover:bg-amber-100 w-full"
                        >
                            {isSyncing === 'total' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Iniciar Reconstrucción
                        </Button>
                    </div>
                </div>

                {isSyncing && (
                    <div className="pt-4 animate-pulse text-center text-sm text-muted-foreground">
                        Sincronizando información. Por favor, no cierres esta pestaña...
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
