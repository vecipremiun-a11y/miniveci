"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
    Sparkles, ArrowRight, ChevronRight, Gift, Clock, Star,
    ClipboardList, Ticket, CheckCircle2, Trophy, QrCode, Store, Receipt,
    Sparkle, Smartphone, Headphones, Watch, Camera,
} from "lucide-react";
import { Footer } from "@/components/Footer";

interface Raffle {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    type: "free" | "paid";
    price: number | null;
    totalNumbers: number;
    status: "active" | "drawn" | "closed";
    drawAt: string | null;
    endsAt: string | null;
    coverImage: string | null;
    featured: boolean;
    soldCount: number;
}

const STEPS = [
    { icon: ClipboardList, title: "Elegí tu sorteo", desc: "Explorá los sorteos activos y elegí el premio que querés." },
    { icon: Ticket, title: "Comprá tu número", desc: "Elegí tus números favoritos y completá tu compra." },
    { icon: CheckCircle2, title: "Esperá el sorteo", desc: "Te avisamos la fecha del sorteo. ¡Mucha suerte!" },
    { icon: Gift, title: "Ganá increíbles premios", desc: "Si sos el ganador, te contactamos y el premio es tuyo." },
];

function daysUntil(target: string | null): number | null {
    if (!target) return null;
    const diff = new Date(target).getTime() - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / 86400000);
}

