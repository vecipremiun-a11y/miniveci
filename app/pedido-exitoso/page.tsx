'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle2, Package, ArrowRight, Home, ShoppingBag } from 'lucide-react';
import { Footer } from '@/components/Footer';

function OrderSuccessContent() {
    const searchParams = useSearchParams();
    const orderNumber = searchParams.get('order') || '';
    const source = searchParams.get('source');
    const mpStatus = searchParams.get('status');
    const isMercadoPago = source === 'mp';
    const isPending = mpStatus === 'pending';

    return (
        <main className="min-h-screen bg-veci-bg selection:bg-veci-primary selection:text-white">
            <div className="h-32 md:h-40" />

            <div className="max-w-2xl mx-auto px-6 pb-20">
                {/* Success Card */}
                <div className="bg-white/70 backdrop-blur-md border border-white rounded-3xl p-8 md:p-12 text-center">
                    {/* Animated Check */}
                    <div className="relative mx-auto w-24 h-24 mb-6">
                        <div className={`absolute inset-0 ${isPending ? 'bg-amber-100' : 'bg-emerald-100'} rounded-full animate-ping opacity-20`} />
                        <div className={`relative w-24 h-24 ${isPending ? 'bg-gradient-to-br from-amber-400 to-amber-600' : 'bg-gradient-to-br from-emerald-400 to-emerald-600'} rounded-full flex items-center justify-center shadow-lg ${isPending ? 'shadow-amber-200' : 'shadow-emerald-200'}`}>
                            <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2.5} />
                        </div>
                    </div>

                    <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 mb-3">
                        {isPending ? '¡Pedido en proceso!' : '¡Pedido creado con éxito!'}
                    </h1>
                    <p className="text-slate-500 text-lg mb-8">
                        {isPending
                            ? 'Tu pago está siendo procesado por Mercado Pago. Te notificaremos cuando sea confirmado.'
                            : isMercadoPago
                                ? 'Tu pago fue aprobado y tu pedido será procesado pronto.'
                                : 'Tu pedido ha sido registrado correctamente y será procesado pronto.'
                        }
                    </p>

                    {/* Order Number */}
                    {orderNumber && (
                        <div className="bg-gradient-to-r from-veci-primary/5 to-veci-secondary/5 border border-veci-primary/20 rounded-2xl p-6 mb-8">
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Número de pedido</p>
                            <p className="text-3xl font-extrabold text-veci-primary tracking-wide">{orderNumber}</p>
                            <p className="text-xs text-slate-400 mt-2">Guarda este número para consultar el estado de tu pedido</p>
                        </div>
                    )}

                    {/* Info Cards */}
                    <div className="grid sm:grid-cols-2 gap-4 mb-8 text-left">
                        <div className="bg-blue-50/70 border border-blue-100 rounded-2xl p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Package className="w-4 h-4 text-blue-600" />
                                </div>
                                <p className="font-bold text-blue-800 text-sm">Preparación</p>
                            </div>
                            <p className="text-xs text-blue-600">
                                Tu pedido será preparado y te notificaremos cuando esté listo para la entrega.
                            </p>
                        </div>

                        <div className={`${isMercadoPago ? 'bg-purple-50/70 border-purple-100' : 'bg-amber-50/70 border-amber-100'} border rounded-2xl p-4`}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className={`w-8 h-8 ${isMercadoPago ? 'bg-purple-100' : 'bg-amber-100'} rounded-full flex items-center justify-center`}>
                                    <ShoppingBag className={`w-4 h-4 ${isMercadoPago ? 'text-purple-600' : 'text-amber-600'}`} />
                                </div>
                                <p className={`font-bold ${isMercadoPago ? 'text-purple-800' : 'text-amber-800'} text-sm`}>
                                    {isMercadoPago ? 'Pago con Mercado Pago' : 'Pago contra entrega'}
                                </p>
                            </div>
                            <p className={`text-xs ${isMercadoPago ? 'text-purple-600' : 'text-amber-600'}`}>
                                {isPending
                                    ? 'Tu pago está pendiente de confirmación. Recibirás una notificación cuando sea aprobado.'
                                    : isMercadoPago
                                        ? 'Tu pago fue procesado exitosamente a través de Mercado Pago.'
                                        : 'Recuerda tener el pago listo cuando llegue tu pedido a domicilio.'
                                }
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link
                            href="/productos"
                            className="btn-primary inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-extrabold text-base shadow-md hover:shadow-lg transition-all"
                        >
                            Seguir comprando
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-base bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                        >
                            <Home className="w-4 h-4" />
                            Ir al inicio
                        </Link>
                    </div>
                </div>

                {/* Bottom message */}
                <p className="text-center text-sm text-slate-400 mt-6">
                    Si tienes dudas sobre tu pedido, contáctanos por WhatsApp o al correo de soporte.
                </p>
            </div>

            <Footer />
        </main>
    );
}

export default function PedidoExitosoPage() {
    return (
        <Suspense fallback={
            <main className="min-h-screen bg-veci-bg flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-veci-primary border-t-transparent rounded-full animate-spin" />
            </main>
        }>
            <OrderSuccessContent />
        </Suspense>
    );
}
