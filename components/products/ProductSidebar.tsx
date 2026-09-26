'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Apple, Baby, Bath, Beef, Candy, Carrot, ChevronDown, Coffee, Cookie, Croissant, CupSoda,
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
    /** Lo que trae al elegirla: lo suyo más lo de sus hijas */
    branchProductCount?: number;
    /** 0 = categoría, 1 = subcategoría, 2 = hija de la subcategoría… */
    level?: number;
}

interface ProductSidebarProps {
    selectedCategory?: string | null;
    onCategoryChange?: (slug: string | null) => void;
    inOffer?: boolean;
    onOfferChange?: (value: boolean) => void;
    /** Solo productos con el sello "Comercial Veci" */
    onlyVeci?: boolean;
    onVeciChange?: (value: boolean) => void;
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

export function ProductSidebar({ selectedCategory, onCategoryChange, inOffer = false, onOfferChange, onlyVeci = false, onVeciChange }: ProductSidebarProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);

    // Con un filtro rápido activo, los conteos vienen de la API ya filtrados
    // (solo ofertas / solo Comercial Veci). Mientras llega la respuesta nueva se
    // deja la lista anterior para que no parpadee.
    const filtering = inOffer || onlyVeci;
    const countsQuery = inOffer ? '?offer=true' : onlyVeci ? '?veci=true' : '';
    useEffect(() => {
        const controller = new AbortController();
        fetch(`/api/store/categories${countsQuery}`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
                setCategories(Array.isArray(data) ? data : data.data || []);
            })
            .catch((err) => { if (err?.name !== 'AbortError') setCategories([]); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [countsQuery]);

    // Filtrando, se esconden las secciones sin productos que calcen. La que está
    // elegida (y sus padres) se deja aunque quede en 0, para poder salir de ella.
    const visibleCategories = useMemo(() => {
        if (!filtering) return categories;
        const selected = buildTree(categories).find((n) => n.cat.slug === selectedCategory);
        const keep = new Set(selected ? [...selected.ancestors, selected.cat.id] : []);
        return categories.filter((c) => (c.branchProductCount ?? c.productCount ?? 0) > 0 || keep.has(c.id));
    }, [categories, filtering, selectedCategory]);

    const tree = useMemo(() => buildTree(visibleCategories), [visibleCategories]);

    // Todas parten contraídas; se abren a mano o al elegir una categoría.
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

    const setOpen = useCallback((id: string, open: boolean) => {
        setExpanded((prev) => {
            if (prev.has(id) === open) return prev;
            const next = new Set(prev);
            if (open) next.add(id); else next.delete(id);
            return next;
        });
    }, []);

    // Si llega una subcategoría elegida (por URL o al volver atrás), abrir sus
    // padres para que se vea marcada. Se ajusta durante el render (no en un
    // efecto) y solo cuando cambia la categoría elegida o termina de cargar el
    // árbol, así después se puede contraer a mano.
    const autoOpenKey = `${selectedCategory ?? ''}|${tree.length}`;
    const [lastAutoOpenKey, setLastAutoOpenKey] = useState<string | null>(null);
    if (autoOpenKey !== lastAutoOpenKey) {
        setLastAutoOpenKey(autoOpenKey);
        const node = selectedCategory ? tree.find((n) => n.cat.slug === selectedCategory) : undefined;
        const toOpen = node ? (node.hasChildren ? [...node.ancestors, node.cat.id] : node.ancestors) : [];
        if (toOpen.some((id) => !expanded.has(id))) {
            setExpanded(new Set([...expanded, ...toOpen]));
        }
    }

    const getIcon = (slug: string): LucideIcon => {
        const key = slug.toLowerCase()
            .normalize('NFD')
            .replace(/[^a-z]/g, '');
        if (CATEGORY_ICONS[key]) return CATEGORY_ICONS[key];
        const partial = Object.keys(CATEGORY_ICONS).find((k) => key.startsWith(k) || k.startsWith(key));
        return partial ? CATEGORY_ICONS[partial] : Package;
    };

    return (
        <div className="w-full md:w-60 shrink-0 feria-card rounded-2xl p-4 md:p-5 space-y-6 h-fit md:sticky md:top-[calc(10rem+var(--promo-h,0px))]">

            {/* Filtros rápidos: fichas con ícono. Son excluyentes: prender una apaga la otra (eso lo resuelve la página). */}
            <div>
                <h4 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-tallo mb-3">
                    Filtros rápidos
                    <span className="flex-1 h-px bg-cerco" />
                </h4>
                <div className="grid grid-cols-2 gap-2">
                    <QuickFilterTile
                        active={inOffer}
                        onClick={() => onOfferChange?.(!inOffer)}
                        label="Ofertas"
                    >
                        <OfertasIcon className="h-11 w-auto" />
                    </QuickFilterTile>
                    <QuickFilterTile
                        active={onlyVeci}
                        onClick={() => onVeciChange?.(!onlyVeci)}
                        label="Comercial Veci"
                    >
                        <img src="/sello-comercial-veci.png" alt="" className="h-9 w-auto" />
                    </QuickFilterTile>
                </div>
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
                ) : tree.length === 0 ? (
                    <p className="text-sm text-tinta-clara">Ninguna sección tiene productos con este filtro.</p>
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

                        {tree.map(({ cat, level: depth, ancestors, hasChildren }) => {
                            // Una subcategoría solo se ve si todas sus categorías padre están abiertas.
                            if (!ancestors.every((id) => expanded.has(id))) return null;
                            const Icon = getIcon(cat.slug);
                            const active = selectedCategory === cat.slug;
                            const isOpen = expanded.has(cat.id);
                            // Las subcategorías van sangradas bajo su categoría, con "└"
                            // en vez de ícono para que se lea de quién cuelgan.
                            const level = Math.min(depth, 3);
                            return (
                                <div
                                    key={cat.id}
                                    style={level > 0 ? { paddingLeft: level * 12 } : undefined}
                                    className={cn(
                                        "flex items-center w-full rounded-lg text-sm transition-colors",
                                        active
                                            ? "bg-brote text-hoja font-bold shadow-[inset_2px_0_0_var(--color-lechuga-viva)]"
                                            : "text-tinta hover:bg-papel-hondo hover:text-hoja"
                                    )}
                                >
                                    <button
                                        onClick={() => {
                                            onCategoryChange?.(cat.slug);
                                            if (hasChildren) setOpen(cat.id, true);
                                        }}
                                        className="flex items-center gap-2.5 flex-1 min-w-0 pl-2 py-1.5 text-left"
                                    >
                                        {level > 0 ? (
                                            <span className="w-[17px] shrink-0 text-center text-tinta-clara leading-none" aria-hidden="true">└</span>
                                        ) : (
                                            <Icon className="w-[17px] h-[17px] text-tallo shrink-0" strokeWidth={1.7} />
                                        )}
                                        <span className="flex-1 truncate">{cat.name}</span>
                                        <span className="text-[11px] font-bold text-tinta-clara tabular-nums">
                                            {cat.branchProductCount ?? cat.productCount ?? 0}
                                        </span>
                                    </button>
                                    {hasChildren ? (
                                        <button
                                            type="button"
                                            onClick={() => setOpen(cat.id, !isOpen)}
                                            aria-expanded={isOpen}
                                            aria-label={`${isOpen ? 'Contraer' : 'Expandir'} ${cat.name}`}
                                            className="w-7 h-7 flex items-center justify-center shrink-0 rounded-md text-tinta-clara hover:text-hoja hover:bg-cerco-suave transition-colors"
                                        >
                                            <ChevronDown className={cn("w-4 h-4 transition-transform", !isOpen && "-rotate-90")} />
                                        </button>
                                    ) : (
                                        <span className="w-7 shrink-0" aria-hidden="true" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <Leaf className="w-4 h-4 text-cerco mx-auto" aria-hidden="true" />
        </div>
    );
}

/**
 * La API manda las categorías en orden de árbol (cada hija justo después de su
 * padre) con `level`. De ahí sacamos de quién cuelga cada una y cuáles tienen
 * hijas, para poder contraerlas.
 */
function buildTree(categories: Category[]) {
    const stack: { id: string; level: number }[] = [];
    return categories.map((cat, i) => {
        const level = cat.level ?? 0;
        while (stack.length > 0 && stack[stack.length - 1].level >= level) stack.pop();
        const ancestors = stack.map((s) => s.id);
        const next = categories[i + 1];
        const hasChildren = !!next && (next.level ?? 0) > level;
        stack.push({ id: cat.id, level });
        return { cat, level, ancestors, hasChildren };
    });
}

/** Ficha de filtro rápido: ícono grande + nombre; marcada queda verde con un check. */
function QuickFilterTile({ active, onClick, label, children }: {
    active: boolean;
    onClick: () => void;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "relative flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-1.5 pt-3 pb-2 transition-all active:scale-95",
                active
                    ? "border-lechuga-viva bg-brote shadow-[0_0_0_3px_rgba(169,220,76,0.35)]"
                    : "border-cerco bg-white hover:border-lechuga-viva hover:-translate-y-0.5"
            )}
        >
            {active && (
                <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-lechuga-viva text-hoja flex items-center justify-center ring-2 ring-white">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </span>
            )}
            <span className="h-11 flex items-center justify-center">{children}</span>
            <span className={cn("text-[11px] leading-tight font-bold text-center", active ? "text-hoja" : "text-tinta")}>
                {label}
            </span>
        </button>
    );
}

/**
 * Sello "OFERTAS" hecho a mano en SVG, con el mismo lenguaje que el logo de
 * Comercial Veci: letras gruesas con contorno oscuro sobre una etiqueta roja.
 */
function OfertasIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 124 70" className={className} aria-hidden="true">
            <g transform="rotate(-7 62 38)">
                <rect x="5" y="16" width="112" height="44" rx="13" fill="#16311c" />
                <rect x="8" y="19" width="106" height="38" rx="10" fill="#e8472a" />
                <rect x="12" y="22" width="98" height="12" rx="6" fill="#ff7a5c" opacity="0.55" />
                <text
                    x="59"
                    y="46"
                    textAnchor="middle"
                    fontSize="21"
                    fontWeight="900"
                    textLength="88"
                    lengthAdjust="spacingAndGlyphs"
                    fill="#ffe600"
                    stroke="#16311c"
                    strokeWidth="5"
                    strokeLinejoin="round"
                    paintOrder="stroke"
                    style={{ fontFamily: 'var(--font-geist-sans), "Arial Black", Arial, sans-serif' }}
                >
                    OFERTAS
                </text>
            </g>
            <circle cx="108" cy="13" r="11" fill="#ffe600" stroke="#16311c" strokeWidth="3.5" />
            <text
                x="108"
                y="18"
                textAnchor="middle"
                fontSize="14"
                fontWeight="900"
                fill="#16311c"
                style={{ fontFamily: 'var(--font-geist-sans), "Arial Black", Arial, sans-serif' }}
            >
                %
            </text>
        </svg>
    );
}
