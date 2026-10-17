"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Box, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/admin/ui/ConfirmDialog";
import {
    assembledCount,
    MAX_PRESENTATION_NAME,
    presentationPriceSuggestions,
    validatePresentation,
} from "@/lib/product-presentations";

/** Fila de product_presentations tal como la devuelve la API del admin. */
export interface AdminPresentation {
    id: string;
    source: string;
    posPresentationId: string | null;
    name: string;
    units: number;
    price: number;
    barcode: string | null;
    isActive: boolean;
    hiddenInStore: boolean;
}

interface Props {
    productId: string;
    initialPresentations: AdminPresentation[];
    /** Stock del producto en unidades (para "N armadas"). */
    stock: number;
    /** Precio de la unidad suelta, para mostrar cuánto ahorra el cliente. */
    unitPrice: number;
}

const fmt = (value: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);

const NAME_PRESETS = ["Caja", "Bandeja", "Pack", "Display"];

type Draft = {
    id: string | null;
    name: string;
    units: string;
    price: string;
    barcode: string;
    isActive: boolean;
    hiddenInStore: boolean;
};

const EMPTY_DRAFT: Draft = { id: null, name: "", units: "", price: "", barcode: "", isActive: true, hiddenInStore: false };

function sortList(list: AdminPresentation[]) {
    return [...list].sort((a, b) => a.units - b.units || a.name.localeCompare(b.name, "es"));
}

/**
 * Sección "Unidades de medida" del producto (Caja, Bandeja, Pack…), como en el
 * POS. El stock sigue en unidades: una caja de 30 descuenta 30.
 *
 * - Las propias (creadas acá) se crean, editan, activan y borran.
 * - Las que vienen del POS no se editan (el próximo sync las pisaría): solo se
 *   pueden ocultar de la tienda.
 * Cada cambio se guarda al tiro contra su API (no espera "Actualizar Producto").
 */
