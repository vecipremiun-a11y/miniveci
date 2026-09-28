'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { ProductCard } from '@/components/products/ProductCard';
import type { StoreProductPayload } from '@/lib/store-product-types';

interface TierGroupCarouselProps {
    tierGroup: string;
    /** El producto que se está mirando: no se repite en el carrusel. */
    currentProductId: string;
}

const primaryImage = (p: StoreProductPayload) =>
    p.images.find((i) => i.isPrimary)?.url || p.images[0]?.url || null;

/**
 * "Combínalo con": los otros productos del mismo grupo de escala, bajo la ficha
 * del producto. Suman unidades para la escala, así que conviene tenerlos a mano
 * para ir de una variante a otra (ej. los tonos de una tintura).
 */
export function TierGroupCarousel({ tierGroup, currentProductId }: TierGroupCarouselProps) {
    const [products, setProducts] = useState<StoreProductPayload[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/store/products?group=${encodeURIComponent(tierGroup)}&limit=60`, { signal: controller.signal })
            .then((r) => r.json())
            .then((res) => {
                const list: StoreProductPayload[] = Array.isArray(res?.data) ? res.data : [];
                setProducts(list.filter((p) => p.id !== currentProductId));
            })
            .catch(() => {});
        return () => controller.abort();
    }, [tierGroup, currentProductId]);

    const scroll = useCallback((direction: 'left' | 'right') => {
        const el = scrollRef.current;
        if (!el) return;
        const cardWidth = el.querySelector<HTMLElement>(':scope > div')?.offsetWidth ?? 240;
        el.scrollBy({ left: (cardWidth + 16) * (direction === 'right' ? 2 : -2), behavior: 'smooth' });
    }, []);

    if (products.length === 0) return null;

    return (
        <section className="mt-10">
            <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                    <h2 className="flex items-center gap-2 text-xl sm:text-2xl font-extrabold text-hoja">
                        <Layers className="w-5 h-5 sm:w-6 sm:h-6 text-tallo" />
                        Combínalo con otros “{tierGroup}”
                    </h2>
                    <p className="text-sm text-tinta mt-1">
                        Suman juntos para la escala de precios: mezcla los que quieras y paga menos.
                    </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => scroll('left')}
                        className="w-10 h-10 rounded-full bg-white border border-cerco flex items-center justify-center text-hoja hover:border-lechuga-viva transition-colors"
                        aria-label="Anterior"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => scroll('right')}
                        className="w-10 h-10 rounded-full bg-white border border-cerco flex items-center justify-center text-hoja hover:border-lechuga-viva transition-colors"
                        aria-label="Siguiente"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {products.map((p) => (
                    <div key={p.id} className="snap-start shrink-0 w-[170px] sm:w-[230px]">
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
                            subscriptionPrice={p.subscriptionPrice}
                            badges={p.badges}
                            tierGroup={p.tierGroup}
                        />
                    </div>
                ))}
            </div>
        </section>
    );
}
