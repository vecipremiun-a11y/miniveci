'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Footer } from "@/components/Footer";
import { ProductSidebar } from "@/components/products/ProductSidebar";
import { ProductCard } from "@/components/products/ProductCard";
import { useDebounce } from '@/hooks/use-debounce';
import type { ProductChangeEventPayload, StoreProductPayload } from '@/lib/store-product-types';
import { ChevronDown, LayoutGrid, List, Loader2, PackageOpen } from "lucide-react";

interface ApiResponse {
    data: StoreProductPayload[];
    meta: { total: number; page: number; limit: number; totalPages: number };
}

type StoreProduct = StoreProductPayload;

function mergeProductChanges(currentProduct: StoreProduct, change: ProductChangeEventPayload) {
    if (!change.changes || !change.changedFields || change.changedFields.length === 0) {
        return change.product ?? currentProduct;
    }

    return {
        ...currentProduct,
        ...change.changes,
    };
}

function matchesProductFilters(product: StoreProduct, selectedCategory: string | null, search: string) {
    if (selectedCategory && product.category?.slug !== selectedCategory) {
        return false;
    }

    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
        return true;
    }

    return [product.name, product.description || '', product.category?.name || '']
        .some((value) => value.toLowerCase().includes(normalizedSearch));
}

function ProductsPageContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
    const [selectedCategory, setSelectedCategory] = useState<string | null>(searchParams.get('category'));
    const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
    const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'newest'>('newest');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [page, setPage] = useState(Math.max(1, Number(searchParams.get('page') || '1') || 1));
    const [inOffer, setInOffer] = useState(searchParams.get('offer') === 'true');
    const [maxPrice, setMaxPrice] = useState(Number(searchParams.get('maxPrice') || '50000') || 50000);
    const debouncedMaxPrice = useDebounce(maxPrice, 400);
    const productsRef = useRef<StoreProduct[]>([]);
    const metaRef = useRef(meta);
    const search = useDebounce(searchInput, 350);

    useEffect(() => {
        productsRef.current = products;
    }, [products]);

    useEffect(() => {
        metaRef.current = meta;
    }, [meta]);

    useEffect(() => {
        const nextSearch = searchParams.get('search') || '';
        const nextCategory = searchParams.get('category');
        const nextPage = Math.max(1, Number(searchParams.get('page') || '1') || 1);

        const nextOffer = searchParams.get('offer') === 'true';
        const nextMaxPrice = Number(searchParams.get('maxPrice') || '50000') || 50000;

        setSearchInput((current) => current === nextSearch ? current : nextSearch);
        setSelectedCategory((current) => current === nextCategory ? current : nextCategory);
        setPage((current) => current === nextPage ? current : nextPage);
        setInOffer((current) => current === nextOffer ? current : nextOffer);
        setMaxPrice((current) => current === nextMaxPrice ? current : nextMaxPrice);
    }, [searchParams]);

    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        const normalizedSearch = search.trim();

        if (normalizedSearch) {
            params.set('search', normalizedSearch);
        } else {
            params.delete('search');
        }

        if (selectedCategory) {
            params.set('category', selectedCategory);
        } else {
            params.delete('category');
        }

        if (page > 1) {
            params.set('page', String(page));
        } else {
            params.delete('page');
        }

        if (inOffer) {
            params.set('offer', 'true');
        } else {
            params.delete('offer');
        }

        if (debouncedMaxPrice < 50000) {
            params.set('maxPrice', String(debouncedMaxPrice));
        } else {
            params.delete('maxPrice');
        }

        const nextQuery = params.toString();
        const currentQuery = searchParams.toString();

        if (nextQuery !== currentQuery) {
            router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
        }
    }, [page, pathname, router, search, searchParams, selectedCategory, inOffer, debouncedMaxPrice]);

    const fetchProducts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('limit', '20');
            if (selectedCategory) params.set('category', selectedCategory);
            if (search.trim()) params.set('search', search.trim());
            if (inOffer) params.set('offer', 'true');
            if (debouncedMaxPrice < 50000) params.set('maxPrice', String(debouncedMaxPrice));

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
    }, [page, selectedCategory, search, sortBy, inOffer, debouncedMaxPrice]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const applyProductChange = useCallback((change: ProductChangeEventPayload) => {
        const currentProducts = productsRef.current;
        const currentMeta = metaRef.current;
        const currentIndex = currentProducts.findIndex((product) => product.id === change.productId || product.slug === change.slug);
        const nextProduct = change.product;
        const isVisible = nextProduct ? matchesProductFilters(nextProduct, selectedCategory, search) : false;

        let nextProducts = currentProducts;
        let totalDelta = 0;

        if (change.type === 'delete' || !nextProduct || !isVisible) {
            if (currentIndex === -1) {
                return;
            }

            nextProducts = currentProducts.filter((product) => product.id !== change.productId);
            totalDelta = -1;
        } else if (currentIndex >= 0) {
            nextProducts = currentProducts.map((product, index) => index === currentIndex ? mergeProductChanges(product, change) : product);
        } else if (page === 1) {
            nextProducts = [nextProduct, ...currentProducts].slice(0, currentMeta.limit);
            totalDelta = 1;
        } else {
            return;
        }

        productsRef.current = nextProducts;
        setProducts(nextProducts);

        if (totalDelta !== 0) {
            const nextMeta = {
                ...currentMeta,
                total: Math.max(0, currentMeta.total + totalDelta),
            };
            nextMeta.totalPages = Math.max(1, Math.ceil(nextMeta.total / nextMeta.limit));
            metaRef.current = nextMeta;
            setMeta(nextMeta);
        }
    }, [page, search, selectedCategory]);

    useEffect(() => {
        const eventSource = new EventSource('/api/store/products/events');

        const onProductChange = (event: Event) => {
            const messageEvent = event as MessageEvent<string>;
            const payload = JSON.parse(messageEvent.data) as ProductChangeEventPayload;
            applyProductChange(payload);
        };

        eventSource.addEventListener('product-change', onProductChange);

        return () => {
            eventSource.removeEventListener('product-change', onProductChange);
            eventSource.close();
        };
    }, [applyProductChange]);

    useEffect(() => {
        if (products.length === 0) return;

        let cancelled = false;

        const refreshVisibleProducts = async () => {
            if (cancelled || document.visibilityState !== 'visible') return;

            try {
                await fetch('/api/store/products/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productIds: products.map((product) => product.id) }),
                });
            } catch {
                // Silent fallback; SSE or next interval will retry.
            }
        };

        refreshVisibleProducts();
        const intervalId = window.setInterval(refreshVisibleProducts, 15000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [products]);

    const handleCategoryChange = (slug: string | null) => {
        setSelectedCategory(slug);
        setPage(1);
    };

    const handleSearchChange = (value: string) => {
        setSearchInput(value);
        setPage(1);
    };

    const handleOfferChange = (value: boolean) => {
        setInOffer(value);
        setPage(1);
    };

    const handleMaxPriceChange = (value: number) => {
        setMaxPrice(value);
        setPage(1);
    };

    const clearFilters = () => {
        setSearchInput('');
        setSelectedCategory(null);
        setInOffer(false);
        setMaxPrice(50000);
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
                        inOffer={inOffer}
                        onOfferChange={handleOfferChange}
                        maxPrice={maxPrice}
                        onMaxPriceChange={handleMaxPriceChange}
                    />
                </div>

                {/* Main Content */}
                <div className="flex-1">

                    {/* Top Bar */}
                    <div className="flex flex-col xl:flex-row justify-between xl:items-center mb-8 gap-4 bg-white/40 backdrop-blur-md p-4 rounded-3xl border border-white">
                        <span className="text-slate-500 text-sm font-medium whitespace-nowrap">
                            {meta.total > 0
                                ? `Mostrando ${startIdx}-${endIdx} de ${meta.total} productos`
                                : 'Sin productos'}
                        </span>

                        <div className="flex items-center gap-4 self-end xl:self-auto">
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
                                {selectedCategory || search ? 'No se encontraron productos con los filtros actuales.' : 'Pronto habrá productos disponibles.'}
                            </p>
                            {(selectedCategory || search) && (
                                <button
                                    onClick={clearFilters}
                                    className="mt-2 px-4 py-2 bg-purple-100 text-purple-600 rounded-full text-sm font-bold hover:bg-purple-200 transition-colors"
                                >
                                    Limpiar filtros
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
                                        id={product.id}
                                        name={product.name}
                                        price={product.price}
                                        offerPrice={product.offerPrice}
                                        isOffer={product.isOffer}
                                        stock={product.stock}
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

export default function ProductsPage() {
    return (
        <Suspense fallback={(
            <main className="min-h-screen bg-veci-bg pb-20">
                <div className="h-32 md:h-40"></div>
                <div className="max-w-7xl mx-auto px-6 md:px-12 h-[50vh] flex items-center justify-center">
                    <div className="flex items-center gap-3 text-slate-500 font-semibold">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Cargando productos...
                    </div>
                </div>
                <Footer />
            </main>
        )}>
            <ProductsPageContent />
        </Suspense>
    );
}
