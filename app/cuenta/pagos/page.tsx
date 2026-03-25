'use client';

import { CreditCard, Trash2, Star, Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PaymentMethod {
    id: string;
    brand: string;
    lastFourDigits: string;
    expirationMonth: number | null;
    expirationYear: number | null;
    cardholderName: string | null;
    isDefault: boolean;
    createdAt: string;
}

const BRAND_ICONS: Record<string, string> = {
    visa: '💳',
    mastercard: '💳',
    amex: '💳',
    default: '💳',
};

const BRAND_COLORS: Record<string, string> = {
    visa: 'from-blue-500 to-blue-700',
    mastercard: 'from-red-500 to-orange-500',
    amex: 'from-emerald-500 to-teal-600',
    default: 'from-slate-500 to-slate-700',
};

function getBrandName(brand: string) {
    const names: Record<string, string> = {
        visa: 'Visa',
        mastercard: 'Mastercard',
        master: 'Mastercard',
        amex: 'American Express',
    };
    return names[brand?.toLowerCase()] || brand || 'Tarjeta';
}

export default function PagosPage() {
    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);

    const fetchMethods = async () => {
        try {
            const res = await fetch('/api/store/customer/payment-methods');
            if (res.ok) {
                setMethods(await res.json());
            }
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchMethods(); }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que deseas eliminar esta tarjeta?')) return;
        setDeletingId(id);
        try {
            const res = await fetch(`/api/store/customer/payment-methods?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setMethods(prev => prev.filter(m => m.id !== id));
                // Refresh to get updated defaults
                fetchMethods();
            }
        } catch { /* ignore */ } finally {
            setDeletingId(null);
        }
    };

    const handleSetDefault = async (id: string) => {
        setSettingDefaultId(id);
        try {
            const res = await fetch('/api/store/customer/payment-methods', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            if (res.ok) {
                setMethods(prev => prev.map(m => ({ ...m, isDefault: m.id === id })));
            }
        } catch { /* ignore */ } finally {
            setSettingDefaultId(null);
        }
    };

    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800">Métodos de Pago</h2>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Protegido por Mercado Pago
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                </div>
            ) : methods.length === 0 ? (
                <div className="text-center py-16">
                    <div className="w-20 h-20 rounded-full bg-purple-50 flex items-center justify-center mx-auto mb-4">
                        <CreditCard className="w-10 h-10 text-purple-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 mb-2">Sin tarjetas guardadas</h3>
                    <p className="text-slate-400 max-w-sm mx-auto text-sm">
                        Las tarjetas se guardan automáticamente cuando realizas un pago con Mercado Pago en el checkout.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {methods.map((method) => {
                        const brandKey = method.brand?.toLowerCase() || 'default';
                        const gradient = BRAND_COLORS[brandKey] || BRAND_COLORS.default;

                        return (
                            <div
                                key={method.id}
                                className={`relative rounded-2xl overflow-hidden transition-all ${
                                    method.isDefault ? 'ring-2 ring-purple-400 shadow-lg shadow-purple-100' : 'shadow-md'
                                }`}
                            >
                                {/* Card visual */}
                                <div className={`bg-gradient-to-br ${gradient} p-5 text-white`}>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider opacity-70">
                                                {getBrandName(method.brand)}
                                            </p>
                                            <p className="text-xl font-extrabold tracking-[0.2em] mt-2">
                                                •••• •••• •••• {method.lastFourDigits}
                                            </p>
                                        </div>
                                        <span className="text-2xl">{BRAND_ICONS[brandKey] || BRAND_ICONS.default}</span>
                                    </div>
                                    <div className="flex items-end justify-between mt-4">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider opacity-60">Titular</p>
                                            <p className="text-sm font-bold">
                                                {method.cardholderName || 'Titular'}
                                            </p>
                                        </div>
                                        {method.expirationMonth && method.expirationYear && (
                                            <div className="text-right">
                                                <p className="text-[10px] uppercase tracking-wider opacity-60">Vence</p>
                                                <p className="text-sm font-bold">
                                                    {String(method.expirationMonth).padStart(2, '0')}/{String(method.expirationYear).slice(-2)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    {method.isDefault && (
                                        <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                                            <Star className="w-3 h-3 fill-current" />
                                            Predeterminada
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="bg-white p-3 flex items-center justify-between">
                                    {!method.isDefault ? (
                                        <button
                                            onClick={() => handleSetDefault(method.id)}
                                            disabled={settingDefaultId === method.id}
                                            className="text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            {settingDefaultId === method.id ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Star className="w-3.5 h-3.5" />
                                            )}
                                            Marcar como predeterminada
                                        </button>
                                    ) : (
                                        <span className="text-xs font-bold text-slate-400">Tarjeta predeterminada</span>
                                    )}
                                    <button
                                        onClick={() => handleDelete(method.id)}
                                        disabled={deletingId === method.id}
                                        className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        {deletingId === method.id ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-3.5 h-3.5" />
                                        )}
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500 leading-relaxed">
                    <strong className="text-slate-700">¿Cómo funciona?</strong> Cuando realizas un pago con Mercado Pago, tus datos de tarjeta se guardan de forma segura en los servidores de Mercado Pago. Nosotros solo almacenamos los últimos 4 dígitos y la marca para tu referencia. Puedes eliminar tus tarjetas en cualquier momento.
                </p>
            </div>
        </div>
    );
}
