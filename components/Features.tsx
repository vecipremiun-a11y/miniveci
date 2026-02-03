'use client';

import { ShieldCheck, Truck, Clock } from 'lucide-react';

export function Features() {
    return (
        <section className="py-20 px-6 md:px-12 mb-20">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Feature 1 */}
                <div className="bg-white/60 backdrop-blur-md p-8 rounded-3xl border border-white flex items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                        <Clock className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Stock en tiempo real</h3>
                        <p className="text-slate-500 text-sm mt-1">Retire notificaciones con tisúes actuales.</p>
                    </div>
                </div>

                {/* Feature 2 */}
                <div className="bg-white/60 backdrop-blur-md p-8 rounded-3xl border border-white flex items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
                        <Truck className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Retiro en local o domicilio</h3>
                        <p className="text-slate-500 text-sm mt-1">Seclosae stoede nons tu proximg productel.</p>
                    </div>
                </div>

                {/* Feature 3 */}
                <div className="bg-white/60 backdrop-blur-md p-8 rounded-3xl border border-white flex items-center gap-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">Pago seguro y rápido</h3>
                        <p className="text-slate-500 text-sm mt-1">Pagotiae rapido, prapmentos con transce.ones.</p>
                    </div>
                </div>

            </div>
        </section>
    );
}
