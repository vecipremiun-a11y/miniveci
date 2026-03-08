'use client';

import Link from 'next/link';
import { Footer } from '@/components/Footer';
import { useCart } from '@/components/cart/CartProvider';

export default function CarritoPage() {
    const { items, subtotal, updateQuantity, removeItem, clearCart } = useCart();

    const formattedSubtotal = new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0,
    }).format(subtotal);

    return (
        <main className="min-h-screen bg-veci-bg selection:bg-veci-primary selection:text-white pb-20">
            <div className="h-32 md:h-40" />

            <div className="max-w-5xl mx-auto px-6 md:px-12">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl md:text-4xl font-extrabold text-veci-dark">Carrito</h1>
                    {items.length > 0 && (
                        <button
                            onClick={clearCart}
                            className="text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            Vaciar carrito
                        </button>
                    )}
                </div>

                {items.length === 0 ? (
                    <div className="bg-white/50 backdrop-blur-md border border-white rounded-3xl p-10 text-center">
                        <h2 className="text-xl font-bold text-slate-700">Tu carrito está vacío</h2>
                        <p className="text-slate-500 mt-2">Agrega productos desde la tienda para verlos aquí.</p>
                        <Link
                            href="/productos"
                            className="inline-flex mt-6 px-6 py-3 rounded-full btn-primary font-bold"
                        >
                            Ir a productos
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        <div className="bg-white/50 backdrop-blur-md border border-white rounded-3xl overflow-hidden">
                            {items.map((item) => {
                                const lineTotal = item.price * item.quantity;
                                const formattedLineTotal = new Intl.NumberFormat('es-CL', {
                                    style: 'currency',
                                    currency: 'CLP',
                                    maximumFractionDigits: 0,
                                }).format(lineTotal);

                                return (
                                    <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 border-b border-slate-200/70 last:border-b-0">
                                        <div className="w-20 h-20 relative rounded-2xl bg-white overflow-hidden">
                                            <img
                                                src={item.image || '/placeholder-product.svg'}
                                                alt={item.name}
                                                className="w-full h-full object-contain p-2"
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-800 truncate">{item.name}</p>
                                            <p className="text-sm text-slate-500">
                                                {new Intl.NumberFormat('es-CL', {
                                                    style: 'currency',
                                                    currency: 'CLP',
                                                    maximumFractionDigits: 0,
                                                }).format(item.price)} x {item.quantity}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                className="w-8 h-8 rounded-full bg-white border border-slate-200 font-bold text-slate-600"
                                            >
                                                -
                                            </button>
                                            <span className="w-6 text-center font-bold text-slate-700">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                className="w-8 h-8 rounded-full bg-white border border-slate-200 font-bold text-slate-600"
                                            >
                                                +
                                            </button>
                                        </div>

                                        <div className="sm:text-right">
                                            <p className="font-extrabold text-veci-dark">{formattedLineTotal}</p>
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                className="text-sm font-semibold text-red-500 hover:text-red-600 mt-1"
                                            >
                                                Quitar
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="bg-white/60 backdrop-blur-md border border-white rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <p className="text-lg font-bold text-slate-700">Subtotal</p>
                                <p className="text-2xl font-extrabold text-veci-dark">{formattedSubtotal}</p>
                            </div>
                            <Link href="/checkout" className="btn-primary px-6 py-3 rounded-full font-extrabold text-sm">
                                Ir al checkout
                            </Link>
                        </div>
                    </div>
                )}
            </div>

            <Footer />
        </main>
    );
}
