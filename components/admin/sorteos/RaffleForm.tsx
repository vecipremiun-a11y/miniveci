"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Prize {
    id?: string;
    position: number;
    name: string;
    description?: string | null;
}

export type RaffleType = "free" | "paid" | "in_store";

export interface RaffleFormInitial {
    id?: string;
    name: string;
    slug?: string;
    description?: string | null;
    type: RaffleType;
    price?: number | null;
    audience: "all" | "customers" | "subscribers";
    totalNumbers: number;
    status: "draft" | "active" | "closed" | "drawn";
    startsAt?: string | null;
    endsAt?: string | null;
    drawAt?: string | null;
    terms?: string | null;
    featured?: boolean;
    prizes?: Prize[];
    hasEntries?: boolean;
}

const DEFAULT: RaffleFormInitial = {
    name: "",
    description: "",
    type: "paid",
    price: 1000,
    audience: "all",
    totalNumbers: 50,
    status: "draft",
    featured: false,
    prizes: [{ position: 1, name: "" }],
};

function toLocalInput(iso: string | null | undefined): string {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
        return "";
    }
}

export function RaffleForm({ initial, mode }: { initial?: RaffleFormInitial; mode: "create" | "edit" }) {
    const router = useRouter();
    const init = initial ?? DEFAULT;
    const [form, setForm] = useState<RaffleFormInitial>({
        ...init,
        startsAt: toLocalInput(init.startsAt),
        endsAt: toLocalInput(init.endsAt),
        drawAt: toLocalInput(init.drawAt),
        prizes: init.prizes && init.prizes.length > 0 ? init.prizes : [{ position: 1, name: "" }],
    });
    const [saving, setSaving] = useState(false);
    const hasEntries = !!initial?.hasEntries;

    function update<K extends keyof RaffleFormInitial>(key: K, value: RaffleFormInitial[K]) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    function updatePrize(idx: number, patch: Partial<Prize>) {
        setForm((f) => ({
            ...f,
            prizes: (f.prizes ?? []).map((p, i) => (i === idx ? { ...p, ...patch } : p)),
        }));
    }

    function addPrize() {
        setForm((f) => ({
            ...f,
            prizes: [...(f.prizes ?? []), { position: (f.prizes?.length ?? 0) + 1, name: "" }],
        }));
    }

    function removePrize(idx: number) {
        setForm((f) => ({
            ...f,
            prizes: (f.prizes ?? []).filter((_, i) => i !== idx).map((p, i) => ({ ...p, position: i + 1 })),
        }));
    }

    async function handleSubmit() {
        if (!form.name.trim()) {
            toast.error("El nombre es requerido");
            return;
        }
        if (form.type === "paid" && (!form.price || form.price <= 0)) {
            toast.error("Los sorteos pagados requieren precio > 0");
            return;
        }
        const prizes = (form.prizes ?? []).filter((p) => p.name.trim());
        if (prizes.length === 0) {
            toast.error("Debe haber al menos un premio");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                description: form.description?.trim() || null,
                type: form.type,
                price: form.type === "paid" ? Number(form.price) : null,
                audience: form.audience,
                totalNumbers: Number(form.totalNumbers),
                status: form.status,
                startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
                endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
                drawAt: form.drawAt ? new Date(form.drawAt).toISOString() : null,
                terms: form.terms?.trim() || null,
                featured: !!form.featured,
                prizes: prizes.map((p, i) => ({ ...p, position: i + 1 })),
            };

            const url = mode === "create" ? "/api/admin/raffles" : `/api/admin/raffles/${initial!.id}`;
            const method = mode === "create" ? "POST" : "PUT";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Error al guardar el sorteo");
                return;
            }

            toast.success(mode === "create" ? "Sorteo creado" : "Cambios guardados");
            const id = mode === "create" ? data.id : initial!.id;
            if (mode === "create") {
                router.push(`/admin/sorteos/${id}`);
                router.refresh();
            } else {
                router.refresh();
            }
        } catch (e) {
            toast.error("Error de conexión");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Datos del sorteo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Nombre *</Label>
                            <Input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="Ej: Sorteo iPhone 15" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Tipo *</Label>
                            <Select value={form.type} onValueChange={(v) => update("type", v as any)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="paid">Pagado (online)</SelectItem>
                                    <SelectItem value="free">Gratis (online)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {form.type === "paid" && (
                            <div className="space-y-1.5">
                                <Label>Precio por número (CLP) *</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={form.price ?? ""}
                                    onChange={(e) => update("price", e.target.value === "" ? null : Number(e.target.value))}
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label>Total de números *</Label>
                            <Input
                                type="number"
                                min={1}
                                max={9999}
                                value={form.totalNumbers}
                                disabled={hasEntries}
                                onChange={(e) => update("totalNumbers", Number(e.target.value))}
                            />
                            {hasEntries && (
                                <p className="text-xs text-muted-foreground">No se puede cambiar con participantes activos.</p>
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label>Audiencia</Label>
                            <Select value={form.audience} onValueChange={(v) => update("audience", v as any)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos</SelectItem>
                                    <SelectItem value="customers">Solo clientes registrados</SelectItem>
                                    <SelectItem value="subscribers">Solo suscriptores</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Estado</Label>
                            <Select value={form.status} onValueChange={(v) => update("status", v as any)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="draft">Borrador</SelectItem>
                                    <SelectItem value="active">Activo</SelectItem>
                                    <SelectItem value="closed">Cerrado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Descripción</Label>
                        <Textarea
                            rows={3}
                            value={form.description ?? ""}
                            onChange={(e) => update("description", e.target.value)}
                            placeholder="Describe brevemente el sorteo"
                        />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                            <Label>Inicio</Label>
                            <Input type="datetime-local" value={form.startsAt ?? ""} onChange={(e) => update("startsAt", e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Cierre de venta</Label>
                            <Input type="datetime-local" value={form.endsAt ?? ""} onChange={(e) => update("endsAt", e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Fecha de sorteo</Label>
                            <Input type="datetime-local" value={form.drawAt ?? ""} onChange={(e) => update("drawAt", e.target.value)} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label>Términos y condiciones (opcional)</Label>
                        <Textarea rows={3} value={form.terms ?? ""} onChange={(e) => update("terms", e.target.value)} />
                    </div>

                    <div className="flex items-center gap-3">
                        <Switch checked={!!form.featured} onCheckedChange={(v) => update("featured", v)} />
                        <span className="text-sm">Destacar en home</span>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Premios</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={addPrize}>
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        Agregar premio
                    </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                    {(form.prizes ?? []).map((p, idx) => (
                        <div key={idx} className="flex gap-2 items-start">
                            <div className="flex-shrink-0 w-12 pt-2 text-sm font-bold text-veci-primary">
                                {p.position}°
                            </div>
                            <div className="flex-1 grid gap-2 sm:grid-cols-[1fr_2fr]">
                                <Input
                                    placeholder="Nombre del premio"
                                    value={p.name}
                                    onChange={(e) => updatePrize(idx, { name: e.target.value })}
                                />
                                <Input
                                    placeholder="Descripción (opcional)"
                                    value={p.description ?? ""}
                                    onChange={(e) => updatePrize(idx, { description: e.target.value })}
                                />
                            </div>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removePrize(idx)}
                                disabled={(form.prizes ?? []).length === 1}
                            >
                                <Trash2 className="h-4 w-4 text-rose-500" />
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => router.back()} disabled={saving}>
                    Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar
                </Button>
            </div>
        </div>
    );
}
