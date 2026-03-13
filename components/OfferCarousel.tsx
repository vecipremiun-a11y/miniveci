"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ProductCard } from "@/components/products/ProductCard";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
}

export function OfferCarousel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetch("/api/store/products?offer=true&limit=6")
      .then((r) => r.json())
      .then((res) => {
        if (res.data && Array.isArray(res.data)) {
          setProducts(res.data);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector<HTMLElement>(":scope > div")?.offsetWidth ?? 280;
    const gap = 16;
    const scrollAmount = cardWidth + gap;

    if (direction === "right") {
      // If near the end, loop back to start
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 10) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: scrollAmount, behavior: "smooth" });
      }
    } else {
      if (el.scrollLeft <= 10) {
        el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
      } else {
        el.scrollBy({ left: -scrollAmount, behavior: "smooth" });
      }
    }
  }, []);

  // Auto-scroll every 3s
  useEffect(() => {
    if (products.length <= 1 || paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => scroll("right"), 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [products.length, paused, scroll]);

  if (!loaded || products.length === 0) return null;

  const primaryImage = (p: Product) =>
    p.images.find((i) => i.isPrimary)?.url || p.images[0]?.url || null;

  return (
    <section className="py-10 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-veci-dark mb-8">
          Ofertas del día 🔥
        </h2>

        <div
          className="relative group/carousel"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Left Arrow */}
          <button
            onClick={() => scroll("left")}
            className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-50 transition-colors opacity-0 group-hover/carousel:opacity-100"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>

          {/* Scrollable cards */}
          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-2"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {products.map((p) => (
              <div
                key={p.id}
                className="snap-start shrink-0 w-[260px] sm:w-[280px]"
              >
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
                />
              </div>
            ))}
          </div>

          {/* Right Arrow */}
          <button
            onClick={() => scroll("right")}
            className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg hover:bg-gray-50 transition-colors opacity-0 group-hover/carousel:opacity-100"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-5 w-5 text-gray-700" />
          </button>
        </div>
      </div>
    </section>
  );
}
