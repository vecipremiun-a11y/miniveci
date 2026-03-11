'use client';

import { AccountSidebar } from '@/components/account/AccountSidebar';
import { Heart } from 'lucide-react';
import Link from 'next/link';

export default function FavoritosPage() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-3"><AccountSidebar /></div>
            <div className="lg:col-span-9">
                <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl">
                    <h2 className="text-xl font-bold text-slate-800 mb-6">Mis Favoritos</h2>
                    <div className="text-center py-16">
                        <div className="w-20 h-20 rounded-full bg-pink-50 flex items-center justify-center mx-auto mb-4">
                            <Heart className="w-10 h-10 text-pink-300" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700 mb-2">Próximamente</h3>
                        <p className="text-slate-400 max-w-sm mx-auto">
                            Pronto podrás guardar tus productos favoritos para encontrarlos más rápido.
                        </p>
                        <Link href="/productos" className="inline-block mt-6 px-6 py-2.5 rounded-full bg-gradient-to-r from-veci-primary to-veci-secondary text-white text-sm font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all">
                            Explorar productos
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
