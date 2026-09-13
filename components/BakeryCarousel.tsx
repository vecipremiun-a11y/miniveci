"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Croissant, NotebookPen, Wheat, type LucideIcon } from "lucide-react";
import { ProductCard } from "@/components/products/ProductCard";
import { formatCLP, bakeryCategoryLabel } from "@/lib/bakery-shared";
import type { BakeryCategory } from "@/lib/validations/bakery";
import type { StoreProductPayload } from "@/lib/store-product-types";

const PLACEHOLDER_IMAGE = "/placeholder-product.svg";

// Categorías de la tienda que se venden en el día con stock del POS, a diferencia de
// los encargos. Van por slug: la categoría "Amasanderia" de la tienda es harina, no pan.
const TODAY_CATEGORY_SLUGS = ["panes", "empanadas"];

interface BakeryProduct {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    category: BakeryCategory;
    pricingMode: "unit" | "kg";
    price: number;
    gramsPerUnit: number | null;
}

type BakeryTab = "encargos" | "hoy";

const TABS: { key: BakeryTab; label: string; icon: LucideIcon; badge: string; subtitle: string; viewMoreHref: string }[] = [
    {
        key: "encargos",
        label: "Encargos",
        icon: NotebookPen,
        badge: "Hecho a pedido",
        subtitle: "Encarga pan fresco, dulces y más para el día que quieras",
        viewMoreHref: "/amasanderia",
    },
    {
        key: "hoy",
        label: "Pan de hoy",
        icon: Wheat,
        badge: "Del día",
        subtitle: "Pan, empanadas y más para comprar hoy mismo",
        viewMoreHref: "/productos?category=panes",
    },
];

