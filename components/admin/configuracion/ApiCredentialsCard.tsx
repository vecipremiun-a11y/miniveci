"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ApiCredentialsCard() {
    const [clientId, setClientId] = useState("");
    const [clientSecret, setClientSecret] = useState("");
    const [posWebhookUrl, setPosWebhookUrl] = useState("");
    const [webhookSecret, setWebhookSecret] = useState("");
    const [loading, setLoading] = useState(true);
    const [savingUrl, setSavingUrl] = useState(false);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                const response = await fetch("/api/admin/settings/api-credentials", { cache: "no-store" });
                if (!response.ok) {
                    throw new Error("No se pudo cargar la configuración");
                }

                const data = await response.json();
                if (!mounted) return;

                setClientId(data.clientId || "");
                setPosWebhookUrl(data.posWebhookUrl || "");
                setWebhookSecret(data.webhookSecret || "");
            } catch (error: any) {
                toast.error(error?.message || "Error al cargar credenciales");
            } finally {
                if (mounted) setLoading(false);
            }
        }

        load();
        return () => { mounted = false; };
    }, []);

    async function handleGenerateKeys() {
        setGenerating(true);
        try {
            const response = await fetch("/api/admin/settings/api-credentials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ regenerate: true }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || "No se pudieron generar las llaves");
            }

            setClientId(data.clientId || "");
            setClientSecret(data.generatedClientSecret || "");
            toast.success("Llaves generadas correctamente");
        } catch (error: any) {
            toast.error(error?.message || "Error al generar llaves");
        } finally {
            setGenerating(false);
        }
    }

    async function handleSaveWebhookSettings() {
        setSavingUrl(true);
        try {
            const response = await fetch("/api/admin/settings/api-credentials", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ posWebhookUrl, webhookSecret }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || "No se pudo guardar la URL");
            }

            setPosWebhookUrl(data.posWebhookUrl || posWebhookUrl);
            setWebhookSecret(data.webhookSecret || webhookSecret);
            toast.success("Configuración de webhook guardada");
        } catch (error: any) {
            toast.error(error?.message || "Error guardando URL");
        } finally {
            setSavingUrl(false);
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Integración POS</CardTitle>
                <CardDescription>Genera llaves API y configura la URL webhook de tu POS.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="client-id">Client ID</Label>
                    <Input id="client-id" value={clientId} readOnly placeholder="Genera llaves para obtener un client_id" />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="client-secret">Client Secret (solo visible al generarlo)</Label>
                    <Input id="client-secret" value={clientSecret} readOnly placeholder="Se muestra una sola vez por seguridad" />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="pos-webhook-url">POS Webhook URL</Label>
                    <Input
                        id="pos-webhook-url"
                        type="url"
                        value={posWebhookUrl}
                        onChange={(event) => setPosWebhookUrl(event.target.value)}
                        placeholder="https://tu-pos.com/webhook/ventas"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="webhook-secret">Webhook Secret</Label>
                    <Input
                        id="webhook-secret"
                        value={webhookSecret}
                        onChange={(event) => setWebhookSecret(event.target.value)}
                        placeholder="Ingresa el secreto compartido del webhook"
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button onClick={handleGenerateKeys} disabled={loading || generating}>
                        {generating ? "Generando..." : "Generar llaves"}
                    </Button>
                    <Button variant="outline" onClick={handleSaveWebhookSettings} disabled={loading || savingUrl}>
                        {savingUrl ? "Guardando..." : "Guardar webhook"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
