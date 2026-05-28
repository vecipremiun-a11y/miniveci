"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    ArrowLeft, Calendar as CalIcon, Clock, Cookie, Loader2, MapPin,
    Minus, Plus, Store, Trash2, Truck, AlertTriangle, NotebookPen,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Footer } from "@/components/Footer";
import { useBakeryCart } from "@/components/bakery-cart/BakeryCartProvider";
import {
    BAKERY_CATEGORY_LABELS, calcBakeryItemSubtotal, formatCLP, formatKg,
} from "@/lib/bakery-shared";
import { SuccessModal } from "./SuccessModal";

interface BakeryConfigDTO {
    minHoursAhead: number;
    maxDaysAhead: number;
    closedWeekdays: number[]; // 1=Lun ... 7=Dom (ISO)
    openHour: number;
    closeHour: number;
    slotMinutes: number;
    offersDelivery: boolean;
    deliveryFee: number;
}

interface ConfirmedOrder {
    publicCode: string;
    scheduledFor: string;
    method: "pickup" | "delivery";
    address: string | null;
    total: number;
}

export default function EncargarPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const { items, totalUnits, subtotal, setQuantity, setNotes, removeItem, clearCart } = useBakeryCart();

    const [config, setConfig] = useState<BakeryConfigDTO | null>(null);
    const [date, setDate] = useState<Date | undefined>();
    const [timeSlot, setTimeSlot] = useState<string | null>(null);
    const [slots, setSlots] = useState<string[]>([]);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [slotsError, setSlotsError] = useState<string | null>(null);
    const [method, setMethod] = useState<"pickup" | "delivery">("pickup");
    const [address, setAddress] = useState("");
    const [generalNotes, setGeneralNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<ConfirmedOrder | null>(null);

    // Load config once
    useEffect(() => {
        fetch("/api/bakery/config")
            .then((r) => r.json())
            .then((c) => setConfig(c))
            .catch(() => {});
    }, []);

    // Anticipación efectiva = máx(general, mayor lead time de los productos del carrito).
    const { cartLeadHours, effMinHours, leadDriver } = useMemo(() => {
        let maxLead = 0;
        let driver: { name: string; hours: number } | null = null;
        for (const it of items) {
            const h = it.leadTimeHours ?? 0;
            if (h > maxLead) { maxLead = h; driver = { name: it.name, hours: h }; }
        }
        const globalMin = config?.minHoursAhead ?? 0;
        return {
            cartLeadHours: maxLead,
            effMinHours: Math.max(globalMin, maxLead),
            leadDriver: maxLead > globalMin ? driver : null,
        };
    }, [items, config]);

    // Load slots when date changes
    useEffect(() => {
        if (!date) { setSlots([]); setSlotsError(null); return; }
        const dateStr = format(date, "yyyy-MM-dd");
        setSlotsLoading(true);
        setSlotsError(null);
        fetch(`/api/bakery/availability?date=${dateStr}&leadHours=${cartLeadHours}`)
            .then(async (r) => {
                const data = await r.json();
                if (!r.ok) {
                    setSlots([]);
                    setSlotsError(data.message || "No hay horarios disponibles para esta fecha");
                    return;
                }
                setSlots(data.slots || []);
                if (!data.slots?.length) setSlotsError("No quedan horarios disponibles para esta fecha");
            })
            .catch(() => setSlotsError("Error al cargar horarios"))
            .finally(() => setSlotsLoading(false));
        setTimeSlot(null);
    }, [date, cartLeadHours]);

    const deliveryFee = useMemo(() => (method === "delivery" && config ? config.deliveryFee : 0), [method, config]);
    const total = subtotal + deliveryFee;

    const dateBoundaries = useMemo(() => {
        if (!config) return null;
        const minDate = new Date();
        minDate.setHours(0, 0, 0, 0);
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + config.maxDaysAhead);
        maxDate.setHours(23, 59, 59, 999);
        return { minDate, maxDate };
    }, [config]);

    const isDayDisabled = (day: Date): boolean => {
        if (!config || !dateBoundaries) return true;
        if (day < dateBoundaries.minDate || day > dateBoundaries.maxDate) return true;
        // ISO weekday: 1=Lun ... 7=Dom
        const jsDay = day.getDay(); // 0=Dom ... 6=Sab
        const iso = jsDay === 0 ? 7 : jsDay;
        if (config.closedWeekdays.includes(iso)) return true;
        // Si el cierre de ese día ya cae antes de la anticipación efectiva, no hay slots → deshabilitar.
        const dayClose = new Date(day);
        dayClose.setHours(config.closeHour, 0, 0, 0);
        if (dayClose.getTime() < Date.now() + effMinHours * 3600 * 1000) return true;
        return false;
    };

    const canSubmit = useMemo(() => {
        if (items.length === 0) return false;
        if (!date || !timeSlot) return false;
        if (method === "delivery" && address.trim().length < 4) return false;
        return true;
    }, [items.length, date, timeSlot, method, address]);

    async function handleSubmit() {
        if (!canSubmit || !date || !timeSlot) return;
        if (status !== "authenticated") {
            router.push(`/login?callbackUrl=${encodeURIComponent("/amasanderia/encargar")}`);
            return;
        }
        setSubmitting(true);
        setError(null);

        const [hh, mm] = timeSlot.split(":").map((s) => parseInt(s, 10));
        const scheduled = new Date(date);
        scheduled.setHours(hh, mm, 0, 0);

        const payload = {
            items: items.map((it) => ({
                productId: it.productId,
                quantity: it.quantity,
                notes: it.notes || undefined,
            })),
            scheduledFor: scheduled.toISOString(),
            method,
            address: method === "delivery" ? address.trim() : undefined,
            generalNotes: generalNotes.trim() || undefined,
        };

        try {
            const res = await fetch("/api/bakery/orders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.message || "No pudimos crear el encargo");
                return;
            }
            setSuccess({
                publicCode: data.publicCode,
                scheduledFor: data.scheduledFor,
                method: data.method,
                address: data.address,
                total: data.total,
            });
            clearCart();
        } catch {
            setError("Error de conexión. Intenta nuevamente.");
        } finally {
            setSubmitting(false);
        }
    }

    // Empty cart redirect option
    if (items.length === 0 && !success) {
        return (
            <main className="min-h-screen bg-veci-bg">
                <div className="h-36 md:h-44" />
                <div className="max-w-2xl mx-auto px-4 sm:px-8 py-10">
                    <div className="bg-white/60 backdrop-blur-md border border-white rounded-3xl p-10 text-center">
                        <div className="w-20 h-20 mx-auto rounded-full bg-amber-50 flex items-center justify-center mb-4">
                            <Cookie className="w-10 h-10 text-amber-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">No hay nada en tu encargo</h1>
                        <p className="text-slate-500 mt-2">Agrega panes o sándwiches para reservar.</p>
                        <Link
                            href="/amasanderia"
                            className="mt-6 inline-flex items-center justify-center px-6 py-3 rounded-full bg-gradient-to-r from-veci-primary to-rose-400 text-white font-bold shadow-md hover:shadow-lg transition"
                        >
                            Explorar amasandería
                        </Link>
                    </div>
                </div>
                <Footer />
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-veci-bg pb-20">

            <div className="h-36 md:h-44" />

            <div className="max-w-5xl mx-auto px-4 sm:px-8">
                <Link href="/amasanderia" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-veci-primary mb-4">
                    <ArrowLeft className="w-4 h-4" />
                    Volver
                </Link>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 mb-1">Confirma tu encargo</h1>
                <p className="text-sm text-slate-500 mb-6">Elige fecha, hora y método de entrega. Pagas al retirar.</p>

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

                    {/* LEFT COLUMN: forms */}
                    <div className="space-y-5">

                        {/* Items list */}
                        <Section title="Productos" subtitle={`${items.length} producto${items.length === 1 ? "" : "s"} · ${totalUnits} unidad${totalUnits === 1 ? "" : "es"}`}>
                            <ul className="space-y-3">
                                {items.map((it) => {
                                    const line = calcBakeryItemSubtotal(
                                        { pricingMode: it.pricingMode, price: it.unitPrice, gramsPerUnit: it.gramsPerUnit },
                                        it.quantity,
                                    );
                                    const grams = it.pricingMode === "kg" && it.gramsPerUnit ? it.quantity * it.gramsPerUnit : null;
                                    return (
                                        <li key={it.productId} className="border border-slate-100 rounded-2xl p-3 sm:p-4 bg-white">
                                            <div className="flex items-start gap-3">
                                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center overflow-hidden shrink-0">
                                                    {it.imageUrl ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={it.imageUrl} alt={it.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <Cookie className="w-7 h-7 text-amber-700/50" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-slate-800 truncate">{it.name}</p>
                                                    <p className="text-[11px] text-slate-500">
                                                        {BAKERY_CATEGORY_LABELS[it.category]} · {it.pricingMode === "unit" ? `${formatCLP(it.unitPrice)} c/u` : `${formatCLP(it.unitPrice)}/kg`}
                                                        {grams != null && <> · ≈ {formatKg(grams)}</>}
                                                    </p>
                                                </div>
                                                <button onClick={() => removeItem(it.productId)} className="text-slate-400 hover:text-rose-500 p-1" aria-label="Quitar">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="mt-3 flex items-center gap-2">
                                                <button onClick={() => setQuantity(it.productId, it.quantity - 1)} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700">
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="w-10 text-center text-sm font-bold text-slate-800">{it.quantity}</span>
                                                <button onClick={() => setQuantity(it.productId, it.quantity + 1)} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700">
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                                <span className="ml-auto font-extrabold text-veci-dark">{formatCLP(line)}</span>
                                            </div>
                                            {it.allowsNotes && (
                                                <div className="mt-3">
                                                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mb-1">
                                                        <NotebookPen className="w-3.5 h-3.5" />
                                                        Notas para este producto
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={it.notes ?? ""}
                                                        onChange={(e) => setNotes(it.productId, e.target.value)}
                                                        placeholder="Ej: bien doraditos, sin sésamo, etc."
                                                        className="w-full text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-veci-primary/30"
                                                        maxLength={280}
                                                    />
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </Section>

                        {/* Date */}
                        <Section title="Fecha de retiro" icon={<CalIcon className="w-4 h-4" />}>
                            {!config ? (
                                <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando calendario...</div>
                            ) : (
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={setDate}
                                        disabled={isDayDisabled}
                                        locale={es}
                                        className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 w-full sm:w-[340px] shrink-0 [--cell-size:2.6rem] [&_table]:w-full [&_.rdp-weekday]:text-[0.72rem] [&_.rdp-day]:text-sm"
                                    />
                                    <div className="flex-1 min-w-0 space-y-2 text-xs text-slate-600">
                                        <p>Mínimo <strong>{effMinHours} h</strong> de anticipación.</p>
                                        {leadDriver && (
                                            <p className="text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 leading-snug">
                                                Incluye <strong>{leadDriver.name}</strong> · necesita {leadDriver.hours} h de preparación.
                                            </p>
                                        )}
                                        <p>Hasta <strong>{config.maxDaysAhead} días</strong> a futuro.</p>
                                        {config.closedWeekdays.length > 0 && (
                                            <p>Cerramos: {config.closedWeekdays.map((d) => ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][d - 1]).join(", ")}.</p>
                                        )}
                                        <p>Horario: {config.openHour}:00 – {config.closeHour}:00 hrs.</p>
                                    </div>
                                </div>
                            )}
                        </Section>

                        {/* Time slot */}
                        <Section title="Hora de retiro" icon={<Clock className="w-4 h-4" />}>
                            {!date ? (
                                <p className="text-sm text-slate-400">Elige primero una fecha.</p>
                            ) : slotsLoading ? (
                                <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando horarios...</div>
                            ) : slotsError ? (
                                <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    {slotsError}
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-2">
                                    {slots.map((slot) => (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() => setTimeSlot(slot)}
                                            className={`px-2 py-2 rounded-lg text-sm font-bold transition border ${
                                                timeSlot === slot
                                                    ? "bg-gradient-to-r from-veci-primary to-rose-400 text-white border-transparent shadow"
                                                    : "bg-white text-slate-700 border-slate-200 hover:border-veci-primary/40"
                                            }`}
                                        >
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </Section>

                        {/* Method */}
                        <Section title="¿Cómo lo recibes?">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <MethodOption
                                    icon={<Store className="w-5 h-5" />}
                                    label="Retiro en local"
                                    description="Sin costo · paga al retirar"
                                    selected={method === "pickup"}
                                    onClick={() => setMethod("pickup")}
                                />
                                <MethodOption
                                    icon={<Truck className="w-5 h-5" />}
                                    label="Delivery"
                                    description={config ? `+${formatCLP(config.deliveryFee)} · paga al recibir` : "+ delivery"}
                                    selected={method === "delivery"}
                                    onClick={() => setMethod("delivery")}
                                    disabled={!config?.offersDelivery}
                                />
                            </div>
                            {method === "delivery" && (
                                <div className="mt-4">
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Dirección</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            value={address}
                                            onChange={(e) => setAddress(e.target.value)}
                                            placeholder="Calle, número, comuna, depto"
                                            className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-veci-primary/40"
                                            maxLength={240}
                                        />
                                    </div>
                                </div>
                            )}
                        </Section>

                        {/* General notes */}
                        <Section title="Notas adicionales (opcional)" icon={<NotebookPen className="w-4 h-4" />}>
                            <textarea
                                value={generalNotes}
                                onChange={(e) => setGeneralNotes(e.target.value)}
                                rows={3}
                                maxLength={500}
                                placeholder="¿Alguna indicación general para tu encargo?"
                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-veci-primary/40 resize-none"
                            />
                        </Section>

                    </div>

                    {/* RIGHT COLUMN: summary sticky */}
                    <aside className="lg:sticky lg:top-32 self-start">
                        <div className="bg-white/70 backdrop-blur-md border border-white rounded-3xl shadow-md p-5 space-y-4">

                            <h2 className="font-bold text-slate-800">Resumen</h2>

                            <div className="space-y-1.5 text-sm">
                                <Row label="Subtotal" value={formatCLP(subtotal)} />
                                {method === "delivery" && (
                                    <Row label="Delivery" value={formatCLP(deliveryFee)} />
                                )}
                                <div className="border-t border-slate-100 pt-2 mt-2">
                                    <Row label={<strong>Total</strong>} value={<strong className="text-veci-dark text-lg">{formatCLP(total)}</strong>} />
                                </div>
                            </div>

                            <p className="text-[11px] text-slate-500 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                                <strong className="block text-amber-800 mb-0.5">Sin pago online</strong>
                                Pagas en efectivo o transferencia al retirar / recibir.
                            </p>

                            {error && (
                                <div className="text-sm text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2 flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!canSubmit || submitting}
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-full bg-gradient-to-r from-veci-primary to-rose-400 text-white font-bold shadow-md hover:shadow-lg active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        Confirmando...
                                    </>
                                ) : (
                                    <>
                                        <Cookie className="w-5 h-5" />
                                        Confirmar encargo
                                    </>
                                )}
                            </button>

                            {status !== "authenticated" && (
                                <p className="text-[11px] text-center text-slate-500">
                                    Te pediremos iniciar sesión al confirmar.
                                </p>
                            )}
                        </div>
                    </aside>

                </div>
            </div>

            <Footer />

            {success && <SuccessModal {...success} onClose={() => { setSuccess(null); router.push("/cuenta/encargos"); }} />}
        </main>
    );
}

/* --- Sub-components --- */

function Section({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="bg-white/70 backdrop-blur-md border border-white rounded-3xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                    {icon && <span className="text-amber-600">{icon}</span>}
                    {title}
                </h2>
                {subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}
            </div>
            {children}
        </section>
    );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
    return (
        <div className="flex justify-between items-baseline">
            <span className="text-slate-600">{label}</span>
            <span className="text-slate-800">{value}</span>
        </div>
    );
}

function MethodOption({ icon, label, description, selected, onClick, disabled }: { icon: React.ReactNode; label: string; description: string; selected: boolean; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`text-left rounded-2xl border-2 px-4 py-3.5 transition ${
                disabled ? "opacity-40 cursor-not-allowed border-slate-200 bg-white" :
                selected ? "border-veci-primary bg-rose-50/40 shadow-sm" : "border-slate-200 bg-white hover:border-veci-primary/40"
            }`}
        >
            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${selected ? "bg-veci-primary text-white" : "bg-slate-100 text-slate-600"}`}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${selected ? "text-veci-dark" : "text-slate-700"}`}>{label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
                </div>
            </div>
        </button>
    );
}