export function ProductPresentations({ productId, initialPresentations, stock, unitPrice }: Props) {
    const [list, setList] = useState<AdminPresentation[]>(() => sortList(initialPresentations));
    const [draft, setDraft] = useState<Draft | null>(null);
    const [saving, setSaving] = useState(false);
    const [serverError, setServerError] = useState<{ error: string; suggestions?: number[] } | null>(null);
    const [toDelete, setToDelete] = useState<AdminPresentation | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => { setServerError(null); }, [draft?.price, draft?.units]);

    const modalOpen = draft !== null;
    useEffect(() => {
        if (!modalOpen) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) setDraft(null); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [modalOpen, saving]);

    const openNew = () => { setServerError(null); setDraft({ ...EMPTY_DRAFT }); };
    const openEdit = (p: AdminPresentation) => {
        setServerError(null);
        setDraft({
            id: p.id,
            name: p.name,
            units: String(p.units),
            price: String(p.price),
            barcode: p.barcode ?? "",
            isActive: p.isActive,
            hiddenInStore: p.hiddenInStore,
        });
    };

    const replaceRow = (row: AdminPresentation) =>
        setList((prev) => sortList(prev.some((p) => p.id === row.id) ? prev.map((p) => (p.id === row.id ? row : p)) : [...prev, row]));

    const check = draft ? validatePresentation({
        name: draft.name,
        units: draft.units === "" ? NaN : Number(draft.units),
        price: draft.price === "" ? NaN : Number(draft.price),
        barcode: draft.barcode,
    }) : null;

    const save = async () => {
        if (!draft || !check) return;
        if (!check.ok) {
            setServerError({ error: check.error, suggestions: check.suggestions });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(
                draft.id ? `/api/admin/products/${productId}/presentations/${draft.id}` : `/api/admin/products/${productId}/presentations`,
                {
                    method: draft.id ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...check.value, isActive: draft.isActive, hiddenInStore: draft.hiddenInStore }),
                },
            );
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setServerError({ error: data.error || "No se pudo guardar", suggestions: data.suggestions });
                return;
            }
            replaceRow(data.presentation);
            toast.success(draft.id ? "Unidad de medida actualizada" : "Unidad de medida agregada");
            setDraft(null);
        } catch {
            setServerError({ error: "Error de conexión. Intenta de nuevo." });
        } finally {
            setSaving(false);
        }
    };

    const toggleVisible = async (p: AdminPresentation, visible: boolean) => {
        setBusyId(p.id);
        try {
            const res = await fetch(`/api/admin/products/${productId}/presentations/${p.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ hiddenInStore: !visible }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "No se pudo guardar");
            replaceRow(data.presentation);
            toast.success(visible ? `${p.name} se muestra en la tienda` : `${p.name} quedó oculta en la tienda`);
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (p: AdminPresentation) => {
        setBusyId(p.id);
        try {
            const res = await fetch(`/api/admin/products/${productId}/presentations/${p.id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "No se pudo borrar");
            setList((prev) => prev.filter((x) => x.id !== p.id));
            toast.success(`${p.name} borrada`);
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setBusyId(null);
        }
    };

    // Ayudas en vivo del formulario.
    const draftUnits = draft ? Number(draft.units) : NaN;
    const draftPrice = draft ? Number(draft.price) : NaN;
    const unitsOk = Number.isInteger(draftUnits) && draftUnits >= 2;
    const priceOk = Number.isInteger(draftPrice) && draftPrice > 0;
    const divides = unitsOk && priceOk && draftPrice % draftUnits === 0;
    const suggestions = unitsOk && priceOk && !divides ? presentationPriceSuggestions(draftPrice, draftUnits) : [];
    const looseTotal = unitsOk && unitPrice > 0 ? unitPrice * draftUnits : 0;
    const customerSaves = divides && looseTotal > draftPrice ? looseTotal - draftPrice : 0;

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Box className="h-4 w-4 text-blue-600" /> Unidades de medida
                </CardTitle>
                <CardDescription>
                    Se vende por unidad. Agrega una caja, bandeja o pack para venderlo también así: en la tienda el
                    cliente elige si lleva unidades sueltas o la caja entera, y el stock se descuenta en unidades.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {list.map((p) => {
                    const fromPos = p.source === "pos";
                    const armadas = assembledCount(stock, p.units);
                    const visible = !p.hiddenInStore;
                    return (
                        <div key={p.id} className={`rounded-xl border p-3 sm:p-4 ${p.isActive && visible ? "bg-white" : "bg-slate-50"}`}>
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="font-bold text-slate-900">{p.name}</span>
                                        <span className="text-slate-600">· {p.units} und</span>
                                        {fromPos && (
                                            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-700">Del POS</span>
                                        )}
                                        {!p.isActive && (
                                            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-600">Inactiva</span>
                                        )}
                                        {p.isActive && !visible && (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">Oculta en la tienda</span>
                                        )}
                                    </div>
                                    <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                                        {fmt(p.price)} · {fmt(p.price / p.units)} c/u
                                        {p.barcode ? ` · ${p.barcode}` : ""} · {armadas} {armadas === 1 ? "armada" : "armadas"}
                                    </p>
                                </div>
                                {!fromPos && (
                                    <div className="flex shrink-0 items-center gap-1">
                                        <Button type="button" variant="outline" className="h-10 px-3" onClick={() => openEdit(p)} disabled={busyId === p.id}>
                                            <Pencil className="h-4 w-4 sm:mr-1.5" />
                                            <span className="hidden sm:inline">Editar</span>
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="h-10 w-10 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                            onClick={() => setToDelete(p)}
                                            disabled={busyId === p.id}
                                            aria-label={`Borrar ${p.name}`}
                                        >
                                            {busyId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                )}
                            </div>
                            {fromPos && (
                                <div className="mt-3 flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                                    <p className="text-xs text-slate-500">Para cambiarla, edítala en el POS.</p>
                                    <label className="flex min-h-10 items-center justify-between gap-3 text-sm font-medium text-slate-700 sm:justify-end">
                                        Mostrar en la tienda
                                        <Switch
                                            checked={visible}
                                            disabled={busyId === p.id}
                                            onCheckedChange={(on) => toggleVisible(p, on)}
                                        />
                                    </label>
                                </div>
                            )}
                        </div>
                    );
                })}

                <button
                    type="button"
                    onClick={openNew}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-blue-300 text-sm font-bold text-blue-600 transition-colors hover:border-blue-400 hover:bg-blue-50"
                >
                    <Plus className="h-4 w-4" /> Agregar unidad de medida
                </button>
            </CardContent>

            {/* En un portal: el formulario del producto envuelve esta sección y
                no puede haber un <form> dentro de otro. */}
            {draft && createPortal(
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => !saving && setDraft(null)}>
                    <form
                        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={(e) => {
                            // Este formulario vive dentro del del producto: que no lo dispare.
                            e.preventDefault();
                            e.stopPropagation();
                            save();
                        }}
                    >
                        <div className="flex items-center justify-between border-b px-4 py-3">
                            <h3 className="text-base font-bold">{draft.id ? "Editar unidad de medida" : "Nueva unidad de medida"}</h3>
                            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100" onClick={() => setDraft(null)} aria-label="Cerrar">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold" htmlFor="pres-name">Nombre</label>
                                <Input
                                    id="pres-name"
                                    className="h-11 text-base"
                                    placeholder="Ej: Caja"
                                    maxLength={MAX_PRESENTATION_NAME}
                                    value={draft.name}
                                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                                    autoFocus={!draft.id}
                                />
                                <div className="flex flex-wrap gap-1.5">
                                    {NAME_PRESETS.map((name) => (
                                        <button
                                            key={name}
                                            type="button"
                                            onClick={() => setDraft({ ...draft, name })}
                                            className={`h-9 rounded-full border px-3 text-sm font-medium ${draft.name === name ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                                        >
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold" htmlFor="pres-units">Unidades que trae</label>
                                    <Input
                                        id="pres-units"
                                        type="number"
                                        inputMode="numeric"
                                        min={2}
                                        step={1}
                                        className="h-11 text-base"
                                        placeholder="Ej: 30"
                                        value={draft.units}
                                        onChange={(e) => setDraft({ ...draft, units: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-semibold" htmlFor="pres-price">Precio de la {draft.name.trim() || "caja"}</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                        <Input
                                            id="pres-price"
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            step={1}
                                            className="h-11 pl-7 text-base"
                                            placeholder="Ej: 7500"
                                            value={draft.price}
                                            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {divides && (
                                <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                    Sale a <b>{fmt(draftPrice / draftUnits)}</b> cada unidad.
                                    {customerSaves > 0 && <> Sueltas serían {fmt(looseTotal)}: el cliente ahorra <b>{fmt(customerSaves)}</b> ({Math.round((customerSaves / looseTotal) * 100)}%).</>}
                                    {looseTotal > 0 && draftPrice > looseTotal && <> Ojo: sale más caro que {draftUnits} sueltas ({fmt(looseTotal)}).</>}
                                </div>
                            )}
                            {suggestions.length > 0 && (
                                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                    <p>
                                        {fmt(draftPrice)} no se divide exacto en {draftUnits} unidades, y la boleta (que va en unidades) no
                                        cuadraría con lo cobrado. Usa uno de estos:
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {suggestions.map((s) => (
                                            <Button key={s} type="button" variant="outline" className="h-10 bg-white" onClick={() => setDraft({ ...draft, price: String(s) })}>
                                                Usar {fmt(s)} <span className="ml-1 text-xs text-slate-500">({fmt(s / draftUnits)} c/u)</span>
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold" htmlFor="pres-barcode">Código de barras <span className="font-normal text-slate-400">(opcional)</span></label>
                                <Input
                                    id="pres-barcode"
                                    className="h-11 text-base"
                                    inputMode="numeric"
                                    placeholder="El de la caja, si tiene"
                                    value={draft.barcode}
                                    onChange={(e) => setDraft({ ...draft, barcode: e.target.value })}
                                />
                            </div>

                            <div className="divide-y rounded-xl border">
                                <label className="flex min-h-12 items-center justify-between gap-3 px-3 py-2 text-sm">
                                    <span>
                                        <span className="block font-semibold">Activa</span>
                                        <span className="text-xs text-slate-500">Apagada, no se vende</span>
                                    </span>
                                    <Switch checked={draft.isActive} onCheckedChange={(on) => setDraft({ ...draft, isActive: on })} />
                                </label>
                                <label className="flex min-h-12 items-center justify-between gap-3 px-3 py-2 text-sm">
                                    <span>
                                        <span className="block font-semibold">Mostrar en la tienda</span>
                                        <span className="text-xs text-slate-500">Web y app</span>
                                    </span>
                                    <Switch checked={!draft.hiddenInStore} onCheckedChange={(on) => setDraft({ ...draft, hiddenInStore: !on })} />
                                </label>
                            </div>

                            {serverError && !(suggestions.length > 0 && serverError.suggestions) && (
                                <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{serverError.error}</p>
                            )}
                        </div>

                        <div className="flex gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                            <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => setDraft(null)} disabled={saving}>
                                Cancelar
                            </Button>
                            <Button type="submit" className="h-12 flex-1" disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar
                            </Button>
                        </div>
                    </form>
                </div>,
                document.body,
            )}

            <ConfirmDialog
                open={toDelete !== null}
                onOpenChange={(open) => { if (!open) setToDelete(null); }}
                title={`¿Borrar ${toDelete?.name ?? ""}?`}
                message="Deja de venderse en la tienda. Los pedidos que ya la llevan no cambian."
                confirmLabel="Borrar"
                onConfirm={() => { if (toDelete) remove(toDelete); }}
            />
        </Card>
    );
}
