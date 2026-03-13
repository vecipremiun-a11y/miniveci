'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { useCart, isWeightUnit, hasEquiv } from '@/components/cart/CartProvider';
import type { ProductChangeEventPayload, StoreProductPayload } from '@/lib/store-product-types';
import { ChevronRight, Loader2, Minus, Plus, Scale, ShoppingCart, Star } from 'lucide-react';

type ProductDetail = StoreProductPayload;

function mergeProductChanges(currentProduct: ProductDetail, change: ProductChangeEventPayload) {
    if (!change.changes || !change.changedFields || change.changedFields.length === 0) {
        return change.product ?? currentProduct;
    }

    return {
        ...currentProduct,
        ...change.changes,
    };
}

export default function ProductDetailPage() {
    const params = useParams<{ slug: string }>();
    const slug = params?.slug;

    const { addItem } = useCart();
    const [product, setProduct] = useState<ProductDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedImage, setSelectedImage] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [buyMode, setBuyMode] = useState<'unit' | 'kg'>('unit');

    // Reset quantity when product loads/changes unit
    useEffect(() => {
        if (product) {
            const equiv = hasEquiv(product);
            setBuyMode('unit');
            setQuantity(equiv ? 1 : (isWeightUnit(product.unit) ? 0.1 : 1));
        }
    }, [product?.unit, product?.equivLabel]);

    const equiv = product ? hasEquiv(product) : false;
    const kgMode = equiv && buyMode === 'kg';
    const isWeight = product ? (!equiv && isWeightUnit(product.unit)) : false;
    const step = kgMode ? 0.5 : (equiv ? 1 : (isWeight ? 0.1 : 1));
    const minQty = kgMode ? 0.5 : (equiv ? 1 : (isWeight ? 0.1 : 1));
    const equivW = product?.equivWeight ?? 1;
    const availableStock = product ? (equiv ? Math.floor(product.stock / equivW) : product.stock) : 0;
    const maxQty = kgMode ? (product?.stock ?? 0) : availableStock;

    // Format price per kg for equiv products
    const equivUnitLabel = product?.equivLabel && !/^\d+$/.test(product.equivLabel.trim()) ? product.equivLabel : 'und';

    const handleBuyModeChange = (mode: 'unit' | 'kg') => {
        if (mode === buyMode) return;
        setBuyMode(mode);
        setQuantity(mode === 'kg' ? 0.5 : 1);
    };

    useEffect(() => {
        if (!slug) return;

        const loadProduct = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/store/products/${slug}`);
                if (!res.ok) {
                    setProduct(null);
                    return;
                }
                const json: ProductDetail = await res.json();
                setProduct(json);
                setSelectedImage(0);
            } catch {
                setProduct(null);
            } finally {
                setLoading(false);
            }
        };

        loadProduct();
    }, [slug]);

    useEffect(() => {
        if (!slug) return;

        const eventSource = new EventSource('/api/store/products/events');

        const onProductChange = (event: Event) => {
            const messageEvent = event as MessageEvent<string>;
            const payload = JSON.parse(messageEvent.data) as ProductChangeEventPayload;

            if (payload.slug !== slug && payload.product?.slug !== slug) {
                return;
            }

            if (payload.type === 'delete' || !payload.product) {
                setProduct(null);
                setQuantity(1);
                return;
            }

            setProduct((current) => {
                const nextProduct = current ? mergeProductChanges(current, payload) : payload.product;

                if (!nextProduct) {
                    return current;
                }

                if (payload.changedFields?.includes('images')) {
                    setSelectedImage((currentImage) => Math.min(currentImage, Math.max(0, nextProduct.images.length - 1)));
                }

                if (payload.changedFields?.includes('stock')) {
                    setQuantity((currentQuantity) => Math.max(1, Math.min(currentQuantity, nextProduct.stock)));
                }

                return nextProduct;
            });
        };

        eventSource.addEventListener('product-change', onProductChange);

        return () => {
            eventSource.removeEventListener('product-change', onProductChange);
            eventSource.close();
        };
    }, [slug]);

    useEffect(() => {
        if (!product?.id) return;

        let cancelled = false;

        const refreshCurrentProduct = async () => {
            if (cancelled || document.visibilityState !== 'visible') return;

            try {
                await fetch('/api/store/products/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productIds: [product.id] }),
                });
            } catch {
                // Silent fallback; SSE or next interval will retry.
            }
        };

        refreshCurrentProduct();
        const intervalId = window.setInterval(refreshCurrentProduct, 15000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [product?.id]);

    const hasOffer = Boolean(product?.isOffer && product?.offerPrice && product.offerPrice < product.price);
    const rawPrice = hasOffer ? product!.offerPrice! : product?.price ?? 0;
    const displayPrice = equiv ? Math.round(rawPrice * equivW) : rawPrice;
    const discountPercent = hasOffer ? Math.round(((product!.price - product!.offerPrice!) / product!.price) * 100) : 0;

    const priceText = useMemo(() => {
        if (!product) return '';
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            maximumFractionDigits: 0,
        }).format(displayPrice);
    }, [product, displayPrice]);

    const originalPriceText = useMemo(() => {
        if (!product || !hasOffer) return '';
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            maximumFractionDigits: 0,
        }).format(product.price);
    }, [product, hasOffer]);

    const kgPriceText = useMemo(() => {
        if (!product) return '';
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(rawPrice);
    }, [product, rawPrice]);

    const subtotal = useMemo(() => {
        if (!product) return 0;
        if (kgMode) return Math.round(quantity * rawPrice);
        if (equiv) return quantity * displayPrice;
        return Math.round(quantity * rawPrice);
    }, [product, equiv, kgMode, quantity, displayPrice, rawPrice]);

    const subtotalText = useMemo(() => {
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(subtotal);
    }, [subtotal]);

    const currentImage = useMemo(() => {
        if (!product || product.images.length === 0) return '/placeholder-product.svg';
        return product.images[selectedImage]?.url || product.images[0].url;
    }, [product, selectedImage]);

    if (loading) {
        return (
            <main className="min-h-screen bg-veci-bg pb-20">
                <div className="h-32 md:h-40" />
                <div className="max-w-7xl mx-auto px-6 md:px-12 h-[50vh] flex items-center justify-center">
                    <div className="flex items-center gap-3 text-slate-500 font-semibold">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Cargando detalle del producto...
                    </div>
                </div>
                <Footer />
            </main>
        );
    }

    if (!product) {
        return (
            <main className="min-h-screen bg-veci-bg pb-20">
                <div className="h-32 md:h-40" />
                <div className="max-w-5xl mx-auto px-6 md:px-12">
                    <div className="bg-white/60 backdrop-blur-md border border-white rounded-3xl p-10 text-center">
                        <h1 className="text-2xl font-extrabold text-slate-700">Producto no encontrado</h1>
                        <p className="text-slate-500 mt-2">Este producto no existe o no está disponible.</p>
                        <Link href="/productos" className="inline-flex mt-6 px-6 py-3 rounded-full btn-primary font-bold">
                            Volver a la tienda
                        </Link>
                    </div>
                </div>
                <Footer />
            </main>
        );
    }

    const rating = product.tags?.includes('popular') || product.badges?.includes('popular') ? 4.9 : 4.7;

    return (
        <main className="min-h-screen bg-veci-bg selection:bg-veci-primary selection:text-white pb-20">
            <div className="h-32 md:h-40" />

            <div className="max-w-7xl mx-auto px-6 md:px-12">
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
                    <Link href="/" className="hover:text-slate-700">Inicio</Link>
                    <ChevronRight className="w-4 h-4" />
                    <Link href="/productos" className="hover:text-slate-700">Productos</Link>
                    <ChevronRight className="w-4 h-4" />
                    <span className="font-semibold text-slate-700 truncate">{product.name}</span>
                </div>

                <section className="grid lg:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <div className="bg-white/60 border border-white rounded-3xl p-8 min-h-[420px] flex items-center justify-center">
                            <img
                                src={currentImage}
                                alt={product.name}
                                className="max-h-[360px] w-full object-contain"
                            />
                        </div>

                        {product.images.length > 1 && (
                            <div className="grid grid-cols-5 gap-3">
                                {product.images.map((img, idx) => (
                                    <button
                                        key={img.id}
                                        onClick={() => setSelectedImage(idx)}
                                        className={`bg-white/60 border rounded-2xl p-2 h-20 overflow-hidden ${
                                            idx === selectedImage ? 'border-veci-primary ring-2 ring-veci-primary/20' : 'border-white'
                                        }`}
                                    >
                                        <img
                                            src={img.url}
                                            alt={img.altText || product.name}
                                            className="w-full h-full object-contain"
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-white/60 backdrop-blur-md border border-white rounded-3xl p-8">
                        <div className="flex flex-wrap gap-2 mb-4">
                            {hasOffer && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm shadow-red-200/50">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
                                    Oferta -{discountPercent}%
                                </span>
                            )}
                            {product.category && (
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                                    {product.category.name}
                                </span>
                            )}
                            {(product.badges || []).slice(0, 3).map((badge) => (
                                <span key={badge} className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-600 border border-purple-100">
                                    {badge}
                                </span>
                            ))}
                        </div>

                        <h1 className="text-3xl md:text-4xl font-extrabold text-veci-dark leading-tight">{product.name}</h1>

                        <div className="flex items-center gap-2 mt-4">
                            <div className="flex items-center gap-0.5 text-amber-400">
                                {Array.from({ length: 5 }).map((_, idx) => (
                                    <Star key={idx} className="w-4 h-4 fill-current" />
                                ))}
                            </div>
                            <span className="text-sm font-semibold text-slate-600">{rating.toFixed(1)} / 5</span>
                        </div>

                        {/* --- Pricing --- */}
                        {equiv ? (
                            <div className="mt-6">
                                <div className="flex items-baseline gap-3">
                                    <p className={`text-4xl font-extrabold ${hasOffer ? 'text-red-600' : 'text-veci-dark'}`}>
                                        {kgPriceText}<span className="text-xl font-bold text-slate-400">/kg</span>
                                    </p>
                                    {hasOffer && (
                                        <p className="text-xl text-slate-400 line-through font-semibold">{originalPriceText}/kg</p>
                                    )}
                                </div>
                                {hasOffer && (
                                    <p className="mt-1.5 text-sm font-bold text-emerald-600">
                                        Ahorras {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(product.price - product.offerPrice!)}/kg
                                    </p>
                                )}
                                <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200">
                                    <span className="text-sm font-bold text-amber-800">Cada {equivUnitLabel} ≈ {priceText}</span>
                                    <span className="text-xs text-amber-600/80">({equivW} kg aprox.)</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="mt-6 flex items-baseline gap-3">
                                    <p className={`text-4xl font-extrabold ${hasOffer ? 'text-red-600' : 'text-veci-dark'}`}>
                                        {priceText}
                                    </p>
                                    {hasOffer && (
                                        <p className="text-xl text-slate-400 line-through font-semibold">{originalPriceText}</p>
                                    )}
                                </div>
                                {hasOffer && (
                                    <p className="mt-1.5 text-sm font-bold text-emerald-600">
                                        Ahorras {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(product.price - product.offerPrice!)}
                                    </p>
                                )}
                            </>
                        )}

                        {/* --- Availability --- */}
                        <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                            <p className="text-sm text-slate-500">Disponibilidad</p>
                            <p className="font-bold text-slate-700">
                                {product.stock > 0
                                    ? `${product.stock} ${isWeightUnit(product.unit) ? (product.unit ?? 'Kg').toUpperCase() : 'UND'} en stock`
                                    : 'Sin stock'}
                            </p>
                            {equiv && availableStock > 0 && (
                                <p className="text-sm font-semibold text-emerald-700 pt-1 border-t border-slate-200">
                                    ≈ {availableStock} {equivUnitLabel} disponibles
                                </p>
                            )}
                        </div>

                        {/* --- Buy Mode Toggle (only for equiv products) --- */}
                        {equiv && (
                            <div className="mt-5">
                                <p className="text-sm font-semibold text-slate-500 mb-2">¿Cómo prefieres comprar?</p>
                                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100">
                                    <button
                                        onClick={() => handleBuyModeChange('unit')}
                                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                                            buyMode === 'unit'
                                                ? 'bg-white text-veci-dark shadow-sm ring-1 ring-slate-200'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                        Por unidad
                                    </button>
                                    <button
                                        onClick={() => handleBuyModeChange('kg')}
                                        className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                                            buyMode === 'kg'
                                                ? 'bg-white text-veci-dark shadow-sm ring-1 ring-slate-200'
                                                : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                    >
                                        <Scale className="w-4 h-4" />
                                        Por kilogramo
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* --- Quantity --- */}
                        <div className="mt-6">
                            <p className="text-sm font-semibold text-slate-500 mb-3">
                                {kgMode ? 'Cantidad (kg)' : equiv ? `Cantidad (${equivUnitLabel})` : isWeight ? `Cantidad (${(product.unit ?? 'Kg').toLowerCase()})` : 'Cantidad'}
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setQuantity((q) => Math.max(minQty, Math.round((q - step) * 100) / 100))}
                                    className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors"
                                >
                                    <Minus className="w-4 h-4 mx-auto" />
                                </button>
                                <span className="w-14 text-center font-extrabold text-lg text-slate-700">{(kgMode || isWeight) ? quantity.toFixed(1) : quantity}</span>
                                <button
                                    onClick={() => setQuantity((q) => Math.min(maxQty, Math.round((q + step) * 100) / 100))}
                                    disabled={quantity >= maxQty}
                                    className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700 font-bold hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-4 h-4 mx-auto" />
                                </button>
                            </div>
                            {equiv && quantity > 0 && (
                                <p className="mt-2 text-sm text-slate-500">
                                    {kgMode
                                        ? `${quantity.toFixed(1)} kg ≈ ${Math.round(quantity / equivW)} ${equivUnitLabel}`
                                        : `${quantity} ${equivUnitLabel} ≈ ${(quantity * equivW).toFixed(3)} kg`
                                    }
                                </p>
                            )}
                        </div>

                        {/* --- Add to Cart with running total --- */}
                        <button
                            onClick={() => {
                                if (kgMode) {
                                    addItem({ id: `${product.id}__kg`, name: product.name, price: rawPrice, image: currentImage, slug: product.slug, unit: product.unit }, quantity);
                                } else {
                                    addItem({ id: product.id, name: product.name, price: rawPrice, image: currentImage, slug: product.slug, unit: product.unit, equivLabel: product.equivLabel, equivWeight: product.equivWeight }, quantity);
                                }
                            }}
                            disabled={maxQty <= 0}
                            className="mt-8 w-full btn-primary rounded-full py-4 text-base font-extrabold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <ShoppingCart className="w-5 h-5" />
                            <span>Agregar al carrito</span>
                            <span className="ml-1 px-2.5 py-0.5 rounded-full bg-white/20 text-sm font-bold">{subtotalText}</span>
                        </button>

                        <div className="mt-8 pt-6 border-t border-slate-200/70">
                            <h2 className="font-extrabold text-slate-700 text-lg mb-2">Descripción</h2>
                            <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                                {product.description || 'Este producto no tiene descripción disponible por ahora.'}
                            </p>
                        </div>

                        {(product.tags || []).length > 0 && (
                            <div className="mt-6 flex flex-wrap gap-2">
                                {(product.tags || []).slice(0, 10).map((tag) => (
                                    <span key={tag} className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            <Footer />
        </main>
    );
}
