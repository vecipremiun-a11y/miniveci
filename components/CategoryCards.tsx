'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Plus, Search } from 'lucide-react';

interface CategoryItem {
    name: string;
    price: string;
    discount?: string;
}

interface Category {
    id: number;
    title: string;
    items: CategoryItem[];
    bgParams: string;
    icon: string;
    accentColor: string;
}

const categories: Category[] = [
    {
        id: 1,
        title: 'Abarrotes',
        items: [
            { name: 'Arroz', price: '2.00', discount: '30%' },
            { name: 'Atún en lata', price: '3.85', discount: '30%' },
            { name: 'Cereal', price: '2.95', discount: '30%' },
        ],
        bgParams: 'from-amber-200 to-orange-100',
        icon: '🍞',
        accentColor: 'text-amber-800'
    },
    {
        id: 2,
        title: 'Bebidas',
        items: [
            { name: 'Refrescos', price: '2.09' },
            { name: 'Jugos', price: '2.65' },
            { name: 'Agua', price: '2.95' },
        ],
        bgParams: 'from-orange-200 to-red-100',
        icon: '🥤',
        accentColor: 'text-orange-800'
    },
    {
        id: 3,
        title: 'Snacks',
        items: [
            { name: 'Papitas', price: '0.95' },
            { name: 'Galletas', price: '1.99' },
            { name: 'Chocolates', price: '2.45' },
        ],
        bgParams: 'from-purple-200 to-fuchsia-100',
        icon: '🍫',
        accentColor: 'text-purple-800'
    },
    {
        id: 4,
        title: 'Lácteos',
        items: [
            { name: 'Leche', price: '2.05' },
            { name: 'Yogures', price: '0.99' },
            { name: 'Queso', price: '1.09' },
        ],
        bgParams: 'from-blue-200 to-indigo-100',
        icon: '🧀',
        accentColor: 'text-blue-800'
    },
    {
        id: 5,
        title: 'Limpieza',
        items: [
            { name: 'Detergente', price: '1.00' },
            { name: 'Papel', price: '0.95' },
            { name: 'Helados', price: '2.99' }, // Funny category placement based on image, but keeping 'Limpieza' title
        ],
        bgParams: 'from-sky-200 to-cyan-100',
        icon: '🧼',
        accentColor: 'text-sky-800'
    }
];

export function CategoryCards() {
    return (
        <section className="py-20 px-6 md:px-12 relative">
            <div className="max-w-7xl mx-auto">
                {/* Search Bar Removed */}

                <h2 className="text-3xl font-bold text-center text-veci-dark mb-12">Categorías destacadas</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                    {categories.map((cat, idx) => (
                        <motion.div
                            key={cat.id}
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: idx * 0.1, duration: 0.5 }}
                            whileHover={{ scale: 1.02 }}
                            className={`rounded-3xl p-6 bg-gradient-to-b ${cat.bgParams} shadow-lg relative overflow-hidden h-[420px] flex flex-col`}
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-6 z-10">
                                <h3 className={`font-bold text-xl ${cat.accentColor}`}>{cat.title}</h3>
                                <div className="text-3xl">{cat.icon}</div>
                            </div>

                            {/* Items List */}
                            <div className="flex flex-col gap-4 z-10 flex-grow">
                                {cat.items.map((item, i) => (
                                    <div key={i} className="bg-white/40 backdrop-blur-sm p-3 rounded-2xl flex justify-between items-center group cursor-pointer hover:bg-white/60 transition-colors">
                                        <div>
                                            <p className="text-sm font-medium text-slate-700">{item.name}</p>
                                            <p className="text-sm font-bold text-slate-900">${item.price}</p>
                                        </div>
                                        {item.discount ? (
                                            <span className="text-xs font-bold bg-yellow-300 text-yellow-800 px-2 py-1 rounded-full">{item.discount}</span>
                                        ) : (
                                            <button className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-slate-700 hover:bg-white transition-colors">
                                                <ArrowRight className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Glass Reflection Effect */}
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/30 to-transparent pointer-events-none"></div>

                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
