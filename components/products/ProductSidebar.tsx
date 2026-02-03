'use client';

import { useState } from 'react';
import { Minus, Check } from 'lucide-react';

export function ProductSidebar() {
    const [priceRange, setPriceRange] = useState(50);
    const [inOffer, setInOffer] = useState(true);

    const categories = [
        { name: 'Abarrotes', count: 1000, icon: '🍞', color: 'bg-orange-100 text-orange-600' },
        { name: 'Bebidas', count: 550, icon: '🥤', color: 'bg-blue-100 text-blue-600' },
        { name: 'Lácteos', count: 400, icon: '🥛', color: 'bg-indigo-100 text-indigo-600' },
        { name: 'Snacks', count: 300, icon: '🍫', color: 'bg-purple-100 text-purple-600' },
        { name: 'Limpieza', count: 250, icon: '🧼', color: 'bg-teal-100 text-teal-600' },
        { name: 'Congelados', count: 200, icon: '❄️', color: 'bg-sky-100 text-sky-600' },
    ];

    return (
        <div className="w-full md:w-64 shrink-0 space-y-8 p-6 bg-white/40 backdrop-blur-xl rounded-[2rem] border border-white h-fit">

            {/* Title */}
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-veci-dark">Filtros</h3>
                <button className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400 hover:bg-indigo-100 transition-colors">
                    <Minus className="w-4 h-4" />
                </button>
            </div>

            {/* Price Filter */}
            <div>
                <h4 className="font-bold text-slate-700 mb-4">Precio</h4>
                <div className="relative w-full h-2 bg-indigo-100 rounded-full mb-4">
                    <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-pink-300 to-purple-400 rounded-full" style={{ width: '60%' }}></div>
                    <div className="absolute top-1/2 -translate-y-1/2 left-[60%] w-5 h-5 bg-white border-2 border-purple-400 rounded-full shadow-md cursor-pointer hover:scale-110 transition-transform"></div>
                </div>
                <div className="flex items-center justify-between text-sm font-bold text-slate-500">
                    <span>$1</span>
                    <span className="bg-white/50 px-3 py-1 rounded-full border border-white shadow-sm text-xs">Hasta $50</span>
                </div>
            </div>

            {/* Offer Checkbox */}
            <div
                onClick={() => setInOffer(!inOffer)}
                className="flex items-center gap-3 cursor-pointer group"
            >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${inOffer ? 'bg-purple-500 text-white shadow-lg shadow-purple-200' : 'bg-slate-100 text-transparent border border-slate-200'}`}>
                    <Check className="w-4 h-4" strokeWidth={3} />
                </div>
                <span className="font-medium text-slate-600 group-hover:text-purple-600 transition-colors">En oferta</span>
            </div>

            {/* Categories */}
            <div>
                <h4 className="font-bold text-slate-700 mb-4">Categorías</h4>
                <div className="flex flex-col gap-2">
                    {categories.map((cat) => (
                        <button key={cat.name} className="flex items-center justify-between p-2 rounded-xl hover:bg-white/60 transition-colors group text-left w-full">
                            <div className="flex items-center gap-3">
                                <span className="text-xl">{cat.icon}</span>
                                <span className="bg-transparent border-none text-slate-600 font-medium group-hover:text-purple-600 transition-colors">{cat.name}</span>
                            </div>
                            <span className="text-xs font-bold text-slate-400 bg-white/50 px-2 py-1 rounded-full group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                                ({cat.count})
                            </span>
                        </button>
                    ))}
                </div>
            </div>

        </div>
    );
}
