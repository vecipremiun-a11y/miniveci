"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles, Trophy, Gift, Loader2, CheckCircle2, User, MapPin, Phone, Receipt,
    PartyPopper, Mail, FileText,
} from "lucide-react";
import {
    RAFFLE_ENTRY_FIELD_META,
    DEFAULT_RAFFLE_ENTRY_FIELDS,
    type RaffleEntryFieldKey,
    type RaffleEntryFields,
} from "@/lib/raffle-entry-fields";

interface Raffle {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    totalNumbers: number;
    status: "active" | "drawn" | "closed";
    drawAt: string | null;
    endsAt: string | null;
    coverImage: string | null;
    terms: string | null;
    entryFields: RaffleEntryFields;
    boletaMinAmount: number;
    images: Array<{ id: string; url: string; isPrimary: boolean }>;
    prizes: Array<{ id: string; position: number; name: string; description: string | null }>;
    entriesCount: number;
    winners: Array<{ position: number; prizeName: string; number: number; winnerName: string | null }>;
}

// Metadatos de UI por campo (ícono, placeholder, tipo de input).
const FIELD_UI: Record<RaffleEntryFieldKey, {
    icon: any;
    placeholder: string;
    type?: string;
    autoComplete?: string;
    inputMode?: "text" | "numeric" | "tel" | "email";
}> = {
    name: { icon: User, placeholder: "Tu nombre completo", autoComplete: "name" },
    phone: { icon: Phone, placeholder: "Celular (ej: +56 9 1234 5678)", type: "tel", autoComplete: "tel" },
    rut: { icon: FileText, placeholder: "RUT (ej: 12.345.678-9)" },
    email: { icon: Mail, placeholder: "Correo electrónico", type: "email", autoComplete: "email", inputMode: "email" },
    receiptNumber: { icon: Receipt, placeholder: "N° de boleta (la que te dieron en el local)", inputMode: "numeric" },
    address: { icon: MapPin, placeholder: "Dirección", autoComplete: "street-address" },
};

const EMPTY_FORM: Record<RaffleEntryFieldKey, string> = {
    name: "", phone: "", rut: "", email: "", receiptNumber: "", address: "",
};

