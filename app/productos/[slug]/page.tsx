'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Footer } from '@/components/Footer';
import { useCart } from '@/components/cart/CartProvider';
import type { ProductChangeEventPayload, StoreProductPayload } from '@/lib/store-product-types';
import { ChevronRight, Loader2, Minus, Plus, Star } from 'lucide-react';

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

    const priceText = useMemo(() => {
        if (!product) return '';
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP',
            maximumFractionDigits: 0,
        }).format(product.price);
    }, [product]);

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

                        <p className="text-4xl font-extrabold text-veci-dark mt-6">{priceText}</p>

                        <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                            <p className="text-sm text-slate-500">Disponibilidad</p>
                            <p className="font-bold text-slate-700">
                                {product.stock > 0 ? `Stock disponible: ${product.stock}` : 'Sin stock'}
                            </p>
                        </div>

                        <div className="mt-6">
                            <p className="text-sm font-semibold text-slate-500 mb-3">Cantidad</p>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                                    className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700 font-bold"
                                >
                                    <Minus className="w-4 h-4 mx-auto" />
                                </button>
                                <span className="w-10 text-center font-extrabold text-slate-700">{quantity}</span>
                                <button
                                    onClick={() => setQuantity((q) => q + 1)}
                                    disabled={quantity >= product.stock}
                                    className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-4 h-4 mx-auto" />
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => addItem({ id: product.id, name: product.name, price: product.price, image: currentImage, slug: product.slug }, quantity)}
                            disabled={product.stock <= 0}
                            className="mt-8 w-full btn-primary rounded-full py-3.5 text-base font-extrabold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Agregar al carrito
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
