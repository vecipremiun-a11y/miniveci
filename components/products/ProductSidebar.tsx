'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Apple, Baby, Bath, Beef, Candy, Carrot, Coffee, Cookie, Croissant, CupSoda,
    Droplets, Egg, Fish, Flame, Ham, IceCreamCone, Leaf, Loader2, Milk, Package,
    PawPrint, Popcorn, Check, ScrollText, ShoppingBasket, Snowflake, Soup,
    Sparkles, SprayCan, Wheat,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Category {
    id: string;
    name: string;
    slug: string;
    productCount: number;
}

interface ProductSidebarProps {
    selectedCategory?: string | null;
    onCategoryChange?: (slug: string | null) => void;
    inOffer?: boolean;
    onOfferChange?: (value: boolean) => void;
    maxPrice?: number;
    onMaxPriceChange?: (value: number) => void;
}

/* Íconos de sección: SVG en verde tallo, no emoji.
   Las claves se comparan sin guiones ni tildes. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
    abarrotes: Package,
    aguas: Droplets,
    agua: Droplets,
    ambientador: SprayCan,
    aseo: Sparkles,
    bebidas: CupSoda,
    bebes: Baby,
    cafes: Coffee,
    cafe: Coffee,
    carne: Beef,
    carnes: Beef,
    cecinas: Ham,
    cereales: Wheat,
    chocolates: Cookie,
    confortservilleta: ScrollText,
    confort: ScrollText,
    congelados: Snowflake,
    conservas: Soup,
    detergentes: Sparkles,
    dulces: Candy,
    embutidos: Ham,
    empanadas: Croissant,
    frutas: Apple,
    helados: IceCreamCone,
    higiene: Bath,
    huevos: Egg,
    lacteos: Milk,
    limpieza: Sparkles,
    mascotas: PawPrint,
    panaderia: Croissant,
    parrilla: Flame,
    pescados: Fish,
    snacks: Popcorn,
    verduras: Carrot,
};

const MAX_PRICE_LIMIT = 50000;

const formatCLP = (value: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

export function ProductSidebar({ selectedCategory, onCategoryChange, inOffer = false, onOfferChange, maxPrice = MAX_PRICE_LIMIT, onMaxPriceChange }: ProductSidebarProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    const pricePercent = Math.round((maxPrice / MAX_PRICE_LIMIT) * 100);

    const handlePriceInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onMaxPriceChange?.(Number(e.target.value));
    }, [onMaxPriceChange]);

    useEffect(() => {
        fetch('/api/store/categories')
            .then(res => res.json())
            .then(data => {
                setCategories(Array.isArray(data) ? data : data.data || []);
            })
            .catch(() => setCategories([]))
            .finally(() => setLoading(false));
    }, []);

    const getIcon = (slug: string): LucideIcon => {
        const key = slug.toLowerCase()
            .normalize('NFD')
            .replace(/[^a-z]/g, '');
        if (CATEGORY_ICONS[key]) return CATEGORY_ICONS[key];
        const partial = Object.keys(CATEGORY_ICONS).find((k) => key.startsWith(k) || k.startsWith(key));
        return partial ? CATEGORY_ICONS[partial] : Package;
    };

    return (
        <div className="w-full md:w-60 shrink-0 feria-card rounded-2xl p-4 md:p-5 space-y-6 h-fit md:sticky md:top-40">

            {/* Precio */}
            <div>
                <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-tallo mb-3">
                    Precio
                    <span className="flex-1 h-px bg-cerco" />
                </h4>
                <div className="relative w-full h-1.5 mb-3">
                    <div className="absolute inset-0 bg-papel-hondo rounded-full" />
                    <div className="absolute left-0 top-0 h-full bg-lechuga rounded-full" style={{ width: `${pricePercent}%` }} />
                    <input
                        type="range"
                        min={100}
                        max={MAX_PRICE_LIMIT}
                        step={100}
                        value={maxPrice}
                        onChange={handlePriceInput}
                        aria-label="Precio máximo"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-[3px] border-lechuga-viva rounded-full shadow-sm pointer-events-none"
                        style={{ left: `calc(${pricePercent}% - 8px)` }}
                    />
                </div>
                <div className="flex items-center justify-between text-xs font-semibold text-tinta tabular-nums">
                    <span>$100</span>
                    <span>Hasta {formatCLP(maxPrice)}</span>
                </div>
            </div>

            {/* Ofertas */}
            <div>
                <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-tallo mb-3">
                    Ofertas
                    <span className="flex-1 h-px bg-cerco" />
                </h4>
                <button
                    type="button"
                    onClick={() => onOfferChange?.(!inOffer)}
                    aria-pressed={inOffer}
                    className="flex items-center gap-2.5 w-full text-left group"
                >
                    <span className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center transition-all shrink-0",
                        inOffer
                            ? "bg-lechuga border border-lechuga-viva text-hoja"
                            : "bg-white border border-cerco text-transparent"
                    )}>
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                    </span>
                    <span className="text-sm font-semibold text-hoja">Solo productos en oferta</span>
                </button>
            </div>

            {/* Secciones */}
            <div>
                <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-tallo mb-3">
                    Secciones
                    <span className="flex-1 h-px bg-cerco" />
                </h4>
                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-tinta-clara" />
                    </div>
                ) : categories.length === 0 ? (
                    <p className="text-sm text-tinta-clara">No hay categorías</p>
                ) : (
                    <div className="flex flex-col gap-px">
                        <button
                            onClick={() => onCategoryChange?.(null)}
                            className={cn(
                                "flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-left text-sm transition-colors",
                                !selectedCategory
                                    ? "bg-brote text-hoja font-bold shadow-[inset_2px_0_0_var(--color-lechuga-viva)]"
                                    : "text-tinta hover:bg-papel-hondo hover:text-hoja"
                            )}
                        >
                            <ShoppingBasket className="w-[17px] h-[17px] text-tallo shrink-0" strokeWidth={1.7} />
                            <span className="flex-1 truncate">Todos</span>
                        </button>

                        {categories.map((cat) => {
                            const Icon = getIcon(cat.slug);
                            const active = selectedCategory === cat.slug;
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => onCategoryChange?.(cat.slug)}
                                    className={cn(
                                        "flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg text-left text-sm transition-colors",
                                        active
                                            ? "bg-brote text-hoja font-bold shadow-[inset_2px_0_0_var(--color-lechuga-viva)]"
                                            : "text-tinta hover:bg-papel-hondo hover:text-hoja"
                                    )}
                                >
                                    <Icon className="w-[17px] h-[17px] text-tallo shrink-0" strokeWidth={1.7} />
                                    <span className="flex-1 truncate">{cat.name}</span>
                                    <span className="text-[11px] font-bold text-tinta-clara tabular-nums">
                                        {cat.productCount ?? 0}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            <Leaf className="w-4 h-4 text-cerco mx-auto" aria-hidden="true" />
        </div>
    );
}
