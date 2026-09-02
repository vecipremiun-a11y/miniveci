"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Truck } from "lucide-react";
import { toast } from "sonner";

/**
 * Condiciones de envío de la tienda: cuánto cuesta el despacho y desde qué
 * monto sale gratis. Vale para el checkout web y para la app.
 */

const money = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
});

/** Sugerencias para no tener que tipear el monto completo. */
const THRESHOLD_PRESETS = [10000, 15000, 20000, 30000];

export function DeliveryConditionsCard() {
    const [deliveryFee, setDeliveryFee] = useState("");
    const [freeEnabled, setFreeEnabled] = useState(false);
    const [threshold, setThreshold] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                const res = await fetch("/api/admin/store/config", { cache: "no-store" });
                if (!res.ok) throw new Error("No se pudo cargar la configuración de envío");
                const data = await res.json();
                if (!mounted) return;
                setDeliveryFee(String(data.deliveryFee ?? 0));
                setFreeEnabled((data.freeDeliveryThreshold ?? 0) > 0);
                setThreshold(data.freeDeliveryThreshold > 0 ? String(data.freeDeliveryThreshold) : "");
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Error al cargar el envío");
            } finally {
                if (mounted) setLoading(false);
            }
        }

        load();
        return () => { mounted = false; };
    }, []);

    const feeValue = Number(deliveryFee) || 0;
    const thresholdValue = Number(threshold) || 0;
    const thresholdInvalid = freeEnabled && thresholdValue <= 0;

    async function handleSave() {
        if (thresholdInvalid) {
            toast.error("Pon el monto desde el cual el envío es gratis");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/admin/store/config", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    deliveryFee: feeValue,
                    // Apagado se guarda como 0: una sola forma de decir "no hay envío gratis".
                    freeDeliveryThreshold: freeEnabled ? thresholdValue : 0,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "No se pudo guardar");

            setDeliveryFee(String(data.deliveryFee));
            setFreeEnabled(data.freeDeliveryThreshold > 0);
            setThreshold(data.freeDeliveryThreshold > 0 ? String(data.freeDeliveryThreshold) : "");
            toast.success("Condiciones de envío guardadas");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Error al guardar");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-veci-primary" />
                    Condiciones de envío
                </CardTitle>
                <CardDescription>
                    Cuánto cuesta el despacho a domicilio y desde qué monto sale gratis.
                    Aplica a la tienda web y a la app.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="space-y-2 max-w-xs">
                    <Label htmlFor="delivery-fee">Costo de envío</Label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input
                            id="delivery-fee"
                            type="number"
                            min={0}
                            step={100}
                            className="pl-6"
                            value={deliveryFee}
                            onChange={e => setDeliveryFee(e.target.value)}
                            disabled={loading}
                            placeholder="1990"
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Se cobra solo en pedidos con despacho. Retiro en tienda nunca paga envío.
                    </p>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="free-delivery" className="text-sm font-semibold">
                                Envío gratis sobre un monto
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Si la compra llega al monto, el despacho no se cobra.
                            </p>
                        </div>
                        <Switch
                            id="free-delivery"
                            checked={freeEnabled}
                            onCheckedChange={setFreeEnabled}
                            disabled={loading}
                        />
                    </div>

                    {freeEnabled && (
                        <div className="space-y-2 max-w-xs">
                            <Label htmlFor="free-threshold">Monto mínimo de compra</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                <Input
                                    id="free-threshold"
                                    type="number"
                                    min={0}
                                    step={1000}
                                    className="pl-6"
                                    value={threshold}
                                    onChange={e => setThreshold(e.target.value)}
                                    disabled={loading}
                                    placeholder="10000"
                                />
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {THRESHOLD_PRESETS.map(preset => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setThreshold(String(preset))}
                                        className="text-xs font-medium rounded-full border px-2.5 py-1 hover:bg-muted transition-colors"
                                    >
                                        {money.format(preset)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
                    <p className="font-semibold text-foreground mb-1">Cómo lo verá el cliente</p>
                    {freeEnabled && thresholdValue > 0 ? (
                        <>
                            <p className="text-muted-foreground">
                                Compra de {money.format(thresholdValue)} o más → <strong className="text-emerald-600">envío gratis</strong>.
                            </p>
                            <p className="text-muted-foreground">
                                Bajo ese monto → {money.format(feeValue)} de despacho.
                            </p>
                        </>
                    ) : (
                        <p className="text-muted-foreground">
                            Todos los pedidos con despacho pagan {money.format(feeValue)}.
                        </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                        El monto se compara con el total de productos ya con descuentos y cupones aplicados.
                    </p>
                </div>

                <Button onClick={handleSave} disabled={loading || saving}>
                    {saving ? "Guardando..." : "Guardar condiciones"}
                </Button>
            </CardContent>
        </Card>
    );
}