export default function TemporadaPage() {
    const [raffle, setRaffle] = useState<Raffle | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ number: number; receiptNumber: string | null; raffleName: string; name: string | null } | null>(null);
    const [form, setForm] = useState<Record<RaffleEntryFieldKey, string>>({ ...EMPTY_FORM });

    const entryFields = raffle?.entryFields ?? DEFAULT_RAFFLE_ENTRY_FIELDS;
    const activeFields = RAFFLE_ENTRY_FIELD_META.filter((f) => entryFields[f.key]);

    useEffect(() => {
        const ac = new AbortController();
        // Timeout de seguridad: si la API no responde en 10s, sale del loading
        const timeout = setTimeout(() => {
            ac.abort();
            setLoading(false);
        }, 10000);

        fetch("/api/raffles/temporada", { signal: ac.signal, cache: "no-store" })
            .then((r) => r.json())
            .then((data) => {
                setRaffle(data?.raffle ?? null);
            })
            .catch((err) => {
                if (err?.name !== "AbortError") console.error("[temporada] fetch err", err);
            })
            .finally(() => {
                clearTimeout(timeout);
                setLoading(false);
            });

        return () => {
            clearTimeout(timeout);
            ac.abort();
        };
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        // Validar solo los campos activos del sorteo
        const missing = activeFields.some((f) => !form[f.key].trim());
        if (missing) {
            setError("Completa todos los campos");
            return;
        }

        // Enviar únicamente los campos solicitados
        const payload: Partial<Record<RaffleEntryFieldKey, string>> = {};
        for (const f of activeFields) payload[f.key] = form[f.key].trim();

        setSubmitting(true);
        try {
            const res = await fetch("/api/raffles/temporada/inscribir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "No se pudo inscribir");
                return;
            }
            // POSVECI devuelve ticketNumber; el flujo local devuelve number/receiptNumber.
            setSuccess({
                number: data.ticketNumber ?? data.number,
                receiptNumber: data.receiptNumber ?? null,
                raffleName: data.raffleName,
                name: form.name.trim() || null,
            });
            setForm({ ...EMPTY_FORM });
        } catch {
            setError("Error de conexión. Intenta de nuevo.");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-600 via-veci-primary to-purple-700">
                <Loader2 className="h-10 w-10 text-white animate-spin" />
            </main>
        );
    }

    if (!raffle) {
        return <NoActiveRaffle />;
    }

    if (raffle.status === "drawn") {
        return <DrawnRaffle raffle={raffle} />;
    }

    const heroImage = raffle.coverImage || raffle.images.find((i) => i.isPrimary)?.url || raffle.images[0]?.url || null;
    const countdownTarget = raffle.endsAt || raffle.drawAt;

    return (
        <main className="min-h-screen relative overflow-hidden bg-slate-900">
            {/* Imagen de fondo full screen */}
            {heroImage && (
                <div className="absolute inset-0 z-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={heroImage} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-violet-900/50 via-violet-900/70 to-violet-950/95" />
                </div>
            )}
            {!heroImage && (
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-violet-700 via-veci-primary to-fuchsia-800">
                    <div aria-hidden className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-amber-400/20 blur-3xl" />
                    <div aria-hidden className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-pink-400/20 blur-3xl" />
                </div>
            )}

            <div className="relative z-10 min-h-screen flex flex-col items-center px-4 py-10 sm:py-14">
                <AnimatePresence mode="wait">
                    {success ? (
                        <SuccessCard key="success" success={success} prizes={raffle.prizes} drawAt={raffle.drawAt} />
                    ) : (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="w-full max-w-md"
                        >
                            {/* Título grande del sorteo */}
                            <div className="text-center text-white mb-6">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", delay: 0.1 }}
                                    className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest text-amber-300 bg-white/10 backdrop-blur border border-amber-300/30 rounded-full px-3 py-1 mb-3"
                                >
                                    <Sparkles className="h-3 w-3" />
                                    SORTEO ACTIVO
                                </motion.div>
                                {countdownTarget && <Countdown target={countdownTarget} />}
                                <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight drop-shadow-lg">
                                    {raffle.name}
                                </h1>
                                {raffle.prizes.length > 0 && (
                                    <p className="mt-3 text-sm sm:text-base text-white/90">
                                        🏆 {raffle.prizes[0].name}
                                        {raffle.prizes.length > 1 && (
                                            <span className="text-white/70"> · y {raffle.prizes.length - 1} premio{raffle.prizes.length - 1 === 1 ? "" : "s"} más</span>
                                        )}
                                    </p>
                                )}
                            </div>

                            {/* Card del formulario */}
                            <motion.form
                                onSubmit={handleSubmit}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="bg-white rounded-3xl shadow-2xl p-5 sm:p-7 space-y-4"
                            >
                                <div className="text-center mb-2">
                                    <h2 className="text-lg font-extrabold text-slate-900">¡Inscríbete gratis!</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {entryFields.receiptNumber
                                            ? "Completa tus datos con el número de tu boleta"
                                            : "Completa tus datos para participar"}
                                    </p>
                                    {raffle.boletaMinAmount > 0 && (
                                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-bold text-amber-700">
                                            <Receipt className="h-3 w-3" />
                                            Boletas desde ${raffle.boletaMinAmount.toLocaleString("es-CL")}
                                        </span>
                                    )}
                                </div>

                                {activeFields.map((f) => {
                                    const ui = FIELD_UI[f.key];
                                    return (
                                        <Field
                                            key={f.key}
                                            icon={ui.icon}
                                            placeholder={ui.placeholder}
                                            value={form[f.key]}
                                            onChange={(v) => setForm((prev) => ({ ...prev, [f.key]: v }))}
                                            type={ui.type}
                                            autoComplete={ui.autoComplete}
                                            inputMode={ui.inputMode}
                                        />
                                    );
                                })}

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2"
                                    >
                                        {error}
                                    </motion.div>
                                )}

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="w-full py-3.5 rounded-full bg-gradient-to-r from-veci-primary to-violet-600 text-white font-extrabold shadow-lg shadow-veci-primary/30 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            Inscribiendo…
                                        </>
                                    ) : (
                                        <>
                                            <Gift className="h-5 w-5" />
                                            ¡Participar gratis!
                                        </>
                                    )}
                                </button>

                                <p className="text-[10px] text-center text-slate-400 leading-relaxed">
                                    Al participar aceptas las bases del sorteo. Una boleta = una inscripción.
                                </p>
                            </motion.form>

                            {/* Contador de participantes */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="mt-5 text-center text-white/80 text-xs"
                            >
                                <span className="font-bold text-white">{raffle.entriesCount.toLocaleString("es-CL")}</span> vecinos ya están participando
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer mini */}
                <footer className="mt-auto pt-8 text-center text-[10px] text-white/60">
                    © {new Date().getFullYear()} MiniVeci · Sorteo legal y verificable
                </footer>
            </div>
        </main>
    );
}

// --- Subcomponentes ---