export default function SorteosPage() {
    const [raffles, setRaffles] = useState<Raffle[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/raffles")
            .then((r) => r.json())
            .then((data) => {
                setRaffles(data.raffles || []);
                setLoading(false);
            });
    }, []);

    const active = raffles.filter((r) => r.status === "active");

    return (
        <main className="min-h-screen bg-white">
            <div className="h-24 md:h-28" />

            {/* HERO */}
            <section className="relative">
                <div aria-hidden className="absolute inset-x-0 top-0 h-[600px] -z-10 overflow-hidden">
                    <div className="absolute -top-32 right-0 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-violet-200/60 via-pink-200/40 to-amber-100/30 blur-3xl" />
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pt-8 pb-12 sm:pt-12 sm:pb-16">
                    <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                        {/* Texto */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.5 }}
                        >
                            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 mb-4">
                                <span>TU SUERTE PUEDE SER AHORA</span>
                                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                            </div>

                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] text-slate-900">
                                Participá y ganá<br />
                                productos{" "}
                                <span className="text-veci-primary">increíbles</span>
                            </h1>

                            <p className="mt-5 text-slate-500 text-base sm:text-lg max-w-md">
                                Sumate a nuestros sorteos y llevate esos productos que tanto querés. ¡Es fácil, rápido y seguro!
                            </p>
                        </motion.div>

                        {/* Ilustración */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.7, delay: 0.1 }}
                            className="relative aspect-square max-w-md mx-auto w-full"
                        >
                            <HeroIllustration />
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* SORTEOS ACTIVOS: los productos que se están sorteando, justo bajo el hero */}
            <section id="sorteos-activos" className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-12 sm:py-16">
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                            Sorteos activos
                            <span className="inline-block ml-2 align-middle h-1 w-12 bg-veci-primary rounded-full" />
                        </h2>
                    </div>
                    <Link
                        href="#sorteos-activos"
                        className="hidden sm:inline-flex items-center gap-1.5 text-sm text-veci-primary font-semibold hover:underline border border-veci-primary/30 rounded-full px-4 py-1.5 hover:bg-veci-primary/5"
                    >
                        Ver todos los sorteos
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                </div>

                {loading ? (
                    <SkeletonGrid />
                ) : active.length === 0 ? (
                    <PreviewGrid />
                ) : active.length === 1 ? (
                    // Un solo sorteo: tarjeta a lo ancho, para que no quede perdida en la grilla.
                    <RaffleCard raffle={active[0]} index={0} wide />
                ) : (
                    <div className={`grid gap-6 grid-cols-1 sm:grid-cols-2 ${active.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
                        {active.slice(0, 8).map((r, i) => <RaffleCard key={r.id} raffle={r} index={i} />)}
                    </div>
                )}
            </section>

            {/* CÓMO FUNCIONA */}
            <section className="bg-gradient-to-br from-violet-50 via-white to-pink-50 py-12 sm:py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
                    <h2 className="text-center text-2xl sm:text-3xl font-black text-slate-900 mb-10">
                        ¿Cómo funciona?
                    </h2>

                    <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-4">
                        {/* Línea punteada conectora (desktop) */}
                        <div className="hidden lg:block absolute top-8 left-[12.5%] right-[12.5%] h-px border-t-2 border-dashed border-slate-300/70" aria-hidden />

                        {STEPS.map((step, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.08 }}
                                className="relative text-center"
                            >
                                <div className="relative w-16 h-16 mx-auto rounded-full bg-white shadow-md flex items-center justify-center">
                                    <step.icon className="h-6 w-6 text-veci-primary" />
                                </div>
                                <h3 className="mt-3 font-extrabold text-slate-900 text-sm sm:text-base">
                                    {i + 1}. {step.title}
                                </h3>
                                <p className="mt-1.5 text-xs sm:text-sm text-slate-500 max-w-[200px] mx-auto leading-relaxed">
                                    {step.desc}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* BANNER SORTEO DE TEMPORADA (boleta del local), al final */}
            <SorteoTemporadaBanner />

            <Footer />
        </main>
    );
}

/* ------------ Subcomponentes ------------ */

function SorteoTemporadaBanner() {
    return (
        <section className="py-10 sm:py-14 bg-gradient-to-b from-white to-slate-50/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12">
                <Link href="/sorteos/temporada" className="group block">
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 shadow-2xl shadow-orange-500/20"
                    >
                        {/* Decoración de fondo */}
                        <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none">
                            <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full bg-amber-300/30 blur-3xl" />
                            <div className="absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-rose-400/30 blur-3xl" />
                            <Sparkles className="absolute top-8 left-12 h-6 w-6 text-white/30 rotate-12" />
                            <Sparkles className="absolute bottom-10 right-1/4 h-5 w-5 text-white/30 -rotate-12" />
                            <Sparkle className="absolute top-1/2 right-1/3 h-4 w-4 text-white/30" />
                            <div className="absolute top-12 right-10 h-3 w-3 rounded-full bg-white/40" />
                            <div className="absolute bottom-16 left-1/3 h-2 w-2 rounded-full bg-white/50" />
                        </div>

                        <div className="relative grid lg:grid-cols-[1.3fr_1fr] gap-6 p-6 sm:p-8 md:p-10 items-center">
                            {/* Texto */}
                            <div className="text-white">
                                <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest bg-white/20 backdrop-blur border border-white/30 rounded-full px-3 py-1 mb-4">
                                    <Sparkles className="h-3 w-3" />
                                    EXCLUSIVO LOCAL FÍSICO
                                </div>

                                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black leading-[1.05] drop-shadow">
                                    ¿Compraste en<br />nuestro local?
                                </h2>
                                <p className="mt-4 text-base sm:text-lg text-white/95 max-w-md">
                                    Inscribe tu boleta en el <strong>Sorteo de Temporada</strong> y participa <strong>gratis</strong> por premios increíbles. Solo necesitas escanear el QR del local.
                                </p>

                                <div className="mt-6 flex flex-wrap items-center gap-3">
                                    <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-rose-600 font-extrabold shadow-xl group-hover:scale-105 group-hover:shadow-2xl transition">
                                        Participar con mi boleta
                                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
                                    </span>
                                    <span className="text-xs text-white/80 inline-flex items-center gap-1.5">
                                        <Sparkle className="h-3 w-3" />
                                        Sin login · 30 segundos
                                    </span>
                                </div>

                                {/* Mini features */}
                                <div className="mt-6 grid grid-cols-3 gap-3 max-w-md">
                                    <MiniFeature icon={Store} label="Solo local" />
                                    <MiniFeature icon={Receipt} label="Tu boleta" />
                                    <MiniFeature icon={Trophy} label="Premios reales" />
                                </div>
                            </div>

                            {/* Ilustración: QR + boleta */}
                            <div className="relative aspect-square max-w-[280px] mx-auto w-full hidden sm:block">
                                <BoletaIllustration />
                            </div>
                        </div>
                    </motion.div>
                </Link>
            </div>
        </section>
    );
}

function MiniFeature({ icon: Icon, label }: { icon: any; label: string }) {
    return (
        <div className="flex flex-col items-center text-center bg-white/10 backdrop-blur border border-white/20 rounded-xl py-2 px-2">
            <Icon className="h-4 w-4 text-white mb-1" />
            <span className="text-[10px] font-bold text-white leading-tight">{label}</span>
        </div>
    );
}

function BoletaIllustration() {
    return (
        <div className="relative w-full h-full">
            {/* Boleta inclinada al fondo */}
            <motion.div
                animate={{ rotate: [-8, -10, -8], y: [0, -4, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[8%] left-[5%] w-[55%] h-[80%] bg-white rounded-xl shadow-2xl p-3 origin-center"
            >
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-dashed border-slate-300">
                    <div className="font-bold text-[9px] text-slate-700">MINIVECI</div>
                    <Store className="h-3 w-3 text-slate-400" />
                </div>
                <div className="space-y-1">
                    <div className="h-1.5 bg-slate-200 rounded w-full" />
                    <div className="h-1.5 bg-slate-200 rounded w-4/5" />
                    <div className="h-1.5 bg-slate-200 rounded w-3/5" />
                </div>
                <div className="mt-2 pt-2 border-t border-dashed border-slate-300">
                    <div className="flex justify-between items-center">
                        <span className="text-[8px] font-bold text-slate-400">N°</span>
                        <span className="text-[10px] font-black text-slate-800">001234</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <span className="text-[8px] text-slate-400">TOTAL</span>
                        <span className="text-[10px] font-bold text-veci-primary">$12.500</span>
                    </div>
                </div>
            </motion.div>

            {/* QR adelante (más grande) */}
            <motion.div
                animate={{ rotate: [4, 6, 4], y: [0, -6, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                className="absolute bottom-[5%] right-[2%] w-[58%] aspect-square bg-white rounded-2xl shadow-2xl p-3 origin-center"
            >
                <div className="w-full h-full bg-slate-900 rounded-xl p-2 flex items-center justify-center">
                    <QrCode className="w-full h-full text-white" strokeWidth={1.5} />
                </div>
                <div className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-lg">
                    Escanea
                </div>
            </motion.div>

            {/* Confeti */}
            <Sparkles className="absolute top-[2%] right-[20%] h-4 w-4 text-white/80" />
            <Sparkle className="absolute bottom-[40%] left-[2%] h-3 w-3 text-white/80" />
        </div>
    );
}

function HeroIllustration() {
    return (
        <div className="relative w-full h-full">
            {/* Confeti decorativo */}
            <Sparkle className="absolute top-4 left-8 h-4 w-4 text-amber-400 rotate-12" />
            <Sparkles className="absolute top-16 right-12 h-5 w-5 text-pink-400 -rotate-12" />
            <div className="absolute top-32 left-4 h-2 w-2 rounded-full bg-violet-400" />
            <div className="absolute bottom-32 right-4 h-3 w-3 rounded-full bg-amber-400" />
            <div className="absolute bottom-12 left-12 h-2 w-2 rounded-full bg-pink-400" />

            {/* Pedestal circular */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-[55%]">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-300 via-violet-200 to-pink-200 blur-2xl opacity-70" />
                <div className="absolute inset-x-4 bottom-6 h-12 rounded-full bg-violet-200/60 blur-xl" />
            </div>

            {/* Caja de regalo principal */}
            <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[18%] right-[8%] w-[45%]"
            >
                <div className="relative aspect-square">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 via-violet-400 to-violet-600 shadow-2xl" />
                    {/* Lazo horizontal */}
                    <div className="absolute inset-x-0 top-[42%] h-[16%] bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500" />
                    {/* Lazo vertical */}
                    <div className="absolute inset-y-0 left-[42%] w-[16%] bg-gradient-to-b from-amber-400 via-amber-300 to-amber-500" />
                    {/* Moño */}
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-[55%]">
                        <div className="relative h-12">
                            <div className="absolute left-0 top-0 w-1/2 h-full bg-gradient-to-br from-amber-300 to-amber-500 rounded-l-full" style={{ clipPath: "polygon(0 50%, 50% 0, 100% 50%, 50% 100%)" }} />
                            <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-bl from-amber-300 to-amber-500 rounded-r-full" style={{ clipPath: "polygon(0 50%, 50% 0, 100% 50%, 50% 100%)" }} />
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-amber-500 shadow" />
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Smartphone (centro-izq) */}
            <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute bottom-[15%] left-[18%] z-10"
            >
                <div className="w-20 sm:w-24 aspect-[9/16] rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-2xl border-2 border-slate-800 p-1">
                    <div className="w-full h-full rounded-xl bg-gradient-to-br from-pink-200 via-pink-100 to-rose-200 flex items-center justify-center">
                        <Smartphone className="h-6 w-6 text-pink-400 opacity-50" />
                    </div>
                </div>
            </motion.div>

            {/* Audífonos (arriba-izq) */}
            <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                className="absolute top-[10%] left-[8%] z-10"
            >
                <div className="w-16 sm:w-20 aspect-square rounded-full bg-gradient-to-br from-slate-100 to-pink-100 shadow-xl flex items-center justify-center border-4 border-white">
                    <Headphones className="h-8 w-8 text-slate-500" />
                </div>
            </motion.div>

            {/* Smartwatch (centro) */}
            <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
                className="absolute bottom-[28%] left-[42%] z-20"
            >
                <div className="w-14 sm:w-16 aspect-square rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-xl border-2 border-pink-200 flex items-center justify-center">
                    <Watch className="h-6 w-6 text-pink-300" />
                </div>
            </motion.div>

            {/* Cámara (abajo-centro) */}
            <motion.div
                animate={{ y: [0, -7, 0] }}
                transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-[12%] left-[50%] z-10"
            >
                <div className="w-16 sm:w-20 aspect-square rounded-2xl bg-gradient-to-br from-pink-200 via-rose-100 to-pink-100 shadow-xl flex items-center justify-center border-4 border-white">
                    <Camera className="h-7 w-7 text-rose-400" />
                </div>
            </motion.div>
        </div>
    );
}

function SkeletonGrid() {
    return (
        <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-2xl bg-white border border-slate-100 p-3 animate-pulse">
                    <div className="aspect-square rounded-xl bg-slate-100 mb-3" />
                    <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
                    <div className="h-2 bg-slate-100 rounded-full mb-3" />
                    <div className="h-9 bg-slate-100 rounded-full" />
                </div>
            ))}
        </div>
    );
}

function PreviewGrid() {
    const previews = [
        { label: "iPhone 15", days: 12, sold: 1250, total: 3000 },
        { label: "Aspiradora", days: 8, sold: 876, total: 2000 },
        { label: "PlayStation 5", days: 15, sold: 1523, total: 2500 },
        { label: "Apple Watch", days: 5, sold: 645, total: 1500 },
    ];
    return (
        <>
            <p className="text-center text-sm text-slate-500 mb-6">
                Estos son ejemplos de premios. Pronto verás aquí los sorteos reales.
            </p>
            <div className="grid gap-4 sm:gap-5 grid-cols-2 lg:grid-cols-4">
                {previews.map((p, i) => (
                    <div key={i} className="relative rounded-2xl bg-white border border-slate-100 p-3 opacity-90">
                        <span className="absolute top-4 left-4 z-10 text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-200 text-slate-600">
                            Próximamente
                        </span>
                        <div className="aspect-square rounded-xl bg-gradient-to-br from-violet-100 via-pink-50 to-amber-50 flex items-center justify-center mb-3">
                            <Gift className="h-10 w-10 text-violet-300" />
                        </div>
                        <h3 className="font-extrabold text-slate-800 text-sm">{p.label}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Próximamente</p>
                        <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-slate-300" style={{ width: "0%" }} />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5">0 / {p.total} números</p>
                        <button disabled className="mt-3 w-full py-2 rounded-full bg-slate-200 text-slate-400 font-bold text-xs cursor-not-allowed">
                            Pronto disponible
                        </button>
                    </div>
                ))}
            </div>
        </>
    );
}

const fmtNumber = (n: number) => n.toLocaleString("es-CL");
const fmtMoney = (n: number) =>
    new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

/** Papel picado detrás del premio. */
function Confetti() {
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0">
            <span className="absolute left-[10%] top-[16%] h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="absolute left-[84%] top-[72%] h-2 w-2 rounded-full bg-violet-500/60" />
            <span className="absolute left-[16%] top-[80%] h-3 w-1.5 rotate-45 rounded-sm bg-pink-500/60" />
            <span className="absolute left-[64%] top-[9%] h-1.5 w-3 -rotate-12 rounded-sm bg-cyan-400/70" />
            <span className="absolute left-[44%] top-[88%] h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
            <Sparkles className="absolute left-[6%] top-[46%] h-4 w-4 text-amber-500/70" />
            <Sparkles className="absolute right-[7%] top-[38%] h-3.5 w-3.5 text-pink-500/60" />
            <div className="absolute -bottom-16 -right-16 h-48 w-48 rounded-full bg-white/50 blur-2xl" />
        </div>
    );
}

/**
 * Tarjeta de sorteo con forma de boleto: borde de colores, el premio sobre
 * papel picado, sello "¡GRATIS!" que se mueve y botón para participar.
 * `wide` = una sola tarjeta a lo ancho (foto a un lado, datos al otro).
 */
function RaffleCard({ raffle: r, index, wide = false }: { raffle: Raffle; index: number; wide?: boolean }) {
    const reduceMotion = useReducedMotion();
    const days = daysUntil(r.endsAt || r.drawAt);
    const free = r.type === "free";
    const taken = r.soldCount;
    const left = Math.max(0, r.totalNumbers - taken);
    const pct = r.totalNumbers > 0 ? Math.min(100, Math.round((taken / r.totalNumbers) * 100)) : 0;
    const isNew = index === 1; // marcar el 2do como "Nuevo" como en la ref
    const urgent = days !== null && days <= 3;
    const daysLabel = days == null ? "Sin fecha límite" : days === 0 ? "¡Cierra hoy!" : `Quedan ${days} día${days === 1 ? "" : "s"}`;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.06 }}
            className={wide ? "max-w-5xl mx-auto" : "h-full"}
        >
            <Link
                href={`/sorteos/${r.slug}`}
                className="group relative block h-full rounded-[28px] p-[3px] bg-gradient-to-br from-amber-400 via-pink-500 to-violet-600 shadow-xl shadow-pink-200/70 hover:shadow-2xl hover:shadow-pink-300/80 hover:-translate-y-1 transition duration-300"
            >
                <div className={`relative h-full rounded-[25px] bg-white overflow-hidden flex flex-col ${wide ? "sm:grid sm:grid-cols-2" : ""}`}>
                    {/* Vitrina: el premio sobre papel picado */}
                    <div className={`relative overflow-hidden bg-gradient-to-br from-amber-100 via-pink-100 to-violet-200 ${wide ? "aspect-square sm:aspect-auto sm:min-h-[400px]" : "aspect-square"}`}>
                        <Confetti />
                        {r.coverImage ? (
                            // multiply: el fondo blanco de la foto se funde con el degradado.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={r.coverImage}
                                alt={r.name}
                                className="absolute inset-0 h-full w-full object-contain p-7 sm:p-9 mix-blend-multiply group-hover:scale-110 group-hover:-rotate-2 transition duration-500"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Gift className="h-16 w-16 text-pink-400" />
                            </div>
                        )}

                        {(r.featured || isNew) && (
                            <span className={`absolute top-3 left-3 z-10 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold text-white shadow-md ${r.featured ? "bg-violet-600" : "bg-emerald-500"}`}>
                                <Star className="h-3 w-3 fill-current" />
                                {r.featured ? "Destacado" : "Nuevo"}
                            </span>
                        )}

                        {/* Sello: gratis o precio por número */}
                        <motion.div
                            className="absolute top-3 right-3 z-10"
                            animate={reduceMotion ? undefined : { rotate: [7, -5, 7], scale: [1, 1.08, 1] }}
                            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <div className={`rounded-2xl px-3 py-1.5 text-center text-white shadow-lg ring-2 ${free ? "bg-gradient-to-br from-rose-500 to-red-600 shadow-red-500/40 ring-yellow-300" : "bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-violet-500/40 ring-white"}`}>
                                <p className={`font-black leading-none ${wide ? "text-2xl" : "text-xl"}`}>
                                    {free ? "¡GRATIS!" : fmtMoney(r.price ?? 0)}
                                </p>
                                <p className={`mt-0.5 text-[9px] font-extrabold uppercase tracking-wider ${free ? "text-yellow-200" : "text-white/80"}`}>
                                    {free ? "sin costo" : "por número"}
                                </p>
                            </div>
                        </motion.div>

                        <span className={`absolute bottom-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold shadow-md ${urgent ? "bg-rose-600 text-white animate-pulse" : "bg-white/90 text-slate-800 backdrop-blur"}`}>
                            <Clock className="h-3.5 w-3.5" />
                            {daysLabel}
                        </span>
                    </div>

                    {/* Datos */}
                    <div className={`relative flex flex-1 flex-col gap-3 ${wide ? "p-6 sm:p-9 sm:justify-center" : "p-4 sm:p-5"}`}>
                        {/* Línea picada del boleto */}
                        {!wide && <div aria-hidden className="absolute top-0 inset-x-5 border-t-2 border-dashed border-pink-200" />}

                        <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.15em] text-pink-500">
                            <Sparkles className="h-3.5 w-3.5" />
                            {free ? "Sorteo gratis" : "Sorteo"}
                        </p>
                        <h3 className={`font-black text-slate-900 leading-tight line-clamp-2 ${wide ? "text-3xl sm:text-4xl" : "text-lg"}`}>
                            {r.name}
                        </h3>
                        {wide && r.description && (
                            <p className="text-sm sm:text-base text-slate-500 line-clamp-3">{r.description}</p>
                        )}
                        <p className={`text-slate-600 ${wide ? "text-base" : "text-sm"}`}>
                            {free ? (
                                <>Participar te cuesta <span className="font-black text-emerald-600 text-lg">$0</span></>
                            ) : (
                                <><span className="font-black text-violet-600 text-lg">{fmtMoney(r.price ?? 0)}</span> por número</>
                            )}
                        </p>

                        <div className="mt-auto pt-1">
                            <div className="flex items-center justify-between gap-2 text-xs font-bold">
                                <span className="text-slate-700">
                                    {free
                                        ? `${fmtNumber(left)} número${left === 1 ? "" : "s"} gratis disponible${left === 1 ? "" : "s"}`
                                        : `${fmtNumber(taken)} / ${fmtNumber(r.totalNumbers)} vendidos`}
                                </span>
                                <span className="shrink-0 text-pink-600">{taken === 0 ? "¡Sé el primero!" : `${pct}%`}</span>
                            </div>
                            <div className="mt-1.5 h-2.5 rounded-full bg-pink-100 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-gradient-to-r from-amber-400 via-pink-500 to-violet-600"
                                    style={{ width: `${taken > 0 ? Math.max(pct, 4) : 0}%` }}
                                />
                            </div>
                        </div>

                        <span className={`relative mt-1 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 font-black text-white shadow-lg shadow-rose-300/60 group-hover:shadow-xl group-hover:shadow-rose-400/60 transition ${wide ? "py-4 text-lg" : "py-3 text-sm sm:text-base"}`}>
                            {/* Brillo que cruza el botón al pasar el mouse */}
                            <span aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/35 group-hover:translate-x-[400%] transition-transform duration-700" />
                            <Ticket className="h-4 w-4" />
                            {free ? "¡Participar gratis!" : "Comprar número"}
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
                        </span>
                    </div>
                </div>

                {/* Muescas del boleto, a la altura de la línea picada */}
                {!wide && (
                    <div aria-hidden className="pointer-events-none absolute inset-x-[3px] top-[3px] aspect-square">
                        <span className="absolute -left-[14px] bottom-0 h-[22px] w-[22px] translate-y-1/2 rounded-full bg-white" />
                        <span className="absolute -right-[14px] bottom-0 h-[22px] w-[22px] translate-y-1/2 rounded-full bg-white" />
                    </div>
                )}
            </Link>
        </motion.div>
    );
}
