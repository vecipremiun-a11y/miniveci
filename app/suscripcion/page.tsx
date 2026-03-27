'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Footer } from '@/components/Footer';
import { BadgeCheck, Crown, Gem, Loader2, Sparkles, Star } from 'lucide-react';

const benefits = [
    'Descuentos en todos los productos por 1 mes',
    'Productos especiales para miembros',
    'Sorteos especiales para miembros',
    'Sin mínimo de compra',
    'Prueba ahora y paga después de 5 días',
    'Envíos preferentes para miembros',
];

export default function SuscripcionPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [hasActive, setHasActive] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        if (status === 'authenticated' && session?.user?.role === 'customer') {
            fetch('/api/store/customer/subscription')
                .then(r => r.json())
                .then(data => {
                    if (data.subscription?.status === 'active') {
                        setHasActive(true);
                    }
                })
                .finally(() => setChecking(false));
        } else {
            setChecking(false);
        }
    }, [status, session]);

    const handleSubscribe = async () => {
        if (status !== 'authenticated' || session?.user?.role !== 'customer') {
            router.push('/login?redirect=/suscripcion');
            return;
        }

        if (hasActive) {
            router.push('/cuenta/membresia');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/store/subscription/create', { method: 'POST' });
            const data = await res.json();
            if (data.initPoint) {
                window.location.href = data.initPoint;
            } else {
                alert(data.error || 'Error al crear suscripción');
            }
        } catch {
            alert('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-veci-bg selection:bg-veci-primary selection:text-white pb-20">
            <div className="h-32 md:h-40" />

            <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-10">
                <section className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
                    <div className="rounded-3xl p-6 bg-gradient-to-br from-veci-dark via-violet-600 to-fuchsia-600 text-white shadow-xl">
                        <div className="inline-flex items-center gap-2 text-xs font-bold bg-white/15 rounded-full px-3 py-1.5 border border-white/20">
                            <Crown className="w-3.5 h-3.5" />
                            PREMIUM
                        </div>
                        <div className="mt-5 rounded-2xl border border-white/20 bg-white/10 p-4 text-center">
                            <p className="text-3xl font-extrabold tracking-tight">Super</p>
                            <p className="text-3xl font-extrabold tracking-tight">Ofertas</p>
                            <p className="text-sm font-semibold mt-1 text-white/85">Exclusivas</p>
                        </div>
                        <div className="mt-4 flex justify-center gap-1 text-yellow-200">
                            <Star className="w-4 h-4 fill-current" />
                            <Star className="w-4 h-4 fill-current" />
                            <Star className="w-4 h-4 fill-current" />
                        </div>
                    </div>

                    <div className="rounded-3xl border border-white bg-white/55 backdrop-blur-md p-6 md:p-8">
                        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 leading-tight">
                            Únete a la Revolución del Ahorro
                        </h1>
                        <p className="mt-3 text-slate-600 text-lg leading-relaxed max-w-4xl">
                            Suscríbete hoy y accede a ofertas exclusivas, descuentos irrepetibles y beneficios premium
                            para tus compras diarias.
                        </p>

                        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white text-sm font-extrabold px-4 py-2">
                            <Sparkles className="w-4 h-4" />
                            Precio especial · Solo primeros 20 suscriptores
                        </div>

                        <div className="mt-6">
                            <div className="flex items-center justify-between text-sm font-bold text-slate-700">
                                <span className="inline-flex items-center gap-2"><Gem className="w-4 h-4 text-violet-500" />Miembros Premium Activos</span>
                                <span>3/20 cupos</span>
                            </div>
                            <div className="mt-2 w-full h-3 rounded-full bg-slate-200/80 overflow-hidden">
                                <div className="h-full w-[15%] rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" />
                            </div>
                            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 font-semibold">
                                <span>Últimos cupos disponibles</span>
                                <span>Oferta por tiempo limitado</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="max-w-2xl mx-auto rounded-3xl border border-white bg-white/70 backdrop-blur-md p-6 md:p-8 shadow-xl shadow-violet-200/30">
                    <div className="mx-auto w-fit -mt-12 mb-4">
                        <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-sm font-extrabold px-4 py-2 shadow-lg">
                            5 DÍAS GRATIS
                        </span>
                    </div>

                    <div className="text-center">
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 text-xs font-extrabold px-3 py-1.5">
                            <BadgeCheck className="w-3.5 h-3.5" />
                            Plan más popular
                        </span>
                        <h2 className="mt-5 text-5xl font-black leading-[0.95]">
                            <span className="bg-gradient-to-r from-cyan-500 to-violet-600 bg-clip-text text-transparent">Premium</span>
                            <br />
                            <span className="text-slate-800">Membership</span>
                        </h2>

                        <p className="mt-5 text-6xl font-black bg-gradient-to-r from-cyan-500 to-violet-600 bg-clip-text text-transparent">$9.990</p>
                        <p className="mt-2 text-2xl font-bold text-slate-400 line-through">Normal: $14.990</p>
                        <p className="mt-1 text-sm font-semibold text-slate-500">Cobro mensual · Cancela cuando quieras</p>
                    </div>

                    <div className="mt-7 space-y-3">
                        {benefits.map((benefit) => (
                            <div key={benefit} className="rounded-2xl border border-slate-200/70 bg-slate-50/80 p-4 flex items-center gap-3">
                                <span className="w-7 h-7 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-600 text-white font-black flex items-center justify-center">✓</span>
                                <p className="font-semibold text-slate-700">{benefit}</p>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={handleSubscribe}
                        disabled={loading || checking}
                        className="mt-8 w-full inline-flex items-center justify-center gap-2 btn-secondary rounded-2xl py-4 text-lg font-extrabold shadow-xl disabled:opacity-60 cursor-pointer"
                    >
                        {loading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Procesando...</>
                        ) : hasActive ? (
                            <><Crown className="w-5 h-5" /> Ya eres Premium — Ver membresía</>
                        ) : (
                            <><Crown className="w-5 h-5" /> Comenzar ahora</>
                        )}
                    </button>

                    <div className="mt-4 text-center text-xs font-semibold text-slate-500 flex items-center justify-center gap-4 flex-wrap">
                        <span>Activación inmediata</span>
                        <span>Cancela cuando quieras</span>
                        <span>Soporte 24/7</span>
                    </div>
                </section>
            </div>

            <Footer />
        </main>
    );
}
