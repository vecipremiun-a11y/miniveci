"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Trophy, Share2, Loader2, Lock, Ticket } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/CartProvider";

interface RaffleDetail {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    type: "free" | "paid";
    price: number | null;
    audience: "all" | "customers" | "subscribers";
    totalNumbers: number;
    status: "active" | "drawn" | "closed";
    drawAt: string | null;
    endsAt: string | null;
    coverImage: string | null;
    terms: string | null;
    featured: boolean;
    images: Array<{ id: string; url: string; isPrimary: boolean }>;
    prizes: Array<{ id: string; position: number; name: string; description: string | null }>;
    takenNumbers: Array<{ number: number; status: string }>;
    winners: Array<{ position: number; prizeName: string; number: number; winnerName: string | null }>;
}

function Countdown({ target, onExpire }: { target: string; onExpire?: () => void }) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, []);
    const diff = Math.max(0, new Date(target).getTime() - now);
    useEffect(() => {
        if (diff === 0 && onExpire) onExpire();
    }, [diff, onExpire]);
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return (
        <span className="font-mono">
            {d > 0 && `${d}d `}{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </span>
    );
}

export default function RaffleDetailPage() {
    const params = useParams<{ slug: string }>();
    const router = useRouter();
    const { data: session } = useSession();
    const { items: cartItems, addItem } = useCart();
    const [raffle, setRaffle] = useState<RaffleDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(0);
    const [confirmNumber, setConfirmNumber] = useState<number | null>(null);
    const [reserving, setReserving] = useState(false);

    const load = async () => {
        const res = await fetch(`/api/raffles/${params.slug}`);
        const data = await res.json();
        if (res.ok) setRaffle(data);
        setLoading(false);
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.slug]);

    const isCustomer = session?.user?.role === "customer";

    // Mapa de número → estado real para la UI
    const numberStates = useMemo(() => {
        if (!raffle) return new Map<number, "available" | "taken" | "mine-reserved" | "mine">();
        const map = new Map<number, "available" | "taken" | "mine-reserved" | "mine">();
        const myIds = new Set(
            cartItems
                .filter((i) => i.raffle?.raffleId === raffle.id)
                .map((i) => i.raffle!.number),
        );
        for (let n = 1; n <= raffle.totalNumbers; n++) map.set(n, "available");
        for (const t of raffle.takenNumbers) {
            map.set(t.number, myIds.has(t.number) ? "mine-reserved" : "taken");
        }
        return map;
    }, [raffle, cartItems]);

    const winnerNumbers = useMemo(() => {
        const s = new Set<number>();
        raffle?.winners.forEach((w) => s.add(w.number));
        return s;
    }, [raffle]);

    async function reserveNumber(number: number) {
        if (!raffle) return;
        if (!isCustomer) {
            toast.error("Debes iniciar sesión para participar");
            router.push(`/login?redirect=/sorteos/${raffle.slug}`);
            return;
        }
        setReserving(true);
        try {
            const res = await fetch(`/api/raffles/${raffle.slug}/reserve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ number }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "No se pudo reservar el número");
                await load();
                return;
            }

            if (raffle.type === "free") {
                toast.success(`¡Inscrito con el número ${number}!`);
                await load();
            } else {
                addItem({
                    id: `raffle:${raffle.id}:${number}`,
                    name: `${raffle.name} · Nº ${number}`,
                    price: raffle.price ?? 0,
                    image: raffle.coverImage,
                    raffle: {
                        raffleId: raffle.id,
                        raffleSlug: raffle.slug,
                        number,
                        expiresAt: data.expiresAt,
                    },
                });
                toast.success(`Número ${number} reservado por 15 min. Completa el pago.`);
                await load();
            }
            setConfirmNumber(null);
        } finally {
            setReserving(false);
        }
    }

    async function shareWhatsApp() {
        if (!raffle) return;
        const url = `${window.location.origin}/sorteos/${raffle.slug}`;
        const text = encodeURIComponent(`¡Participa en el sorteo ${raffle.name}! ${url}`);
        window.open(`https://wa.me/?text=${text}`, "_blank");
    }

    if (loading || !raffle) {
        return (
            <main className="min-h-screen bg-veci-bg flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-veci-primary" />
            </main>
        );
    }

    const sold = raffle.takenNumbers.filter((t) => t.status === "paid" || t.status === "free").length;
    const pct = raffle.totalNumbers > 0 ? Math.round((sold / raffle.totalNumbers) * 100) : 0;

    const allImages = [
        ...(raffle.coverImage ? [{ id: "cover", url: raffle.coverImage }] : []),
        ...raffle.images.filter((i) => i.url !== raffle.coverImage),
    ];
    const mainImage = allImages[selectedImage]?.url ?? raffle.coverImage;

    const subscriberLocked = raffle.audience === "subscribers" && !isCustomer; // El backend valida con BD; aquí mostramos hint

    return (
        <main className="min-h-screen bg-veci-bg pb-20">
            <div className="h-36 md:h-40" />

            <div className="max-w-7xl mx-auto px-3 sm:px-6 md:px-12">
                <Link href="/sorteos" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 font-semibold text-sm mb-4">
                    <ArrowLeft className="h-4 w-4" />
                    Volver a sorteos
                </Link>

                <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-6 sm:gap-8 items-start">
                    {/* Galería + datos */}
                    <section className="space-y-4">
                        <div className="rounded-2xl overflow-hidden bg-white/60 backdrop-blur border border-white">
                            {mainImage ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={mainImage} alt={raffle.name} className="w-full aspect-video object-cover" />
                            ) : (
                                <div className="aspect-video bg-slate-100 flex items-center justify-center">
                                    <Ticket className="h-16 w-16 text-slate-300" />
                                </div>
                            )}
                        </div>
                        {allImages.length > 1 && (
                            <div className="grid grid-cols-5 gap-2">
                                {allImages.map((img, idx) => (
                                    <button
                                        key={img.id}
                                        onClick={() => setSelectedImage(idx)}
                                        className={`aspect-square rounded-lg overflow-hidden border-2 transition ${selectedImage === idx ? "border-veci-primary" : "border-transparent"}`}
                                    >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={img.url} alt="" className="h-full w-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="rounded-2xl bg-white/70 backdrop-blur p-4 sm:p-6 border border-white">
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800">{raffle.name}</h1>
                            {raffle.description && (
                                <p className="text-sm text-slate-600 mt-3 whitespace-pre-line">{raffle.description}</p>
                            )}

                            {raffle.prizes.length > 0 && (
                                <div className="mt-5">
                                    <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                        <Trophy className="h-4 w-4 text-amber-500" />
                                        Premios
                                    </h3>
                                    <ul className="space-y-2">
                                        {raffle.prizes.map((p) => (
                                            <li key={p.id} className="flex gap-3 items-start">
                                                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-white text-xs font-extrabold flex items-center justify-center">
                                                    {p.position}°
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-800">{p.name}</p>
                                                    {p.description && <p className="text-xs text-slate-500">{p.description}</p>}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {raffle.terms && (
                                <details className="mt-5 rounded-lg bg-slate-50 p-3">
                                    <summary className="cursor-pointer text-sm font-semibold text-slate-700">Términos y condiciones</summary>
                                    <p className="text-xs text-slate-600 mt-2 whitespace-pre-line">{raffle.terms}</p>
                                </details>
                            )}
                        </div>
                    </section>

                    {/* Sidebar info + grid */}
                    <aside className="space-y-4 lg:sticky lg:top-32">
                        <div className="rounded-2xl bg-white/80 backdrop-blur p-4 sm:p-6 border border-white space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                {raffle.type === "free" ? (
                                    <span className="text-2xl font-extrabold bg-gradient-to-r from-amber-500 to-yellow-500 bg-clip-text text-transparent">
                                        ¡SORTEO GRATIS!
                                    </span>
                                ) : (
                                    <div>
                                        <p className="text-xs text-slate-500">Precio por número</p>
                                        <p className="text-3xl font-extrabold text-veci-primary">
                                            ${(raffle.price ?? 0).toLocaleString("es-CL")}
                                        </p>
                                    </div>
                                )}
                                <button
                                    onClick={shareWhatsApp}
                                    className="p-2 rounded-full bg-emerald-500 text-white hover:bg-emerald-600 transition"
                                    title="Compartir por WhatsApp"
                                >
                                    <Share2 className="h-4 w-4" />
                                </button>
                            </div>

                            {raffle.drawAt && raffle.status === "active" && (
                                <div className="rounded-xl bg-slate-50 p-3 flex items-center gap-2 text-sm">
                                    <Clock className="h-4 w-4 text-slate-500" />
                                    <span className="text-slate-500">Cierra en</span>
                                    <span className="ml-auto font-bold text-slate-700">
                                        <Countdown target={raffle.endsAt || raffle.drawAt} onExpire={load} />
                                    </span>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="text-slate-500">{sold}/{raffle.totalNumbers} vendidos</span>
                                    <span className="font-semibold">{pct}%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-veci-primary to-emerald-500" style={{ width: `${pct}%` }} />
                                </div>
                            </div>

                            {subscriberLocked && (
                                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700 flex items-center gap-2">
                                    <Lock className="h-4 w-4" />
                                    Sorteo exclusivo para suscriptores premium.
                                </div>
                            )}
                        </div>

                        {raffle.status === "drawn" ? (
                            <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white p-4 sm:p-6 space-y-3">
                                <h3 className="font-extrabold flex items-center gap-2">
                                    <Trophy className="h-5 w-5" />
                                    Ganadores
                                </h3>
                                <ul className="space-y-2">
                                    {raffle.winners.map((w) => (
                                        <li key={w.position} className="bg-white/15 rounded-lg p-3">
                                            <p className="text-xs font-bold opacity-80">{w.position}° lugar · {w.prizeName}</p>
                                            <p className="text-lg font-extrabold">Nº {w.number}</p>
                                            {w.winnerName && <p className="text-sm opacity-90">{w.winnerName}</p>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-white/80 backdrop-blur p-4 sm:p-6 border border-white">
                                <h3 className="font-bold text-slate-700 mb-3">Elige tu número</h3>
                                <div className="flex gap-2 text-[10px] mb-3">
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Libre</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-200 border border-rose-300" /> Tuyo</span>
                                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-300 border border-slate-400" /> Ocupado</span>
                                </div>
                                <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 max-h-96 overflow-y-auto p-1">
                                    {Array.from({ length: raffle.totalNumbers }, (_, i) => i + 1).map((n) => {
                                        const state = numberStates.get(n) || "available";
                                        const isWinner = winnerNumbers.has(n);
                                        const disabled = state !== "available" || raffle.status !== "active";
                                        return (
                                            <button
                                                key={n}
                                                onClick={() => state === "available" && setConfirmNumber(n)}
                                                disabled={disabled}
                                                className={`aspect-square rounded text-xs font-bold border transition disabled:cursor-not-allowed ${
                                                    isWinner
                                                        ? "bg-gradient-to-br from-amber-400 to-yellow-500 text-white border-amber-500 ring-2 ring-amber-300"
                                                        : state === "available"
                                                            ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200"
                                                            : state === "mine-reserved"
                                                                ? "bg-rose-200 text-rose-700 border-rose-300"
                                                                : "bg-slate-200 text-slate-400 border-slate-300"
                                                }`}
                                                title={state === "available" ? `Reservar Nº ${n}` : "No disponible"}
                                            >
                                                {n}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </aside>
                </div>
            </div>

            {/* Modal de confirmación */}
            {confirmNumber !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto rounded-full bg-veci-primary/10 flex items-center justify-center text-2xl font-extrabold text-veci-primary">
                                {confirmNumber}
                            </div>
                            <h3 className="text-lg font-bold mt-3">
                                {raffle.type === "free" ? "Confirmar inscripción" : "Reservar número"}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {raffle.type === "free"
                                    ? `¿Inscribirte con el número ${confirmNumber} en ${raffle.name}?`
                                    : `Reservarás el número ${confirmNumber} por 15 minutos a $${(raffle.price ?? 0).toLocaleString("es-CL")}.`}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setConfirmNumber(null)}
                                disabled={reserving}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={() => reserveNumber(confirmNumber)}
                                disabled={reserving}
                            >
                                {reserving ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : null}
                                {raffle.type === "free" ? "Inscribirme" : "Reservar"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Footer />
        </main>
    );
}
