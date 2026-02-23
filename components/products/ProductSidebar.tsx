'use client';

import { useState, useEffect } from 'react';
import { Minus, Check, Loader2 } from 'lucide-react';
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
}

const CATEGORY_ICONS: Record<string, string> = {
    abarrotes: '🍞', bebidas: '🥤', lacteos: '🥛', snacks: '🍫',
    limpieza: '🧼', congelados: '❄️', frutas: '🍎', verduras: '🥬',
    carnes: '🥩', panaderia: '🥖', mascotas: '🐾', hogar: '🏠',
};

const CATEGORY_COLORS: Record<string, string> = {
    abarrotes: 'bg-orange-100 text-orange-600', bebidas: 'bg-blue-100 text-blue-600',
    lacteos: 'bg-indigo-100 text-indigo-600', snacks: 'bg-purple-100 text-purple-600',
    limpieza: 'bg-teal-100 text-teal-600', congelados: 'bg-sky-100 text-sky-600',
};

export function ProductSidebar({ selectedCategory, onCategoryChange }: ProductSidebarProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [inOffer, setInOffer] = useState(false);

    useEffect(() => {
        fetch('/api/store/categories')
            .then(res => res.json())
            .then(data => {
                setCategories(Array.isArray(data) ? data : data.data || []);
            })
            .catch(() => setCategories([]))
            .finally(() => setLoading(false));
    }, []);

    const getIcon = (slug: string) => {
        const key = slug.toLowerCase().replace(/-/g, '');
        return CATEGORY_ICONS[key] || '📦';
    };

    return (
        <div className="w-full md:w-64 shrink-0 space-y-8 p-6 bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white h-fit">

            {/* Title */}
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-veci-dark">Filtros</h3>
                <button className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400 hover:bg-indigo-100 transition-colors">
                    <Minus className="w-4 h-4" />
                </button>
            </div>

            {/* Price Filter */}
            <div>
                <h4 className="font-bold text-slate-700 mb-4">Precio</h4>
                <div className="relative w-full h-2 bg-indigo-100 rounded-full mb-4">
                    <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-pink-300 to-purple-400 rounded-full" style={{ width: '60%' }}></div>
                    <div className="absolute top-1/2 -translate-y-1/2 left-[60%] w-5 h-5 bg-white border-2 border-purple-400 rounded-full shadow-md cursor-pointer hover:scale-110 transition-transform"></div>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-slate-500">
                    <span>$1</span>
                    <span className="bg-white/50 px-3 py-1 rounded-full border border-white shadow-sm text-xs">Hasta $50.000</span>
                </div>
            </div>

            {/* Offer Checkbox */}
            <div
                onClick={() => setInOffer(!inOffer)}
                className="flex items-center gap-3 cursor-pointer group"
            >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${inOffer ? 'bg-purple-500 text-white shadow-lg shadow-purple-200' : 'bg-slate-100 text-transparent border border-slate-200'}`}>
                    <Check className="w-4 h-4" strokeWidth={3} />
                </div>
                <span className="font-medium text-slate-600 group-hover:text-purple-600 transition-colors">En oferta</span>
            </div>

            {/* Categories */}
            <div>
                <h4 className="font-bold text-slate-700 mb-4">Categorías</h4>
                {loading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                    </div>
                ) : categories.length === 0 ? (
                    <p className="text-sm text-slate-400">No hay categorías</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {/* All products */}
                        <button
                            onClick={() => onCategoryChange?.(null)}
                            className={cn(
                                "flex items-center justify-between p-2 rounded-xl transition-colors group text-left w-full",
                                !selectedCategory ? "bg-purple-50 ring-1 ring-purple-200" : "hover:bg-white/60"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-xl">🛒</span>
                                <span className={cn("font-medium transition-colors", !selectedCategory ? "text-purple-600" : "text-slate-600 group-hover:text-purple-600")}>Todos</span>
                            </div>
                        </button>

                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => onCategoryChange?.(cat.slug)}
                                className={cn(
                                    "flex items-center justify-between p-2 rounded-xl transition-colors group text-left w-full",
                                    selectedCategory === cat.slug ? "bg-purple-50 ring-1 ring-purple-200" : "hover:bg-white/60"
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{getIcon(cat.slug)}</span>
                                    <span className={cn("font-medium transition-colors", selectedCategory === cat.slug ? "text-purple-600" : "text-slate-600 group-hover:text-purple-600")}>{cat.name}</span>
                                </div>
                                <span className="text-xs font-bold text-slate-400 bg-white/50 px-2 py-1 rounded-full group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                                    ({cat.productCount ?? 0})
                                </span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

        </div>
    );
}
