"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Link as LinkIcon, Power, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export function PosConnectionCard() {
    const [config, setConfig] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isDisabled, setIsDisabled] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const res = await fetch("/api/admin/pos/config");
            const data = await res.json();
            if (data.disabled) {
                setIsDisabled(true);
                return;
            }
            setConfig(data);
        } catch (error) {
            toast.error("Error al cargar configuración");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await fetch("/api/admin/pos/config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (!res.ok) throw new Error("Error al guardar");
            toast.success("Configuración guardada");
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        try {
            const res = await fetch("/api/admin/pos/test-connection", { method: "POST" });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
            } else {
                toast.error(data.message);
            }
            await fetchConfig(); // Refresh state
        } catch (error: any) {
            toast.error("Error en prueba de conexión");
        } finally {
            setIsTesting(false);
        }
    };

    if (isLoading && !isDisabled) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

    return (
        <div className="space-y-4">
            {isDisabled && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-amber-800">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <div>
                            <p className="font-medium">Integración POS no activada</p>
                            <p className="text-sm mt-1">Las APIs del POS están desactivadas. Primero arma tu catálogo completo y luego conecta tu sistema POS aquí.</p>
                        </div>
                    </div>
                </div>
            )}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isDisabled ? "opacity-50 pointer-events-none" : ""}`}>
                <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <LinkIcon className="w-5 h-5" /> Conexión HTTP
                    </CardTitle>
                    <CardDescription>Credenciales de tu API REST del POS</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium">Estado actual:</span>
                        {config?.isConnected ?
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Conectado</Badge>
                            : config?.apiUrl ?
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><AlertTriangle className="w-3 h-3 mr-1" /> Desconectado</Badge>
                                : <Badge variant="outline" className="bg-gray-50 text-gray-700">Sin Configurar</Badge>
                        }
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">URL Base del POS</label>
                        <Input
                            placeholder="https://api.tu-pos.com/v1"
                            value={config?.apiUrl || ""}
                            onChange={e => setConfig({ ...config, apiUrl: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">API Key / Token Bearer</label>
                        <Input
                            type="password"
                            placeholder="••••••••••••••••"
                            value={config?.apiKey || ""}
                            onChange={e => setConfig({ ...config, apiKey: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Company ID</label>
                        <Input
                            placeholder="default"
                            value={config?.companyId || ""}
                            onChange={e => setConfig({ ...config, companyId: e.target.value })}
                        />
                    </div>

                    <div className="pt-4 flex gap-2">
                        <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Guardar
                        </Button>
                        <Button variant="secondary" className="flex-1" onClick={handleTest} disabled={isTesting || !config?.apiUrl}>
                            {isTesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Power className="w-4 h-4 mr-2" />}
                            Probar Conexión
                        </Button>
                    </div>
                    {config?.lastConnectionTest && (
                        <p className="text-xs text-muted-foreground text-center mt-2">
                            Última prueba: hace {formatDistanceToNow(new Date(config.lastConnectionTest), { locale: es })}
                        </p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Switches Globales</CardTitle>
                    <CardDescription>Controla qué atributos se sobreescriben al importar datos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium">Sincronizar Precios</label>
                            <p className="text-xs text-muted-foreground">Actualiza automáticamente pos_price</p>
                        </div>
                        <Switch checked={config?.syncPrices} onCheckedChange={c => setConfig({ ...config, syncPrices: c })} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium">Sincronizar Stock</label>
                            <p className="text-xs text-muted-foreground">Actualiza automáticamente pos_stock</p>
                        </div>
                        <Switch checked={config?.syncStock} onCheckedChange={c => setConfig({ ...config, syncStock: c })} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium">Sincronizar Nombres</label>
                            <p className="text-xs text-muted-foreground">Sobreescribe el nombre principal si difiere</p>
                        </div>
                        <Switch checked={config?.syncName} onCheckedChange={c => setConfig({ ...config, syncName: c })} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="text-sm font-medium">Sincronizar Imágenes</label>
                            <p className="text-xs text-muted-foreground">Descarga adjuntos desde el endpoint POS</p>
                        </div>
                        <Switch checked={config?.syncImages} onCheckedChange={c => setConfig({ ...config, syncImages: c })} />
                    </div>

                    <div className="bg-yellow-50 p-3 rounded-md text-xs text-yellow-800 flex gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <p>Estos son los valores por defecto globales aplicados cuando invocas Sync Total. Puedes overridear esta decisión producto por producto desde el catálogo.</p>
                    </div>

                    <Button onClick={handleSave} disabled={isSaving} className="w-full">
                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Guardar Preferencias
                    </Button>
                </CardContent>
            </Card>
            </div>
        </div>
    );
}