function Countdown({ target }: { target: string }) {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const targetMs = new Date(target).getTime();
    const diff = Math.max(0, targetMs - now);
    const finished = diff <= 0;

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    const units = [
        { value: days, label: "Días" },
        { value: hours, label: "Horas" },
        { value: minutes, label: "Min" },
        { value: seconds, label: "Seg" },
    ];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-5 flex flex-col items-center gap-2.5"
        >
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                {finished ? "¡Es hoy! Sorteo en curso" : "Sorteamos en"}
            </span>
            <div className="flex items-stretch justify-center gap-2 sm:gap-2.5">
                {units.map((u) => (
                    <div
                        key={u.label}
                        className="flex min-w-[3.5rem] sm:min-w-[4.25rem] flex-col items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-3 py-2.5 shadow-lg shadow-black/20 backdrop-blur-md sm:px-4 sm:py-3"
                    >
                        <AnimatePresence mode="popLayout" initial={false}>
                            <motion.span
                                key={u.value}
                                initial={{ y: -14, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 14, opacity: 0 }}
                                transition={{ duration: 0.25, ease: "easeOut" }}
                                className="block text-2xl font-black leading-none tabular-nums text-white drop-shadow sm:text-3xl"
                            >
                                {String(u.value).padStart(2, "0")}
                            </motion.span>
                        </AnimatePresence>
                        <span className="mt-1.5 text-[8px] font-bold uppercase tracking-[0.15em] text-white/55 sm:text-[9px]">
                            {u.label}
                        </span>
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

function Field({
    icon: Icon, placeholder, value, onChange, type = "text", autoComplete, inputMode,
}: {
    icon: any;
    placeholder: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    autoComplete?: string;
    inputMode?: "text" | "numeric" | "tel" | "email";
}) {
    return (
        <label className="block">
            <div className="relative">
                <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                    type={type}
                    autoComplete={autoComplete}
                    inputMode={inputMode}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-veci-primary focus:ring-2 focus:ring-veci-primary/20 outline-none transition"
                />
            </div>
        </label>
    );
}

function SuccessCard({
    success, prizes, drawAt,
}: {
    success: { number: number; receiptNumber: string | null; raffleName: string; name: string | null };
    prizes: Array<{ position: number; prizeName?: string; name?: string }>;
    drawAt: string | null;
}) {
    const firstName = success.name?.trim().split(/\s+/)[0] ?? null;
    // Si la persona ingresó N° de boleta, esa es su número de la suerte; si no, el asignado.
    const luckyNumber = success.receiptNumber?.trim() || success.number;
    const luckyLabel = success.receiptNumber?.trim() ? "Tu boleta participa con el N°" : "Tu número de la suerte";
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="w-full max-w-md"
        >
            <div className="bg-white rounded-3xl shadow-2xl p-7 sm:p-8 text-center">
                <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", delay: 0.15 }}
                    className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg"
                >
                    <CheckCircle2 className="h-10 w-10 text-white" />
                </motion.div>

                <h2 className="mt-5 text-2xl font-black text-slate-900">
                    {firstName ? `¡Gracias, ${firstName}!` : "¡Estás participando!"}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    {firstName ? `Ya estás participando en ${success.raffleName}` : success.raffleName}
                </p>

                <div className="mt-6 mb-2">
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">{luckyLabel}</p>
                    <p className="mt-2 text-6xl font-black bg-gradient-to-br from-veci-primary to-violet-600 bg-clip-text text-transparent">
                        {luckyNumber}
                    </p>
                </div>

                {drawAt && (
                    <p className="mt-4 text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                        <PartyPopper className="inline h-4 w-4 text-amber-500 mr-1 align-text-bottom" />
                        Sorteo el <strong>{new Date(drawAt).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}</strong>. Te llamaremos si ganas.
                    </p>
                )}

                <button
                    onClick={() => window.location.reload()}
                    className="mt-6 w-full py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
                >
                    Inscribir otra boleta
                </button>

                <p className="mt-4 text-[11px] text-slate-400">
                    Guarda tu número. Te identificaremos por tu boleta y celular.
                </p>
            </div>
        </motion.div>
    );
}

function NoActiveRaffle() {
    return (
        <main className="min-h-screen relative bg-gradient-to-br from-slate-800 via-violet-900 to-slate-900 flex items-center justify-center px-4">
            <div className="text-center max-w-md text-white">
                <Trophy className="h-16 w-16 mx-auto text-amber-400 mb-4 opacity-70" />
                <h1 className="text-3xl font-black">No hay sorteo activo</h1>
                <p className="mt-3 text-white/70">
                    En este momento no tenemos un sorteo de temporada activo. Vuelve pronto o pregunta en el local por el próximo.
                </p>
            </div>
        </main>
    );
}

function DrawnRaffle({ raffle }: { raffle: Raffle }) {
    return (
        <main className="min-h-screen relative bg-gradient-to-br from-violet-700 via-veci-primary to-fuchsia-800 flex items-center justify-center px-4 py-12">
            <div className="text-center max-w-md text-white">
                <Trophy className="h-16 w-16 mx-auto text-amber-300 mb-4" />
                <h1 className="text-3xl font-black">¡Sorteo finalizado!</h1>
                <p className="mt-2 text-white/80">{raffle.name}</p>

                {raffle.winners.length > 0 && (
                    <div className="mt-6 space-y-3">
                        {raffle.winners.map((w) => (
                            <div key={w.position} className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-4 text-left">
                                <p className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">
                                    {w.position}° lugar · {w.prizeName}
                                </p>
                                <p className="text-2xl font-black mt-1">N° {w.number}</p>
                                {w.winnerName && <p className="text-sm text-white/80">{w.winnerName}</p>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
