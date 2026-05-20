"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
    ArrowLeft, Cookie, Loader2, Save, Image as ImageIcon, Sparkles,
    AlertCircle, Calculator, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bakeryProductSchema, BAKERY_CATEGORIES, type BakeryCategory } from "@/lib/validations/bakery";
import { BAKERY_CATEGORY_LABELS, calcBakeryItemSubtotal, formatCLP, formatKg } from "@/lib/bakery-shared";

type FormValues = z.infer<typeof bakeryProductSchema>;

export interface BakeryProductFormProps {
    mode: "create" | "edit";
    initialData?: {
        id: string;
        name: string;
        description: string | null;
        imageUrl: string | null;
        category: BakeryCategory;
        pricingMode: "unit" | "kg";
        price: number;
        gramsPerUnit: number | null;
        allowsNotes: boolean;
        active: boolean;
        sortOrder: number;
    };
}

export function BakeryProductForm({ mode, initialData }: BakeryProductFormProps) {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [simQty, setSimQty] = useState(10);

    const form = useForm<FormValues>({
        resolver: zodResolver(bakeryProductSchema) as Resolver<FormValues>,
        defaultValues: {
            name: initialData?.name ?? "",
            description: initialData?.description ?? "",
            imageUrl: initialData?.imageUrl ?? "",
            category: (initialData?.category as BakeryCategory) ?? "pan",
            pricingMode: initialData?.pricingMode ?? "unit",
            price: initialData?.price ?? 0,
            gramsPerUnit: initialData?.gramsPerUnit ?? null,
            allowsNotes: initialData?.allowsNotes ?? false,
            active: initialData?.active ?? true,
            sortOrder: initialData?.sortOrder ?? 0,
        },
    });

    const pricingMode = form.watch("pricingMode");
    const price = form.watch("price") || 0;
    const gramsPerUnit = form.watch("gramsPerUnit") || null;
    const imageUrl = form.watch("imageUrl");
    const active = form.watch("active");

    // Auto-clear gramsPerUnit when switching to "unit"
    const setPricingMode = (mode: "unit" | "kg") => {
        form.setValue("pricingMode", mode, { shouldValidate: false });
        if (mode === "unit") form.setValue("gramsPerUnit", null);
    };

    const simSubtotal = useMemo(
        () => calcBakeryItemSubtotal({ pricingMode, price, gramsPerUnit }, simQty),
        [pricingMode, price, gramsPerUnit, simQty],
    );
    const simGrams = pricingMode === "kg" && gramsPerUnit ? simQty * gramsPerUnit : null;

    async function onSubmit(values: FormValues) {
        setSubmitting(true);
        try {
            // Normaliza valores antes de mandar
            const payload = {
                ...values,
                name: values.name.trim(),
                description: values.description?.trim() || null,
                imageUrl: values.imageUrl?.trim() || null,
                gramsPerUnit: values.pricingMode === "kg" ? values.gramsPerUnit : null,
            };

            const url = mode === "create"
                ? "/api/admin/bakery/products"
                : `/api/admin/bakery/products/${initialData!.id}`;
            const method = mode === "create" ? "POST" : "PATCH";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.message || "Error al guardar");
                return;
            }

            toast.success(mode === "create" ? "Producto creado" : "Cambios guardados");
            router.push("/admin/catalogo?tab=amasanderia");
            router.refresh();
        } catch {
            toast.error("Error de conexión");
        } finally {
            setSubmitting(false);
        }
    }

    const { errors } = form.formState;

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">

            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <Link href="/admin/catalogo?tab=amasanderia" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-veci-primary mb-2">
                        <ArrowLeft className="h-4 w-4" /> Volver al catálogo
                    </Link>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Cookie className="h-7 w-7 text-amber-500" />
                        {mode === "create" ? "Nuevo producto de amasandería" : "Editar producto"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {mode === "create"
                            ? "Define cómo aparecerá y se cobrará en la página pública."
                            : initialData?.name}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button asChild variant="outline">
                        <Link href="/admin/catalogo?tab=amasanderia">Cancelar</Link>
                    </Button>
                    <Button type="submit" disabled={submitting}>
                        {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : <><Save className="mr-2 h-4 w-4" /> Guardar</>}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

                {/* LEFT COLUMN */}
                <div className="space-y-5">

                    {/* Información */}
                    <Card title="Información" subtitle="Cómo se muestra al cliente">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field label="Nombre" required error={errors.name?.message}>
                                <Input
                                    placeholder="Ej: Marraqueta"
                                    {...form.register("name")}
                                    maxLength={120}
                                />
                            </Field>
                            <Field label="Categoría" required error={errors.category?.message}>
                                <Select
                                    value={form.watch("category")}
                                    onValueChange={(v) => form.setValue("category", v as BakeryCategory, { shouldValidate: true })}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {BAKERY_CATEGORIES.map((c) => (
                                            <SelectItem key={c} value={c}>{BAKERY_CATEGORY_LABELS[c]}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                        <Field label="Descripción" hint="Opcional · máx. 500 caracteres" error={errors.description?.message}>
                            <Textarea
                                rows={3}
                                placeholder="Pan tradicional chileno, crujiente por fuera y esponjoso por dentro."
                                {...form.register("description")}
                                maxLength={500}
                            />
                        </Field>
                    </Card>

                    {/* Precio y modo de venta */}
                    <Card title="Precio y modo de venta" subtitle="Cómo se cobra al cliente final">

                        <Label className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2 block">
                            Modo de venta
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                            <ModeOption
                                title="Por unidad"
                                description="Precio fijo por cada unidad. Ej: $3.500 por sándwich."
                                selected={pricingMode === "unit"}
                                onClick={() => setPricingMode("unit")}
                            />
                            <ModeOption
                                title="Por kilo"
                                description="Cobras por peso real. El cliente reserva unidades; tú defines cuánto pesa cada una."
                                selected={pricingMode === "kg"}
                                onClick={() => setPricingMode("kg")}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <Field
                                label={pricingMode === "unit" ? "Precio por unidad (CLP)" : "Precio por kilo (CLP)"}
                                required
                                error={errors.price?.message}
                                hint="Solo números enteros."
                            >
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                                    <Input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        step={1}
                                        className="pl-7"
                                        {...form.register("price", { valueAsNumber: true })}
                                    />
                                </div>
                            </Field>
                            {pricingMode === "kg" && (
                                <Field
                                    label="Peso por unidad (gramos)"
                                    required
                                    error={errors.gramsPerUnit?.message}
                                    hint="Ej: marraqueta ≈ 90g · pan completo ≈ 110g"
                                >
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            inputMode="numeric"
                                            min={1}
                                            step={1}
                                            className="pr-10"
                                            {...form.register("gramsPerUnit", { valueAsNumber: true })}
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">g</span>
                                    </div>
                                </Field>
                            )}
                        </div>

                        {/* Preview en vivo */}
                        <div className="mt-5 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/60 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Calculator className="w-4 h-4 text-amber-700" />
                                <Label className="text-xs font-bold uppercase tracking-wide text-amber-700">
                                    Simulación para el cliente
                                </Label>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <Label className="text-sm text-slate-700">Si el cliente pide</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={500}
                                        value={simQty}
                                        onChange={(e) => setSimQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                        className="w-20 h-9 text-center font-bold"
                                    />
                                    <Label className="text-sm text-slate-700">unidad{simQty === 1 ? "" : "es"}</Label>
                                </div>
                            </div>
                            <div className="mt-3 text-sm text-slate-700 bg-white rounded-xl p-3 border border-amber-200">
                                {pricingMode === "unit" ? (
                                    <>
                                        <strong>{simQty}</strong> × {formatCLP(price)} ={" "}
                                        <strong className="text-amber-700 text-base">{formatCLP(simSubtotal)}</strong>
                                    </>
                                ) : !gramsPerUnit || gramsPerUnit <= 0 ? (
                                    <span className="text-slate-400 italic">Ingresa el peso por unidad para ver el cálculo.</span>
                                ) : (
                                    <>
                                        <strong>{simQty}</strong> × <strong>{gramsPerUnit}g</strong> = {formatKg(simGrams!)}{" "}
                                        × {formatCLP(price)}/kg ={" "}
                                        <strong className="text-amber-700 text-base">{formatCLP(simSubtotal)}</strong>
                                    </>
                                )}
                            </div>
                            <p className="text-[11px] text-amber-700 mt-2">
                                <Sparkles className="w-3 h-3 inline mr-1" />
                                Este es el mismo cálculo que ve el cliente en la página y que valida el servidor al confirmar.
                            </p>
                        </div>
                    </Card>

                    {/* Opciones */}
                    <Card title="Opciones">
                        <ToggleRow
                            label="Permitir notas del cliente"
                            description="El cliente podrá agregar indicaciones para este producto en su encargo."
                            checked={form.watch("allowsNotes")}
                            onChange={(v) => form.setValue("allowsNotes", v)}
                        />
                        <ToggleRow
                            label="Visible en amasandería"
                            description="Si lo apagas, no aparece en la página pública pero queda en histórico."
                            checked={active}
                            onChange={(v) => form.setValue("active", v)}
                        />
                        <Field
                            label="Orden"
                            hint="Número más bajo aparece antes. Útil para destacar productos."
                            error={errors.sortOrder?.message}
                        >
                            <Input
                                type="number"
                                step={1}
                                className="w-28"
                                {...form.register("sortOrder", { valueAsNumber: true })}
                            />
                        </Field>
                    </Card>

                </div>

                {/* RIGHT COLUMN */}
                <aside className="space-y-5">

                    {/* Imagen */}
                    <Card title="Imagen" subtitle="URL pública (Vercel Blob / cloud)">
                        <Field label="URL de la imagen" error={errors.imageUrl?.message} hint="Pega un enlace público. Si la dejas vacía se muestra un ícono.">
                            <div className="relative">
                                <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="https://..."
                                    className="pl-9"
                                    {...form.register("imageUrl")}
                                />
                            </div>
                        </Field>
                        <div className="mt-3 aspect-[4/3] rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center overflow-hidden border border-amber-200">
                            {imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={imageUrl} alt="preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                                <Cookie className="w-12 h-12 text-amber-700/40" />
                            )}
                        </div>
                    </Card>

                    {/* Estado preview */}
                    <Card title="Estado">
                        <div className={`rounded-xl px-3 py-2.5 text-sm font-bold flex items-center gap-2 ${active ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                            {active ? <><Eye className="w-4 h-4" /> Visible en /amasanderia</> : <><EyeOff className="w-4 h-4" /> Oculto de /amasanderia</>}
                        </div>
                    </Card>

                </aside>

            </div>

            {/* Mostrar errores de validación si los hay */}
            {Object.keys(errors).length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        <strong>Revisa los campos:</strong>
                        <ul className="list-disc ml-5 mt-1">
                            {Object.entries(errors).map(([k, v]) => (
                                <li key={k}>{(v as any)?.message || k}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

        </form>
    );
}

/* --- Helpers visuales --- */

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <header className="mb-4">
                <h3 className="font-bold text-slate-800">{title}</h3>
                {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </header>
            <div className="space-y-4">{children}</div>
        </section>
    );
}

function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
            </Label>
            {children}
            {error && <p className="text-xs text-rose-600">{error}</p>}
            {!error && hint && <p className="text-[11px] text-slate-500">{hint}</p>}
        </div>
    );
}

function ModeOption({ title, description, selected, onClick }: { title: string; description: string; selected: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`text-left rounded-2xl border-2 p-4 transition ${
                selected
                    ? "border-amber-400 bg-amber-50/60 shadow-sm"
                    : "border-slate-200 bg-white hover:border-amber-300"
            }`}
        >
            <div className="flex items-start gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${selected ? "border-amber-500 bg-white" : "border-slate-300"}`}>
                    {selected && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                </div>
                <div>
                    <p className={`font-bold ${selected ? "text-amber-800" : "text-slate-700"}`}>{title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{description}</p>
                </div>
            </div>
        </button>
    );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-start justify-between gap-4 py-1">
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm">{label}</p>
                <p className="text-xs text-slate-500">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );
}
