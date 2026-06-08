"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save, Trophy, Users, ExternalLink, Download, Dices, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    RAFFLE_ENTRY_FIELD_META,
    DEFAULT_RAFFLE_ENTRY_FIELDS,
    type RaffleEntryFields,
    type RaffleEntryFieldKey,
} from "@/lib/raffle-entry-fields";

// Colores con buen contraste sobre la tarjeta blanca: verde = activado, gris = apagado.
const SWITCH_CLASS =
    "data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-300";

interface Participant {
    id: string;
    number: number;
    name: string | null;
    phone: string | null;
    rut: string | null;
    email: string | null;
    address: string | null;
    receiptNumber: string | null;
    createdAt: string | null;
}

export default function AdminSorteoTemporadaPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [active, setActive] = useState(true);
    const [drawAt, setDrawAt] = useState("");
    const [coverImage, setCoverImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [entryFields, setEntryFields] = useState<RaffleEntryFields>({ ...DEFAULT_RAFFLE_ENTRY_FIELDS });
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [winner, setWinner] = useState<Participant | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    async function load() {
        try {
            const res = await fetch("/api/admin/raffles/temporada");
            const data = await res.json();
            if (data.raffle) {
                setName(data.raffle.name ?? "");
                setActive(data.raffle.status === "active");
                setDrawAt(data.raffle.drawAt ? String(data.raffle.drawAt).slice(0, 16) : "");
                setCoverImage(data.raffle.coverImage ?? null);
                setEntryFields(data.raffle.entryFields ?? { ...DEFAULT_RAFFLE_ENTRY_FIELDS });
            }
            setParticipants(data.participants ?? []);
        } catch {
            toast.error("Error al cargar el sorteo de temporada");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const activeFields = useMemo(
        () => RAFFLE_ENTRY_FIELD_META.filter((f) => entryFields[f.key]),
        [entryFields]
    );

    function toggleField(key: RaffleEntryFieldKey, value: boolean) {
        setEntryFields((prev) => ({ ...prev, [key]: value }));
    }

    async function handleUploadCover(file: File) {
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/admin/raffles/temporada/cover", { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "No se pudo subir la imagen");
                return;
            }
            setCoverImage(data.url);
            toast.success("Imagen subida. Recuerda Guardar para aplicarla.");
        } catch {
            toast.error("Error al subir la imagen");
        } finally {
            setUploading(false);
        }
    }

    async function handleSave() {
        if (!name.trim()) {
            toast.error("Ponle un nombre al sorteo");
            return;
        }
        if (!Object.values(entryFields).some(Boolean)) {
            toast.error("Marca al menos un campo de inscripción");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch("/api/admin/raffles/temporada", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    status: active ? "active" : "closed",
                    drawAt: drawAt ? new Date(drawAt).toISOString() : null,
                    coverImage,
                    entryFields,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "No se pudo guardar");
                return;
            }
            toast.success("Sorteo de temporada guardado");
            load();
        } catch {
            toast.error("Error de conexión");
        } finally {
            setSaving(false);
        }
    }

    function drawRandom() {
        if (participants.length === 0) {
            toast.error("Aún no hay participantes");
            return;
        }
        const pick = participants[Math.floor(Math.random() * participants.length)];
        setWinner(pick);
    }

    function exportCsv() {
        if (participants.length === 0) {
            toast.error("No hay participantes para exportar");
            return;
        }
        const cols = ["N°", ...activeFields.map((f) => f.label), "Fecha"];
        const rows = participants.map((p) => [
            p.number,
            ...activeFields.map((f) => (p[f.key as keyof Participant] ?? "") as string),
            p.createdAt ? new Date(p.createdAt).toLocaleString("es-CL") : "",
        ]);
        const csv = [cols, ...rows]
            .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
            .join("\n");
        const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `participantes-temporada.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 max-w-5xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Trophy className="h-6 w-6 text-amber-500" />
                        Sorteo de temporada
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Configura qué datos pide la inscripción y revisa los participantes registrados.
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link href="/sorteos/temporada" target="_blank">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ver página pública
                    </Link>
                </Button>
            </div>

            {/* Configuración */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Configuración</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Nombre del sorteo *</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Sorteo de Fiestas Patrias" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Fecha del sorteo (opcional)</Label>
                            <Input type="datetime-local" value={drawAt} onChange={(e) => setDrawAt(e.target.value)} />
                        </div>
                    </div>

                    <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 cursor-pointer">
                        <div>
                            <p className="text-sm font-medium">Sorteo activo</p>
                            <p className="text-[11px] text-muted-foreground">
                                Si está activo, la página pública muestra el formulario. Si no, muestra “No hay sorteo activo”.
                            </p>
                        </div>
                        <Switch checked={active} onCheckedChange={setActive} className={SWITCH_CLASS} />
                    </label>

                    {/* Imagen de fondo de la página pública */}
                    <div className="space-y-1.5">
                        <Label>Imagen de fondo (opcional)</Label>
                        <p className="text-[11px] text-muted-foreground">
                            Se muestra detrás del formulario en la página pública, reemplazando el fondo de color. Recomendado: vertical/horizontal de buena resolución, máx 5MB.
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/avif"
                            className="hidden"
                            onChange={(e) => {
                                if (e.target.files?.[0]) handleUploadCover(e.target.files[0]);
                                e.target.value = "";
                            }}
                        />
                        {coverImage ? (
                            <div className="relative w-full max-w-sm overflow-hidden rounded-xl border">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={coverImage} alt="Fondo del sorteo" className="h-40 w-full object-cover" />
                                <div className="absolute bottom-2 right-2 flex gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploading}
                                    >
                                        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                                        <span className="ml-1.5">Cambiar</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => setCoverImage(null)}
                                        disabled={uploading}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        <span className="ml-1.5">Quitar</span>
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="flex w-full max-w-sm flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:bg-muted/50 disabled:opacity-60"
                            >
                                {uploading ? (
                                    <Loader2 className="h-6 w-6 animate-spin" />
                                ) : (
                                    <ImagePlus className="h-6 w-6" />
                                )}
                                <span>{uploading ? "Subiendo…" : "Subir imagen de fondo"}</span>
                            </button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Campos de inscripción */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Campos que pide la inscripción</CardTitle>
                    <p className="text-xs text-muted-foreground">
                        Marca los datos que el cliente debe completar. Los campos marcados se muestran y son obligatorios.
                    </p>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                    {RAFFLE_ENTRY_FIELD_META.map((field) => (
                        <label
                            key={field.key}
                            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-medium">{field.label}</p>
                                {field.hint && <p className="text-[11px] text-muted-foreground">{field.hint}</p>}
                            </div>
                            <Switch checked={entryFields[field.key]} onCheckedChange={(v) => toggleField(field.key, v)} className={SWITCH_CLASS} />
                        </label>
                    ))}
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar
                </Button>
            </div>

            {/* Participantes */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Participantes
                        <Badge variant="secondary">{participants.length}</Badge>
                    </CardTitle>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={exportCsv} disabled={participants.length === 0}>
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Exportar CSV
                        </Button>
                        <Button size="sm" onClick={drawRandom} disabled={participants.length === 0}>
                            <Dices className="mr-1.5 h-3.5 w-3.5" />
                            Sortear al azar
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {winner && (
                        <div className="mb-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-center">
                            <p className="text-xs uppercase tracking-wider font-bold text-amber-600">🎉 Ganador al azar</p>
                            <p className="text-2xl font-black text-slate-900 mt-1">
                                N° {winner.number} · {winner.name ?? "—"}
                            </p>
                            <p className="text-sm text-slate-600">
                                {[winner.phone, winner.receiptNumber && `Boleta ${winner.receiptNumber}`].filter(Boolean).join(" · ")}
                            </p>
                        </div>
                    )}

                    {participants.length === 0 ? (
                        <div className="py-10 text-center text-sm text-muted-foreground">
                            Aún no hay participantes inscritos.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                                        <th className="py-2 pr-3 font-semibold">N°</th>
                                        {activeFields.map((f) => (
                                            <th key={f.key} className="py-2 pr-3 font-semibold">{f.label}</th>
                                        ))}
                                        <th className="py-2 pr-3 font-semibold">Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {participants.map((p) => (
                                        <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                                            <td className="py-2 pr-3 font-bold text-veci-primary">{p.number}</td>
                                            {activeFields.map((f) => (
                                                <td key={f.key} className="py-2 pr-3">
                                                    {(p[f.key as keyof Participant] as string) || "—"}
                                                </td>
                                            ))}
                                            <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                                                {p.createdAt ? new Date(p.createdAt).toLocaleDateString("es-CL") : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
