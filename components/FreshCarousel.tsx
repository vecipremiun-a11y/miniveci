"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ProductCard } from "@/components/products/ProductCard";
import { ChevronLeft, ChevronRight, Leaf, Loader2, Apple } from "lucide-react";
import Link from "next/link";

interface Product {
    id: string;
    name: string;
    slug: string;
    price: number;
    offerPrice: number | null;
    isOffer: boolean;
    stock: number;
    unit: string;
    equivLabel: string | null;
    equivWeight: number | null;
    images: { url: string; isPrimary: boolean }[];
    priceTiers?: { minQty: number; maxQty: number | null; price: number }[];
}

interface Category {
    id: string;
    name: string;
    slug: string;
    productCount: number;
}

// Una categoría es "fresca" (frutas/verduras) si su nombre contiene alguna de estas raíces.
// Heurística por nombre para no atar a IDs: si agregan nuevas categorías F&V, aparecen solas.
const FRESH_KEYWORDS = ["verdura", "fruta", "hortaliza"];

function isFreshCategory(c: { name: string; slug: string }): boolean {
    const hay = `${c.name} ${c.slug}`.toLowerCase();
    return FRESH_KEYWORDS.some((k) => hay.includes(k));
}

export function FreshCarousel() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [activeSlug, setActiveSlug] = useState<string | null>(null);
    const [cache, setCache] = useState<Record<string, Product[]>>({});
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [ready, setReady] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [paused, setPaused] = useState(false);

    // 1. Cargar categorías y quedarnos solo con frutas/verduras
    useEffect(() => {
        fetch("/api/store/categories")
            .then((r) => r.json())
            .then((json) => {
                const all: Category[] = Array.isArray(json?.data) ? json.data : [];
                const fresh = all
                    .filter((c) => isFreshCategory(c) && c.productCount > 0)
                    .sort((a, b) => b.productCount - a.productCount);
                setCategories(fresh);
                if (fresh.length > 0) setActiveSlug(fresh[0].slug);
            })
            .catch(() => { /* silent */ })
            .finally(() => setReady(true));
    }, []);

    // 2. Cargar productos de la categoría activa (cache por slug)
    const fetchCategory = useCallback(async (slug: string) => {
        setLoadingProducts(true);
        try {
            const res = await fetch(`/api/store/products?category=${encodeURIComponent(slug)}&limit=10`);
            const json = await res.json();
            if (Array.isArray(json?.data)) {
                setCache((prev) => ({ ...prev, [slug]: json.data }));
            }
        } catch {
            /* silent */
        } finally {
            setLoadingProducts(false);
        }
    }, []);

    useEffect(() => {
        if (activeSlug && cache[activeSlug] === undefined) {
            fetchCategory(activeSlug);
        }
    }, [activeSlug, cache, fetchCategory]);

    // Reset scroll al cambiar de categoría
    useEffect(() => {
        scrollRef.current?.scrollTo({ left: 0 });
    }, [activeSlug]);

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

    const products = activeSlug ? (cache[activeSlug] ?? []) : [];
    const productCount = products.length;

    // Auto-scroll
    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (paused || productCount <= 3) return;
        intervalRef.current = setInterval(() => scroll("right"), 4500);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [paused, productCount, scroll]);

    const primaryImage = (p: Product) =>
        p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || null;

    // No renderizar la sección si no hay categorías de frutas/verduras
    if (ready && categories.length === 0) return null;

    return (
        <section className="py-8 sm:py-12 px-3 sm:px-6 md:px-12 bg-gradient-to-b from-emerald-50/40 to-transparent">
            <div className="max-w-7xl mx-auto">
                {/* Header: título a la izquierda, "Ver más" arriba a la derecha */}
                <div className="flex items-center justify-between gap-4 mb-5 sm:mb-7">
                    <div className="text-left">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wide mb-2">
                            <Leaf className="w-3.5 h-3.5" /> Fresco del día
                        </span>
                        <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-veci-dark mb-1 sm:mb-2">
                            Frutas y Verduras
                        </h2>
                        <p className="text-slate-500 text-sm sm:text-lg">
                            Lo más fresco, directo a tu mesa
                        </p>
                    </div>
                    {activeSlug && (
                        <Link
                            href={`/productos?category=${encodeURIComponent(activeSlug)}`}
                            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 sm:px-5 sm:py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-bold rounded-full shadow-lg shadow-emerald-200/50 hover:shadow-xl hover:shadow-emerald-300/50 hover:-translate-y-0.5 transition-all duration-300 text-sm"
                        >
                            <span className="hidden sm:inline">Ver más</span>
                            <span className="sm:hidden">Ver</span>
                            <ChevronRight className="w-4 h-4" />
                        </Link>
                    )}
                </div>

                {/* Carrusel de categorías (chips scrollables) */}
                <div
                    className="flex gap-2.5 overflow-x-auto pb-3 mb-5"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                    {categories.map((cat) => {
                        const isActive = cat.slug === activeSlug;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveSlug(cat.slug)}
                                className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border transition-all duration-300 ${
                                    isActive
                                        ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white border-transparent shadow-md shadow-emerald-200/60"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-700"
                                }`}
                            >
                                <Apple className={`w-4 h-4 ${isActive ? "text-white" : "text-emerald-500"}`} />
                                {cat.name}
                                <span
                                    className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                                        isActive ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-600"
                                    }`}
                                >
                                    {cat.productCount}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Carrusel de productos */}
                <div
                    className="relative group/fresh"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                >
                    {products.length > 3 && (
                        <>
                            <button
                                onClick={() => scroll("left")}
                                className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-xl border border-slate-100 hover:bg-gray-50 transition-all opacity-0 group-hover/fresh:opacity-100 hover:scale-110"
                                aria-label="Anterior"
                            >
                                <ChevronLeft className="h-5 w-5 text-gray-700" />
                            </button>
                            <button
                                onClick={() => scroll("right")}
                                className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-xl border border-slate-100 hover:bg-gray-50 transition-all opacity-0 group-hover/fresh:opacity-100 hover:scale-110"
                                aria-label="Siguiente"
                            >
                                <ChevronRight className="h-5 w-5 text-gray-700" />
                            </button>
                        </>
                    )}

                    {(loadingProducts && products.length === 0) && (
                        <div className="flex justify-center items-center py-24">
                            <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                        </div>
                    )}

                    {!loadingProducts && products.length === 0 && (
                        <div className="text-center py-20 text-slate-400">
                            <p className="text-lg">No hay productos en esta categoría aún.</p>
                        </div>
                    )}

                    {products.length > 0 && (
                        <div
                            ref={scrollRef}
                            className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4"
                            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                        >
                            {products.map((p) => (
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
                                        image={primaryImage(p)}
                                        priceTiers={p.priceTiers}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </section>
    );
}
