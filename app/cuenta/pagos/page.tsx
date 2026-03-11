'use client';

import { AccountSidebar } from '@/components/account/AccountSidebar';
import { CreditCard } from 'lucide-react';

export default function PagosPage() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-3"><AccountSidebar /></div>
            <div className="lg:col-span-9">
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl">
                    <h2 className="text-xl font-bold text-slate-800 mb-6">Métodos de Pago</h2>
                    <div className="text-center py-16">
                        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                            <CreditCard className="w-10 h-10 text-emerald-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700 mb-2">Próximamente</h3>
                        <p className="text-slate-400 max-w-sm mx-auto">
                            Pronto podrás guardar tus métodos de pago favoritos para compras más rápidas y seguras.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
