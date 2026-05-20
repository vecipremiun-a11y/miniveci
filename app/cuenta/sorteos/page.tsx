"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ticket, Trophy, Clock, Loader2 } from "lucide-react";

interface MyEntry {
    id: string;
    number: number;
    status: "reserved" | "paid" | "free";
    expiresAt: string | null;
    paidAt: string | null;
    raffle: {
        id: string;
        slug: string;
        name: string;
        coverImage: string | null;
        type: "free" | "paid";
        status: string;
        drawAt: string | null;
    };
    won: { prizeName: string; prizePosition: number } | null;
}

const STATUS_LABEL: Record<string, string> = {
    reserved: "Reservado",
    paid: "Pagado",
    free: "Inscrito (gratis)",
};

const STATUS_COLOR: Record<string, string> = {
    reserved: "bg-amber-100 text-amber-700",
    paid: "bg-emerald-100 text-emerald-700",
    free: "bg-emerald-100 text-emerald-700",
};

export default function MisSorteosPage() {
    const [entries, setEntries] = useState<MyEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/store/my-raffles")
            .then((r) => r.json())
            .then((data) => {
                setEntries(data.entries || []);
                setLoading(false);
            });
    }, []);

    const wins = entries.filter((e) => e.won);
    const active = entries.filter((e) => !e.won && e.raffle.status !== "drawn");
    const finished = entries.filter((e) => !e.won && e.raffle.status === "drawn");

    if (loading) {
        return (
            <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-veci-primary mx-auto" />
            </div>
        );
    }

    if (entries.length === 0) {
        return (
            <div className="bg-white/60 backdrop-blur-xl border border-white/60 rounded-2xl p-10 text-center">
                <Ticket className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h2 className="font-bold text-slate-700">Aún no participas en ningún sorteo</h2>
                <p className="text-sm text-slate-500 mt-1">Descubre los sorteos activos y elige tu número.</p>
                <Link
                    href="/sorteos"
                    className="inline-block mt-4 px-5 py-2 rounded-full bg-veci-primary text-white font-semibold text-sm hover:bg-veci-primary/90"
                >
                    Ver sorteos
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {wins.length > 0 && (
                <Section title="¡Ganaste!" icon={<Trophy className="h-5 w-5 text-amber-500" />}>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {wins.map((e) => (
                            <Link key={e.id} href={`/sorteos/${e.raffle.slug}`} className="block rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 text-white p-4 hover:shadow-xl transition">
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-extrabold">
                                        {e.number}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs opacity-90">{e.won!.prizePosition}° lugar · {e.won!.prizeName}</p>
                                        <h3 className="font-extrabold truncate">{e.raffle.name}</h3>
                                    </div>
                                    <Trophy className="h-5 w-5 flex-shrink-0" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </Section>
            )}

            {active.length > 0 && (
                <Section title="Mis números activos" icon={<Ticket className="h-5 w-5 text-veci-primary" />}>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {active.map((e) => <EntryCard key={e.id} entry={e} />)}
                    </div>
                </Section>
            )}

            {finished.length > 0 && (
                <Section title="Sorteos finalizados" icon={<Clock className="h-5 w-5 text-slate-500" />}>
                    <div className="grid sm:grid-cols-2 gap-3">
                        {finished.map((e) => <EntryCard key={e.id} entry={e} dim />)}
                    </div>
                </Section>
            )}
        </div>
    );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div>
            <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                {icon}
                {title}
            </h2>
            {children}
        </div>
    );
}

function EntryCard({ entry: e, dim }: { entry: MyEntry; dim?: boolean }) {
    return (
        <Link
            href={`/sorteos/${e.raffle.slug}`}
            className={`flex items-center gap-3 rounded-xl bg-white/70 backdrop-blur border border-white p-3 hover:border-veci-primary transition ${dim ? "opacity-60" : ""}`}
        >
            <div className="w-14 h-14 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0">
                {e.raffle.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.raffle.coverImage} alt="" className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Ticket className="h-6 w-6 text-slate-300" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Número</p>
                <p className="text-xl font-extrabold text-slate-800 leading-tight">{e.number}</p>
                <p className="text-xs text-slate-600 truncate">{e.raffle.name}</p>
            </div>
            <span className={`text-[10px] font-bold px-2 py-1 rounded ${STATUS_COLOR[e.status]}`}>
                {STATUS_LABEL[e.status]}
            </span>
        </Link>
    );
}
