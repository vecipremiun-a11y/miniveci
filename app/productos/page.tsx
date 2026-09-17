'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Footer } from "@/components/Footer";
import { ProductSidebar } from "@/components/products/ProductSidebar";
import { ProductCard } from "@/components/products/ProductCard";
import { useDebounce } from '@/hooks/use-debounce';
import type { ProductChangeEventPayload, StoreProductPayload } from '@/lib/store-product-types';
import { matchesSearchTokens, tokenizeSearch } from '@/lib/search-text';
import { ChevronDown, LayoutGrid, List, Loader2, PackageOpen, SlidersHorizontal, X } from "lucide-react";

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

    // Mismo criterio que /api/store/products: palabras en cualquier orden, sin tildes
    return matchesSearchTokens(tokenizeSearch(search), [product.name, product.description, product.category?.name]);
}

function ProductsPageContent() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [products, setProducts] = useState<StoreProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
    const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'newest'>('newest');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [maxPrice, setMaxPrice] = useState(Number(searchParams.get('maxPrice') || '50000') || 50000);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const debouncedMaxPrice = useDebounce(maxPrice, 400);
    const productsRef = useRef<StoreProduct[]>([]);
    const metaRef = useRef(meta);

    // All filters read directly from URL — single source of truth, no cycles
    const search = searchParams.get('search')?.trim() || '';
    const selectedCategory = searchParams.get('category') || null;
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1);
    const inOffer = searchParams.get('offer') === 'true';

    // Helper to update URL params without cycles
    const updateURL = useCallback((updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());
        for (const [key, value] of Object.entries(updates)) {
            if (value === null || value === '') {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        }
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, [pathname, router, searchParams]);

    useEffect(() => {
        productsRef.current = products;
    }, [products]);

    useEffect(() => {
        metaRef.current = meta;
    }, [meta]);

    // Sync maxPrice to URL when debounced value changes
    useEffect(() => {
        const currentMax = Number(searchParams.get('maxPrice') || '50000') || 50000;
        if (debouncedMaxPrice < 50000 && debouncedMaxPrice !== currentMax) {
            updateURL({ maxPrice: String(debouncedMaxPrice), page: null });
        } else if (debouncedMaxPrice >= 50000 && searchParams.has('maxPrice')) {
            updateURL({ maxPrice: null, page: null });
        }
    }, [debouncedMaxPrice, searchParams, updateURL]);

    const abortRef = useRef<AbortController | null>(null);

    const fetchProducts = useCallback(async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('limit', '20');
            if (selectedCategory) params.set('category', selectedCategory);
            if (search) params.set('search', search);
            if (inOffer) params.set('offer', 'true');
            if (debouncedMaxPrice < 50000) params.set('maxPrice', String(debouncedMaxPrice));
            if (sortBy !== 'newest') params.set('sort', sortBy);

            const res = await fetch(`/api/store/products?${params.toString()}`, {
                signal: controller.signal,
            });
            if (res.ok && !controller.signal.aborted) {
                const json: ApiResponse = await res.json();
                setProducts(json.data);
                setMeta(json.meta);
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
            console.error('Error fetching products:', err);
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }, [page, selectedCategory, search, sortBy, inOffer, debouncedMaxPrice]);

    useEffect(() => {
        fetchProducts();
        return () => { abortRef.current?.abort(); };
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
        updateURL({ category: slug, search: null, page: null });
    };

    const handleSearchChange = (value: string) => {
        // search is handled by Navbar
    };

    const handleOfferChange = (value: boolean) => {
        updateURL({ offer: value ? 'true' : null, page: null });
    };

    const handleMaxPriceChange = (value: number) => {
        setMaxPrice(value);
    };

    const clearFilters = () => {
        setMaxPrice(50000);
        router.replace(pathname, { scroll: false });
    };

    const getPrimaryImage = (product: StoreProduct): string | null => {
        if (!product.images || product.images.length === 0) return null;
        const primary = product.images.find(i => i.isPrimary);
        return primary?.url || product.images[0]?.url || null;
    };

    const startIdx = (meta.page - 1) * meta.limit + 1;
    const endIdx = Math.min(meta.page * meta.limit, meta.total);

    return (
        <main className="min-h-screen bg-white text-hoja selection:bg-lechuga selection:text-hoja pb-20">

            {/* Spacer for fixed navbar */}
            <div className="h-36 md:h-44"></div>

            {/* Franja de mercado: toldo + estado del puesto */}
            <div className="px-3 sm:px-4 md:px-8 mb-4">
                <div className="rounded-2xl overflow-hidden border border-cerco bg-white">
                    <div className="feria-toldo h-[7px]" />
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3">
                        <h1 className="text-base sm:text-lg font-bold tracking-tight text-hoja">
                            Puesto abierto · retiro en tienda o despacho
                        </h1>
                        <span className="flex items-center gap-2 text-xs sm:text-[13px] font-semibold text-tallo">
                            <span className="w-[7px] h-[7px] rounded-full bg-lechuga-viva" />
                            Stock actualizado en vivo desde la caja
                        </span>
                    </div>
                </div>
            </div>

            <div className="w-full px-3 sm:px-4 md:px-8 flex flex-col md:flex-row gap-4 md:gap-6">

                {/* Sidebar - Desktop */}
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

                {/* Sidebar - Mobile Drawer */}
                {mobileFiltersOpen && (
                    <div className="md:hidden fixed inset-0 z-[80] flex">
                        <div className="absolute inset-0 bg-hoja/50 backdrop-blur-sm" onClick={() => setMobileFiltersOpen(false)} />
                        <div className="relative ml-auto w-[85%] max-w-sm h-full bg-white overflow-y-auto p-3 animate-in slide-in-from-right duration-200">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-hoja">Filtros</span>
                                <button onClick={() => setMobileFiltersOpen(false)} className="w-9 h-9 rounded-full bg-white border border-cerco flex items-center justify-center text-tinta">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <ProductSidebar
                                selectedCategory={selectedCategory}
                                onCategoryChange={(s) => { handleCategoryChange(s); setMobileFiltersOpen(false); }}
                                inOffer={inOffer}
                                onOfferChange={handleOfferChange}
                                maxPrice={maxPrice}
                                onMaxPriceChange={handleMaxPriceChange}
                            />
                        </div>
                    </div>
                )}

                {/* Main Content */}
                <div className="flex-1 min-w-0">

                    {/* Top Bar */}
                    <div className="flex flex-row items-center justify-between mb-4 sm:mb-5 gap-2 sm:gap-4 feria-card p-2.5 sm:p-3 rounded-2xl">
                        <button
                            onClick={() => setMobileFiltersOpen(true)}
                            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-papel border border-cerco text-xs font-bold text-hoja shrink-0"
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                            Filtros
                        </button>
                        <span className="text-tinta text-[11px] sm:text-[13px] font-medium whitespace-nowrap truncate tabular-nums">
                            {meta.total > 0
                                ? <><span className="hidden sm:inline">Mostrando </span><b className="font-bold text-hoja">{startIdx}-{endIdx}</b> de <b className="font-bold text-hoja">{meta.total.toLocaleString('es-CL')}</b><span className="hidden sm:inline"> productos</span></>
                                : 'Sin productos'}
                        </span>

                        <div className="flex items-center gap-2 sm:gap-4 self-end xl:self-auto">
                            {/* Sort */}
                            <div className="relative group">
                                <button className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-[13px] font-semibold text-tinta cursor-pointer hover:text-hoja transition-colors bg-papel border border-cerco rounded-full px-3 py-1.5">
                                    <span><span className="hidden sm:inline">Ordenar: </span><span className="font-bold text-hoja">
                                        {sortBy === 'featured' ? 'Destacados' : sortBy === 'newest' ? 'Nuevos' : sortBy === 'price_asc' ? 'Menor precio' : 'Mayor precio'}
                                    </span></span>
                                    <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" />
                                </button>
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-cerco py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                    {[
                                        { value: 'newest' as const, label: 'Nuevos' },
                                        { value: 'featured' as const, label: 'Destacados' },
                                        { value: 'price_asc' as const, label: 'Menor precio' },
                                        { value: 'price_desc' as const, label: 'Mayor precio' },
                                    ].map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => { setSortBy(opt.value); updateURL({ page: null }); }}
                                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                                sortBy === opt.value
                                                    ? 'bg-brote text-hoja font-bold'
                                                    : 'text-tinta hover:bg-papel font-medium'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="hidden sm:flex items-center gap-0.5 bg-papel border border-cerco p-0.5 rounded-full">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    aria-label="Vista de grilla"
                                    aria-pressed={viewMode === 'grid'}
                                    className={`p-1.5 rounded-full transition-colors ${viewMode === 'grid' ? 'bg-lechuga text-hoja' : 'text-tinta-clara hover:text-hoja'}`}
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    aria-label="Vista de lista"
                                    aria-pressed={viewMode === 'list'}
                                    className={`p-1.5 rounded-full transition-colors ${viewMode === 'list' ? 'bg-lechuga text-hoja' : 'text-tinta-clara hover:text-hoja'}`}
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Loading */}
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <Loader2 className="w-8 h-8 animate-spin text-tallo" />
                            <p className="text-tinta text-sm">Cargando productos...</p>
                        </div>
                    ) : products.length === 0 ? (
                        /* Empty State */
                        <div className="flex flex-col items-center justify-center h-64 gap-3 feria-card rounded-2xl">
                            <PackageOpen className="w-14 h-14 text-cerco" strokeWidth={1.5} />
                            <h3 className="text-lg font-bold text-hoja">No hay productos disponibles</h3>
                            <p className="text-tinta text-sm text-center px-4">
                                {selectedCategory || search ? 'No se encontraron productos con los filtros actuales.' : 'Pronto habrá productos disponibles.'}
                            </p>
                            {(selectedCategory || search) && (
                                <button
                                    onClick={clearFilters}
                                    className="mt-1 px-4 py-2 bg-lechuga text-hoja rounded-full text-sm font-bold hover:bg-lechuga-viva transition-colors"
                                >
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Product Grid */
                        <>
                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-5">
                                {products.map((product) => (
                                    <ProductCard
                                        key={product.id}
                                        id={product.id}
                                        name={product.name}
                                        price={product.price}
                                        offerPrice={product.offerPrice}
                                        isOffer={product.isOffer}
                                        stock={product.stock}
                                        unit={product.unit}
                                        equivLabel={product.equivLabel}
                                        equivWeight={product.equivWeight}
                                        image={getPrimaryImage(product)}
                                        isPopular={product.badges?.includes('popular') || product.tags?.includes('popular') || false}
                                        slug={product.slug}
                                        priceTiers={product.priceTiers}
                                        subscriptionPrice={product.subscriptionPrice}
                                    />
                                ))}
                            </div>

                            {/* Pagination */}
                            {meta.totalPages > 1 && (
                                <div className="flex justify-center items-center gap-2 mt-10">
                                    <button
                                        onClick={() => updateURL({ page: page > 2 ? String(page - 1) : null })}
                                        disabled={page === 1}
                                        className="px-4 py-2 rounded-full bg-white border border-cerco text-sm font-bold text-hoja hover:border-lechuga-viva disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-cerco transition-colors"
                                    >
                                        Anterior
                                    </button>
                                    <span className="flex items-center px-4 text-sm font-semibold text-tinta tabular-nums">
                                        Página {meta.page} de {meta.totalPages}
                                    </span>
                                    <button
                                        onClick={() => updateURL({ page: String(page + 1) })}
                                        disabled={page >= meta.totalPages}
                                        className="px-4 py-2 rounded-full bg-lechuga border border-lechuga-viva text-sm font-bold text-hoja hover:bg-lechuga-viva disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            <main className="min-h-screen bg-white pb-20">
                <div className="h-36 md:h-40"></div>
                <div className="max-w-7xl mx-auto px-6 md:px-12 h-[50vh] flex items-center justify-center">
                    <div className="flex items-center gap-3 text-tinta font-semibold">
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