export function BakeryCarousel() {
    const [bakeryProducts, setBakeryProducts] = useState<BakeryProduct[]>([]);
    const [todayProducts, setTodayProducts] = useState<StoreProductPayload[]>([]);
    const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>({});
    const [loaded, setLoaded] = useState(false);
    const [activeTab, setActiveTab] = useState<BakeryTab>("encargos");
    const scrollRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        const loadBakery = fetch("/api/bakery/products")
            .then((r) => r.json())
            .then((data) => {
                if (Array.isArray(data)) setBakeryProducts(data);
            })
            .catch(() => { /* silent */ });

        const loadToday = Promise.all(
            TODAY_CATEGORY_SLUGS.map((slug) =>
                fetch(`/api/store/products?category=${encodeURIComponent(slug)}&limit=20`)
                    .then((r) => r.json())
                    .then((json): StoreProductPayload[] => (Array.isArray(json?.data) ? json.data : []))
                    .catch((): StoreProductPayload[] => [])
            )
        ).then((lists) => {
            // "Pan de hoy" es lo que hay para llevar ahora: los sin stock no se muestran
            setTodayProducts(lists.flat().filter((p) => p.stock > 0));
        });

        Promise.all([loadBakery, loadToday]).finally(() => setLoaded(true));

        fetch("/api/bakery/categories")
            .then((r) => r.json())
            .then((cats) => {
                if (Array.isArray(cats)) {
                    setCategoryLabels(Object.fromEntries(cats.map((c: { slug: string; label: string }) => [c.slug, c.label])));
                }
            })
            .catch(() => { /* silent */ });
    }, []);

    // Una pestaña sin productos no se muestra; si ninguna tiene, no se muestra la sección
    const availableTabs = TABS.filter((tab) => (tab.key === "encargos" ? bakeryProducts.length : todayProducts.length) > 0);
    const currentTab = availableTabs.find((tab) => tab.key === activeTab) ?? availableTabs[0];
    const itemCount = currentTab?.key === "encargos" ? bakeryProducts.length : todayProducts.length;

    const scroll = useCallback((direction: "left" | "right") => {
        const el = scrollRef.current;
        if (!el) return;
        const card = el.querySelector<HTMLElement>(":scope > div");
        const amount = (card?.offsetWidth ?? 280) + 16;
        if (direction === "right") {
            if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) {
                el.scrollTo({ left: 0, behavior: "smooth" });
            } else {
                el.scrollBy({ left: amount, behavior: "smooth" });
            }
        } else {
            if (el.scrollLeft <= 10) {
                el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
            } else {
                el.scrollBy({ left: -amount, behavior: "smooth" });
            }
        }
    }, []);

    // Reset scroll al cambiar de pestaña
    useEffect(() => {
        scrollRef.current?.scrollTo({ left: 0 });
    }, [currentTab?.key]);

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (paused || itemCount <= 3) return;
        intervalRef.current = setInterval(() => scroll("right"), 5000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [paused, itemCount, currentTab?.key, scroll]);

    if (!loaded || !currentTab) return null;

    return (
        <section className="relative py-8 sm:py-12 px-3 sm:px-6 md:px-12 bg-gradient-to-b from-orange-50/60 via-amber-50/30 to-transparent">
            <div className="max-w-7xl mx-auto">
                {/* Header: título a la izquierda, "Ver más" arriba a la derecha */}
                <div className="flex items-center justify-between gap-4 mb-5 sm:mb-7">
                    <div className="text-left">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold uppercase tracking-wide mb-2">
                            <Croissant className="w-3.5 h-3.5" /> {currentTab.badge}
                        </span>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-1 sm:mb-2">
                            <span className="bg-gradient-to-r from-amber-700 via-orange-600 to-amber-700 bg-clip-text text-transparent">
                                Amasandería
                            </span>
                        </h2>
                        <p className="text-slate-500 text-sm sm:text-lg">
                            {currentTab.subtitle}
                        </p>
                    </div>
                    <Link
                        href={currentTab.viewMoreHref}
                        className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 sm:px-5 sm:py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-full shadow-lg shadow-amber-200/60 hover:shadow-xl hover:shadow-orange-300/50 hover:-translate-y-0.5 transition-all duration-300 text-sm"
                    >
                        <span className="hidden sm:inline">Ver más</span>
                        <span className="sm:hidden">Ver</span>
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>

                {/* Pestañas: encargos / pan de hoy */}
                {availableTabs.length > 1 && (
                    <div className="flex justify-start mb-5 sm:mb-6">
                        <div role="tablist" className="inline-flex items-center gap-1 p-1 bg-white rounded-full border border-amber-100 shadow-sm">
                            {availableTabs.map((tab) => {
                                const isActive = tab.key === currentTab.key;
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.key}
                                        type="button"
                                        role="tab"
                                        aria-selected={isActive}
                                        onClick={() => setActiveTab(tab.key)}
                                        className="relative px-4 sm:px-5 py-2 rounded-full text-sm font-semibold transition-colors"
                                    >
                                        {isActive && (
                                            <motion.span
                                                layoutId="bakeryTab"
                                                className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 shadow-md shadow-amber-200/60"
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            />
                                        )}
                                        <span className={`relative z-10 flex items-center gap-1.5 ${isActive ? "text-white font-bold" : "text-slate-600 hover:text-amber-700"}`}>
                                            <Icon className="w-4 h-4" />
                                            {tab.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Carrusel de productos */}
                <div
                    className="relative group/bakery"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                >
                    {itemCount > 3 && (
                        <>
                            <button
                                onClick={() => scroll("left")}
                                className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-xl border border-slate-100 hover:bg-gray-50 transition-all opacity-0 group-hover/bakery:opacity-100 hover:scale-110"
                                aria-label="Anterior"
                            >
                                <ChevronLeft className="h-5 w-5 text-gray-700" />
                            </button>
                            <button
                                onClick={() => scroll("right")}
                                className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-xl border border-slate-100 hover:bg-gray-50 transition-all opacity-0 group-hover/bakery:opacity-100 hover:scale-110"
                                aria-label="Siguiente"
                            >
                                <ChevronRight className="h-5 w-5 text-gray-700" />
                            </button>
                        </>
                    )}

                    <div
                        ref={scrollRef}
                        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                        {currentTab.key === "encargos"
                            ? bakeryProducts.map((p) => (
                                <div key={p.id} className="snap-start shrink-0 w-[180px] sm:w-[280px]">
                                    <BakeryOrderCard product={p} categoryLabels={categoryLabels} />
                                </div>
                            ))
                            : todayProducts.map((p) => (
                                <div key={p.id} className="snap-start shrink-0 w-[180px] sm:w-[280px]">
                                    <ProductCard
                                        id={p.id}
                                        name={p.name}
                                        slug={p.slug}
                                        price={p.price}
                                        offerPrice={p.offerPrice}
                                        isOffer={p.isOffer}
                                        stock={p.stock}
                                        unit={p.unit}
                                        equivLabel={p.equivLabel}
                                        equivWeight={p.equivWeight}
                                        image={p.images.find((i) => i.isPrimary)?.url || p.images[0]?.url || null}
                                        priceTiers={p.priceTiers}
                                    />
                                </div>
                            ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

function BakeryOrderCard({ product: p, categoryLabels }: { product: BakeryProduct; categoryLabels: Record<string, string> }) {
    const imageSrc = p.imageUrl || PLACEHOLDER_IMAGE;
    const unitLabel = p.pricingMode === "kg" ? "/kg" : "c/u";
    return (
        <Link
            href="/amasanderia"
            className="group/card block h-full rounded-2xl sm:rounded-[2rem] bg-white border border-amber-100/80 shadow-sm hover:shadow-xl hover:shadow-amber-100/60 hover:-translate-y-1 transition-all duration-300 overflow-hidden"
        >
            {/* Imagen */}
            <div className="relative w-full h-32 sm:h-44 bg-gradient-to-br from-amber-50 to-orange-50/50 flex items-center justify-center overflow-hidden">
                <span className="absolute top-3 left-3 z-10 inline-flex items-center px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-amber-700 text-[10px] font-bold uppercase tracking-wide shadow-sm">
                    {bakeryCategoryLabel(p.category, categoryLabels)}
                </span>
                <img
                    src={imageSrc}
                    alt={p.name}
                    className="max-h-full max-w-full object-contain p-3 transform group-hover/card:scale-110 transition-transform duration-300"
                />
            </div>

            {/* Contenido */}
            <div className="p-3 sm:p-4 space-y-1.5 sm:space-y-2">
                <h3 className="font-bold text-slate-800 text-sm sm:text-base leading-snug line-clamp-2 min-h-[2.1rem] sm:min-h-[2.6rem]" title={p.name}>
                    {p.name}
                </h3>
                {p.description && (
                    <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1">{p.description}</p>
                )}
                <div className="flex items-baseline gap-1">
                    <span className="font-extrabold text-lg sm:text-xl text-hoja">{formatCLP(p.price)}</span>
                    <span className="text-[11px] sm:text-sm font-bold text-slate-400">{unitLabel}</span>
                </div>

                {/* CTA visual (toda la card es link) */}
                <span className="mt-1 w-full inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 group-hover/card:from-amber-600 group-hover/card:to-orange-600 text-white text-[11px] sm:text-sm font-bold py-2 sm:py-2.5 rounded-full shadow-md shadow-amber-200/50 transition-all">
                    <NotebookPen className="w-3.5 h-3.5" />
                    Encargar
                </span>
            </div>
        </Link>
    );
}
