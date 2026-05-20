"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Sparkles, Trophy, Gift, Loader2, CheckCircle2, User, MapPin, Phone, Receipt,
    PartyPopper, Calendar, Share2,
} from "lucide-react";

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
    images: Array<{ id: string; url: string; isPrimary: boolean }>;
    prizes: Array<{ id: string; position: number; name: string; description: string | null }>;
    entriesCount: number;
    winners: Array<{ position: number; prizeName: string; number: number; winnerName: string | null }>;
}

export default function TemporadaPage() {
    const [raffle, setRaffle] = useState<Raffle | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ number: number; raffleName: string } | null>(null);
    const [form, setForm] = useState({ name: "", address: "", phone: "", receiptNumber: "" });

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

        if (!form.name.trim() || !form.address.trim() || !form.phone.trim() || !form.receiptNumber.trim()) {
            setError("Completa todos los campos");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/raffles/temporada/inscribir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "No se pudo inscribir");
                return;
            }
            setSuccess({ number: data.number, raffleName: data.raffleName });
            setForm({ name: "", address: "", phone: "", receiptNumber: "" });
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
    const remainingDays = raffle.endsAt || raffle.drawAt
        ? Math.max(0, Math.ceil((new Date((raffle.endsAt || raffle.drawAt)!).getTime() - Date.now()) / 86400000))
        : null;

    return (
        <main className="min-h-screen relative overflow-hidden bg-slate-900">
            {/* Imagen de fondo full screen */}
            {heroImage && (
                <div className="absolute inset-0 -z-10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={heroImage} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-b from-violet-900/50 via-violet-900/70 to-violet-950/95" />
                </div>
            )}
            {!heroImage && (
                <div className="absolute inset-0 -z-10 bg-gradient-to-br from-violet-700 via-veci-primary to-fuchsia-800">
                    <div aria-hidden className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-amber-400/20 blur-3xl" />
                    <div aria-hidden className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-pink-400/20 blur-3xl" />
                </div>
            )}

            <div className="relative min-h-screen flex flex-col items-center px-4 py-8 sm:py-12">
                {/* Header minimal */}
                <header className="w-full max-w-2xl flex items-center justify-between mb-6 sm:mb-8">
                    <span className="inline-flex items-center gap-2 text-white">
                        <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur border border-white/30 flex items-center justify-center">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <span className="font-extrabold text-sm">MiniVeci · Sorteo de Temporada</span>
                    </span>
                    {remainingDays !== null && (
                        <span className="text-xs text-white/80 inline-flex items-center gap-1.5 bg-white/10 backdrop-blur rounded-full px-3 py-1 border border-white/20">
                            <Calendar className="h-3 w-3" />
                            {remainingDays === 0 ? "Último día" : `${remainingDays}d restantes`}
                        </span>
                    )}
                </header>

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
                                        Completa tus datos con el número de tu boleta
                                    </p>
                                </div>

                                <Field
                                    icon={User}
                                    placeholder="Tu nombre completo"
                                    value={form.name}
                                    onChange={(v) => setForm({ ...form, name: v })}
                                    autoComplete="name"
                                />
                                <Field
                                    icon={Phone}
                                    placeholder="Celular (ej: +56 9 1234 5678)"
                                    value={form.phone}
                                    onChange={(v) => setForm({ ...form, phone: v })}
                                    type="tel"
                                    autoComplete="tel"
                                />
                                <Field
                                    icon={MapPin}
                                    placeholder="Dirección"
                                    value={form.address}
                                    onChange={(v) => setForm({ ...form, address: v })}
                                    autoComplete="street-address"
                                />
                                <Field
                                    icon={Receipt}
                                    placeholder="N° de boleta (la que te dieron en el local)"
                                    value={form.receiptNumber}
                                    onChange={(v) => setForm({ ...form, receiptNumber: v })}
                                    inputMode="numeric"
                                />

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
    success: { number: number; raffleName: string };
    prizes: Array<{ position: number; prizeName?: string; name?: string }>;
    drawAt: string | null;
}) {
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

                <h2 className="mt-5 text-2xl font-black text-slate-900">¡Estás participando!</h2>
                <p className="text-sm text-slate-500 mt-1">{success.raffleName}</p>

                <div className="mt-6 mb-2">
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-bold">Tu número de la suerte</p>
                    <p className="mt-2 text-6xl font-black bg-gradient-to-br from-veci-primary to-violet-600 bg-clip-text text-transparent">
                        {success.number}
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
