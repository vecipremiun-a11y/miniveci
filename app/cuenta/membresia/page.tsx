'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Crown, Calendar, Shield, Sparkles, Star, Check, Zap, Gift, TrendingDown, Clock } from 'lucide-react';

interface Subscription {
    id: string;
    plan: string;
    status: string;
    startDate: string;
    endDate: string;
    price: number;
    paymentMethod: string | null;
}

export default function MembresiaPage() {
    const { data: session } = useSession();
    const [subscription, setSubscription] = useState<Subscription | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session?.user?.id) return;
        fetch('/api/store/customer/subscription')
            .then(res => res.json())
            .then(data => setSubscription(data.subscription))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [session?.user?.id]);

    const userName = session?.user?.name || 'Usuario';
    const initials = userName.charAt(0).toUpperCase();
    const isActive = subscription?.status === 'active';

    const formatDate = (d: string) => new Date(d).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

    const daysLeft = subscription?.endDate
        ? Math.max(0, Math.ceil((new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0;

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-72 rounded-3xl bg-gray-200" />
                <div className="h-48 rounded-3xl bg-gray-200" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {isActive ? (
                <>
                    {/* Premium Member Card */}
                    <div className="relative overflow-hidden rounded-3xl shadow-2xl">
                        {/* Background gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-yellow-500 to-orange-500" />
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.3),transparent_70%)]" />
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

                        {/* Sparkle decorations */}
                        <div className="absolute top-6 right-10 text-white/40">
                            <Sparkles className="w-8 h-8" />
                        </div>
                        <div className="absolute top-20 right-28 text-white/20">
                            <Star className="w-5 h-5 fill-current" />
                        </div>
                        <div className="absolute bottom-10 right-16 text-white/30">
                            <Star className="w-4 h-4 fill-current" />
                        </div>

                        <div className="relative p-8 md:p-10">
                            {/* Header */}
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    {/* Gold avatar ring */}
                                    <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-br from-yellow-200 via-white to-yellow-300 shadow-xl">
                                        <div className="w-full h-full rounded-full bg-gradient-to-br from-amber-600 to-yellow-600 flex items-center justify-center shadow-inner">
                                            {session?.user?.image ? (
                                                <img src={session.user.image} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                                            ) : (
                                                <span className="text-2xl font-black text-white">{initials}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-yellow-100 text-sm font-medium">Miembro Premium</p>
                                        <h2 className="text-2xl font-black text-white">{userName}</h2>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <Crown className="w-4 h-4 text-yellow-200" />
                                            <span className="text-yellow-100 text-sm font-semibold uppercase tracking-wider">Suscriptor</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/30">
                                    <p className="text-white/70 text-[10px] uppercase font-bold tracking-wider">Plan</p>
                                    <p className="text-white font-black text-lg">Premium</p>
                                </div>
                            </div>

                            {/* Card body - dates */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                                <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Calendar className="w-4 h-4 text-yellow-200" />
                                        <span className="text-white/70 text-[10px] uppercase font-bold tracking-wider">Inicio</span>
                                    </div>
                                    <p className="text-white font-bold text-sm">{formatDate(subscription!.startDate)}</p>
                                </div>
                                <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Calendar className="w-4 h-4 text-yellow-200" />
                                        <span className="text-white/70 text-[10px] uppercase font-bold tracking-wider">Vencimiento</span>
                                    </div>
                                    <p className="text-white font-bold text-sm">{formatDate(subscription!.endDate)}</p>
                                </div>
                                <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/20 col-span-2 md:col-span-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="w-4 h-4 text-yellow-200" />
                                        <span className="text-white/70 text-[10px] uppercase font-bold tracking-wider">Días restantes</span>
                                    </div>
                                    <p className="text-white font-black text-2xl">{daysLeft}</p>
                                </div>
                            </div>

                            {/* Progress bar */}
                            {subscription && (() => {
                                const total = Math.ceil((new Date(subscription.endDate).getTime() - new Date(subscription.startDate).getTime()) / (1000 * 60 * 60 * 24));
                                const elapsed = total - daysLeft;
                                const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
                                return (
                                    <div>
                                        <div className="flex justify-between mb-1.5">
                                            <span className="text-white/60 text-xs">Período de membresía</span>
                                            <span className="text-white/80 text-xs font-semibold">{Math.round(pct)}% transcurrido</span>
                                        </div>
                                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-white/80 to-yellow-200 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Benefits */}
                    <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl">
                        <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                            <Gift className="w-5 h-5 text-amber-500" />
                            Tus Beneficios Premium
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { icon: TrendingDown, title: 'Precios de Suscriptor', desc: 'Precios casi de costo en todos los productos', color: 'text-emerald-500 bg-emerald-50' },
                                { icon: Zap, title: 'Acceso Prioritario', desc: 'Primero en ver ofertas y productos nuevos', color: 'text-amber-500 bg-amber-50' },
                                { icon: Shield, title: 'Soporte Preferente', desc: 'Atención prioritaria en todas tus consultas', color: 'text-blue-500 bg-blue-50' },
                                { icon: Gift, title: 'Sorteos Exclusivos', desc: 'Participación en sorteos solo para suscriptores', color: 'text-purple-500 bg-purple-50' },
                            ].map((b) => (
                                <div key={b.title} className="flex items-start gap-3 p-4 rounded-2xl bg-white/50 border border-white/80">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${b.color}`}>
                                        <b.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-800 text-sm">{b.title}</p>
                                        <p className="text-slate-500 text-xs">{b.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Payment info */}
                    <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-xl">
                        <h3 className="text-sm font-bold text-slate-700 mb-3">Detalle de tu membresía</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-slate-500 text-xs">Plan</p>
                                <p className="font-semibold text-slate-800">Premium</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs">Precio pagado</p>
                                <p className="font-semibold text-slate-800">${subscription!.price.toLocaleString('es-CL')}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs">Método de pago</p>
                                <p className="font-semibold text-slate-800">{subscription!.paymentMethod || 'No registrado'}</p>
                            </div>
                            <div>
                                <p className="text-slate-500 text-xs">Estado</p>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                                    <Check className="w-3 h-3" /> Activa
                                </span>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                /* No subscription or expired */
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl text-center">
                    <div className="max-w-md mx-auto">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-100 to-yellow-100 flex items-center justify-center mx-auto mb-6">
                            <Crown className="w-10 h-10 text-amber-400" />
                        </div>

                        {subscription?.status === 'expired' ? (
                            <>
                                <h2 className="text-2xl font-bold text-slate-800 mb-2">Tu membresía ha expirado</h2>
                                <p className="text-slate-500 mb-2">Tu suscripción Premium venció el {formatDate(subscription.endDate)}.</p>
                                <p className="text-slate-500 mb-8">Renuévala para seguir disfrutando de precios exclusivos.</p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-2xl font-bold text-slate-800 mb-2">Hazte Premium</h2>
                                <p className="text-slate-500 mb-8">Accede a precios exclusivos casi de costo en todos nuestros productos.</p>
                            </>
                        )}

                        {/* Plan preview */}
                        <div className="relative overflow-hidden rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-6 mb-6 text-left">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-200/30 rounded-full -translate-y-1/2 translate-x-1/2" />
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg">
                                    <Crown className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">Plan Premium</h3>
                                    <p className="text-xs text-slate-500">Membresía mensual</p>
                                </div>
                                <div className="ml-auto text-right">
                                    <p className="text-sm text-slate-400 line-through">$14.990</p>
                                    <p className="text-2xl font-black text-amber-600">$9.990</p>
                                    <p className="text-[10px] text-slate-500">/mes</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {[
                                    'Precios casi de costo en todos los productos',
                                    'Acceso prioritario a ofertas',
                                    'Soporte preferente',
                                    'Sorteos exclusivos para suscriptores',
                                ].map(b => (
                                    <div key={b} className="flex items-center gap-2 text-sm text-slate-700">
                                        <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                                            <Check className="w-3 h-3 text-white" />
                                        </div>
                                        {b}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <Link
                            href="/suscripcion"
                            className="inline-flex items-center gap-2 px-8 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-bold shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 transition-all hover:scale-[1.02]"
                        >
                            <Crown className="w-5 h-5" />
                            {subscription?.status === 'expired' ? 'Renovar Membresía' : 'Comenzar ahora'}
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
