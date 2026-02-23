'use client';

import { useState, useEffect, useCallback } from 'react';
import { Footer } from "@/components/Footer";
import { ProductSidebar } from "@/components/products/ProductSidebar";
import { ProductCard } from "@/components/products/ProductCard";
import { ChevronDown, LayoutGrid, List, Loader2, PackageOpen } from "lucide-react";

interface StoreProduct {
    id: string;
    name: string;
    slug: string;
    price: number;
    stock: number;
    images: { id: string; url: string; isPrimary: boolean }[];
    badges: string[] | null;
    tags: string[] | null;
    category: { id: string; name: string; slug: string } | null;
}

interface ApiResponse {
    data: StoreProduct[];
    meta: { total: number; page: number; limit: number; totalPages: number };
}

export default function ProductsPage() {
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'newest'>('newest');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [page, setPage] = useState(1);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('limit', '20');
            if (selectedCategory) params.set('category', selectedCategory);
            if (search) params.set('search', search);

            const res = await fetch(`/api/store/products?${params.toString()}`);
            if (res.ok) {
                const json: ApiResponse = await res.json();
                setProducts(json.data);
                setMeta(json.meta);
            }
        } catch (err) {
            console.error('Error fetching products:', err);
        } finally {
            setLoading(false);
        }
    }, [page, selectedCategory, search, sortBy]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const handleCategoryChange = (slug: string | null) => {
        setSelectedCategory(slug);
        setPage(1);
    };

    const getPrimaryImage = (product: StoreProduct): string | null => {
        if (!product.images || product.images.length === 0) return null;
        const primary = product.images.find(i => i.isPrimary);
        return primary?.url || product.images[0]?.url || null;
    };

    const startIdx = (meta.page - 1) * meta.limit + 1;
    const endIdx = Math.min(meta.page * meta.limit, meta.total);

    return (
        <main className="min-h-screen bg-veci-bg selection:bg-veci-primary selection:text-white pb-20">

            {/* Spacer for fixed navbar */}
            <div className="h-32 md:h-40"></div>

            <div className="max-w-7xl mx-auto px-6 md:px-12 flex flex-col md:flex-row gap-8">

                {/* Sidebar */}
                <div className="hidden md:block">
                    <ProductSidebar
                        selectedCategory={selectedCategory}
                        onCategoryChange={handleCategoryChange}
                    />
                </div>

                {/* Main Content */}
                <div className="flex-1">

                    {/* Top Bar */}
                    <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white/40 backdrop-blur-md p-4 rounded-3xl border border-white">
                        <span className="text-slate-500 text-sm font-medium">
                            {meta.total > 0
                                ? `Mostrando ${startIdx}-${endIdx} de ${meta.total} productos`
                                : 'Sin productos'}
                        </span>

                        <div className="flex items-center gap-4">
                            {/* Sort */}
                            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
                                <span>Ordenar por: <span className="text-veci-dark">
                                    {sortBy === 'featured' ? 'Destacados' : sortBy === 'newest' ? 'Nuevos' : sortBy === 'price_asc' ? 'Menor precio' : 'Mayor precio'}
                                </span></span>
                                <ChevronDown className="w-4 h-4" />
                            </div>

                            <div className="h-6 w-px bg-slate-300"></div>

                            <div className="flex items-center gap-2 bg-white/50 p-1 rounded-lg">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-veci-purple text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-veci-purple text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Loading */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                            <p className="text-slate-400 text-sm">Cargando productos...</p>
                        </div>
                    ) : products.length === 0 ? (
                        /* Empty State */
                        <div className="flex flex-col items-center justify-center h-64 gap-4 bg-white/30 backdrop-blur-md rounded-3xl border border-white">
                            <PackageOpen className="w-16 h-16 text-slate-300" />
                            <h3 className="text-xl font-bold text-slate-500">No hay productos disponibles</h3>
                            <p className="text-slate-400 text-sm">
                                {selectedCategory ? 'No se encontraron productos en esta categoría.' : 'Pronto habrá productos disponibles.'}
                            </p>
                            {selectedCategory && (
                                <button
                                    onClick={() => handleCategoryChange(null)}
                                    className="mt-2 px-4 py-2 bg-purple-100 text-purple-600 rounded-full text-sm font-bold hover:bg-purple-200 transition-colors"
                                >
                                    Ver todos los productos
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Product Grid */
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                {products.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        name={product.name}
                                        price={product.price}
                                        image={getPrimaryImage(product)}
                                        isPopular={product.badges?.includes('popular') || product.tags?.includes('popular') || false}
                                        slug={product.slug}
                                    />
                                ))}
                            </div>

                            {/* Pagination */}
                            {meta.totalPages > 1 && (
                                <div className="flex justify-center gap-2 mt-10">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-4 py-2 rounded-full bg-white/50 border border-white text-sm font-bold text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Anterior
                                    </button>
                                    <span className="flex items-center px-4 text-sm font-bold text-slate-600">
                                        Página {meta.page} de {meta.totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                                        disabled={page >= meta.totalPages}
                                        className="px-4 py-2 rounded-full bg-white/50 border border-white text-sm font-bold text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Siguiente
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                </div>

            </div>

            <Footer />
        </main>
    );
}
