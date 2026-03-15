"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ProductCard } from "@/components/products/ProductCard";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TrendingUp,
  Star,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
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

type FilterKey = "new" | "featured" | "best";

const FILTER_CONFIG: {
  key: FilterKey;
  label: string;
  icon: React.ReactNode;
  apiParams: string;
  viewMoreHref: string;
}[] = [
  {
    key: "new",
    label: "Nuevos",
    icon: <Sparkles className="w-4 h-4" />,
    apiParams: "limit=15",
    viewMoreHref: "/productos",
  },
  {
    key: "featured",
    label: "Más vendidos",
    icon: <TrendingUp className="w-4 h-4" />,
    apiParams: "featured=true&limit=15",
    viewMoreHref: "/productos?featured=true",
  },
  {
    key: "best",
    label: "Mejor valorados",
    icon: <Star className="w-4 h-4" />,
    apiParams: "offer=true&limit=15",
    viewMoreHref: "/productos?offer=true",
  },
];

export function ProductShowcase() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("new");
  const [cache, setCache] = useState<Record<FilterKey, Product[]>>({
    new: [],
    featured: [],
    best: [],
  });
  const [loadedTabs, setLoadedTabs] = useState<Set<FilterKey>>(new Set());
  const [loadingTab, setLoadingTab] = useState<FilterKey | null>("new");
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [paused, setPaused] = useState(false);

  // Fetch products for a tab (only once per tab)
  const fetchTab = useCallback(async (key: FilterKey) => {
    const config = FILTER_CONFIG.find((f) => f.key === key)!;
    setLoadingTab(key);
    try {
      const res = await fetch(`/api/store/products?${config.apiParams}`);
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        setCache((prev) => ({ ...prev, [key]: json.data }));
      }
    } catch {
      // silent
    } finally {
      setLoadedTabs((prev) => new Set(prev).add(key));
      setLoadingTab(null);
    }
  }, []);

  // Fetch on mount + on tab switch
  useEffect(() => {
    if (!loadedTabs.has(activeFilter)) {
      fetchTab(activeFilter);
    }
  }, [activeFilter, loadedTabs, fetchTab]);

  // Reset scroll position on tab change
  useEffect(() => {
    scrollRef.current?.scrollTo({ left: 0 });
  }, [activeFilter]);

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

  // Auto-scroll
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const items = cache[activeFilter];
    if (paused || items.length <= 3) return;
    intervalRef.current = setInterval(() => scroll("right"), 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [paused, activeFilter, cache, scroll]);

  const currentProducts = cache[activeFilter];
  const isLoading = loadingTab === activeFilter;
  const currentConfig = FILTER_CONFIG.find((f) => f.key === activeFilter)!;

  const primaryImage = (p: Product) =>
    p.images.find((i) => i.isPrimary)?.url || p.images[0]?.url || null;

  return (
    <section className="py-12 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl md:text-4xl font-extrabold text-veci-dark mb-2">
            Explora nuestros productos
          </h2>
          <p className="text-slate-500 text-lg">
            Encuentra lo que necesitas al mejor precio
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 p-1.5 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-lg shadow-slate-100/50">
            {FILTER_CONFIG.map((filter) => {
              const isActive = activeFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className="relative px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center gap-2"
                >
                  {isActive && (
                    <motion.div
                      layoutId="showcaseTab"
                      className="absolute inset-0 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl shadow-md shadow-purple-200/50"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span
                    className={`relative z-10 flex items-center gap-2 ${
                      isActive ? "text-white" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {filter.icon}
                    <span className="hidden sm:inline">{filter.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Carousel area — always mounted, content swaps via opacity */}
        <div
          className="relative group/showcase"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Arrows */}
          {currentProducts.length > 3 && (
            <>
              <button
                onClick={() => scroll("left")}
                className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-xl border border-slate-100 hover:bg-gray-50 transition-all opacity-0 group-hover/showcase:opacity-100 hover:scale-110"
                aria-label="Anterior"
              >
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </button>
              <button
                onClick={() => scroll("right")}
                className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-xl border border-slate-100 hover:bg-gray-50 transition-all opacity-0 group-hover/showcase:opacity-100 hover:scale-110"
                aria-label="Siguiente"
              >
                <ChevronRight className="h-5 w-5 text-gray-700" />
              </button>
            </>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex justify-center items-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            </div>
          )}

          {/* Empty state */}
          {!isLoading && currentProducts.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <p className="text-lg">No hay productos en esta categoría aún.</p>
            </div>
          )}

          {/* Product cards — single scroll container, always in DOM */}
          {!isLoading && currentProducts.length > 0 && (
            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {currentProducts.map((p) => (
                <div key={p.id} className="snap-start shrink-0 w-[260px] sm:w-[280px]">
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

        {/* View More Button */}
        {currentProducts.length > 0 && (
          <div className="flex justify-center mt-8">
            <Link
              href={currentConfig.viewMoreHref}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-bold rounded-full shadow-lg shadow-purple-200/50 hover:shadow-xl hover:shadow-purple-300/50 hover:-translate-y-0.5 transition-all duration-300"
            >
              Ver más productos
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
