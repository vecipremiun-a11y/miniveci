"use client";

import { useEffect, useMemo, useState } from "react";
import { Cookie, Loader2, Calendar, Clock, MapPin } from "lucide-react";
import { Footer } from "@/components/Footer";
import { BakeryProductCard, type BakeryProductInput } from "@/components/amasanderia/BakeryProductCard";
import { BAKERY_CATEGORY_LABELS, BAKERY_CATEGORY_ORDER, formatLeadTime } from "@/lib/bakery-shared";
import type { BakeryCategory } from "@/lib/validations/bakery";

type Filter = "all" | BakeryCategory;

export default function AmasanderiaPage() {
    const [products, setProducts] = useState<BakeryProductInput[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>("all");
    const [defaultLeadHours, setDefaultLeadHours] = useState<number>(0);

    useEffect(() => {
        let cancel = false;
        setLoading(true);
        fetch("/api/bakery/products")
            .then((r) => r.json())
            .then((data) => { if (!cancel && Array.isArray(data)) setProducts(data); })
            .catch(() => {})
            .finally(() => { if (!cancel) setLoading(false); });

        // Config: el "mínimo general" se usa como fallback en cada card.
        fetch("/api/bakery/config")
            .then((r) => r.json())
            .then((c) => { if (!cancel && c && typeof c.minHoursAhead === "number") setDefaultLeadHours(c.minHoursAhead); })
            .catch(() => {});

        return () => { cancel = true; };
    }, []);

    const counts = useMemo(() => {
        const c: Partial<Record<BakeryCategory, number>> = {};
        for (const p of products) c[p.category] = (c[p.category] ?? 0) + 1;
        return c;
    }, [products]);

    const visible = useMemo(() => {
        if (filter === "all") return products;
        return products.filter((p) => p.category === filter);
    }, [products, filter]);

    const grouped = useMemo(() => {
        // Cuando "all", agrupa por categoría respetando BAKERY_CATEGORY_ORDER
        const map = new Map<BakeryCategory, BakeryProductInput[]>();
        for (const cat of BAKERY_CATEGORY_ORDER) map.set(cat, []);
        for (const p of visible) {
            const list = map.get(p.category) ?? [];
            list.push(p);
            map.set(p.category, list);
        }
        return Array.from(map.entries()).filter(([, list]) => list.length > 0);
    }, [visible]);

    return (
        <main className="min-h-screen bg-veci-bg selection:bg-veci-primary selection:text-white pb-32">

            {/* Spacer */}
            <div className="h-36 md:h-44" />

            {/* Hero */}
            <section className="px-4 sm:px-8 md:px-12 max-w-7xl mx-auto">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-100 via-rose-50 to-orange-100 border border-white shadow-sm p-6 sm:p-10">
                    <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-300/30 blur-3xl" />
                    <div className="absolute -bottom-12 -left-8 w-48 h-48 rounded-full bg-rose-300/30 blur-3xl" />
                    <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/80 backdrop-blur flex items-center justify-center shadow-sm shrink-0">
                            <Cookie className="w-9 h-9 sm:w-11 sm:h-11 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">Amasandería</p>
                            <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-800 leading-tight">Encarga tu pan fresco</h1>
                            <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-2xl">
                                Reserva por unidad, paga al retirar. Hacemos lo justo para que todo salga calentito.
                            </p>
                        </div>
                    </div>
                    <div className="relative mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm text-slate-700">
                        <div className="flex items-center gap-2 bg-white/60 backdrop-blur rounded-2xl px-3 py-2.5">
                            <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
                            <span><strong>Elige día y hora</strong> de retiro</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white/60 backdrop-blur rounded-2xl px-3 py-2.5">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span><strong>Mínimo {defaultLeadHours > 0 ? formatLeadTime(defaultLeadHours) : "—"}</strong> de anticipación</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white/60 backdrop-blur rounded-2xl px-3 py-2.5">
                            <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                            <span><strong>Retiro o delivery</strong> a domicilio</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Filter tabs */}
            <section className="px-4 sm:px-8 md:px-12 max-w-7xl mx-auto mt-8">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                    <FilterChip
                        label="Todo"
                        active={filter === "all"}
                        count={products.length}
                        onClick={() => setFilter("all")}
                    />
                    {BAKERY_CATEGORY_ORDER.map((cat) => {
                        const c = counts[cat] ?? 0;
                        if (c === 0) return null;
                        return (
                            <FilterChip
                                key={cat}
                                label={BAKERY_CATEGORY_LABELS[cat]}
                                active={filter === cat}
                                count={c}
                                onClick={() => setFilter(cat)}
                            />
                        );
                    })}
                </div>
            </section>

            {/* Listing */}
            <section className="px-4 sm:px-8 md:px-12 max-w-7xl mx-auto mt-4">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                        <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
                        <p className="text-sm text-slate-500">Cargando productos...</p>
                    </div>
                ) : products.length === 0 ? (
                    <EmptyState title="No hay productos disponibles" description="Pronto agregaremos más opciones." />
                ) : visible.length === 0 ? (
                    <EmptyState title="No hay productos en esta categoría" description="Prueba con otra o vuelve a 'Todo'." />
                ) : filter === "all" ? (
                    <div className="space-y-10">
                        {grouped.map(([cat, list]) => (
                            <div key={cat}>
                                <div className="flex items-baseline gap-2 mb-4">
                                    <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{BAKERY_CATEGORY_LABELS[cat]}</h2>
                                    <span className="text-xs text-slate-500">{list.length} producto{list.length === 1 ? "" : "s"}</span>
                                </div>
                                <Grid items={list} defaultLeadHours={defaultLeadHours} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <Grid items={visible} defaultLeadHours={defaultLeadHours} />
                )}
            </section>

            <Footer />
        </main>
    );
}

function Grid({ items, defaultLeadHours }: { items: BakeryProductInput[]; defaultLeadHours: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
            {items.map((p) => (
                <BakeryProductCard key={p.id} product={p} defaultLeadHours={defaultLeadHours} />
            ))}
        </div>
    );
}

function FilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition border ${
                active
                    ? "bg-gradient-to-r from-veci-primary to-rose-400 text-white border-transparent shadow-md shadow-veci-primary/30"
                    : "bg-white/70 text-slate-700 border-white hover:border-veci-primary/30"
            }`}
        >
            <span>{label}</span>
            <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-full ${active ? "bg-white/25" : "bg-slate-100 text-slate-600"}`}>
                {count}
            </span>
        </button>
    );
}

function EmptyState({ title, description }: { title: string; description: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white/40 backdrop-blur-md rounded-3xl border border-white">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
                <Cookie className="w-8 h-8 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">{title}</h3>
            <p className="text-sm text-slate-500">{description}</p>
        </div>
    );
}
