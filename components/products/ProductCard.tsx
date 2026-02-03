'use client';

import { motion } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';

interface ProductCardProps {
    name: string;
    price: string;
    image: string; // Emoji for now
    isPopular?: boolean;
}

export function ProductCard({ name, price, image, isPopular }: ProductCardProps) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="glass-card p-4 rounded-[2rem] flex flex-col items-center relative group"
        >
            {/* Badge */}
            {isPopular && (
                <span className="absolute top-4 right-4 bg-orange-100 text-orange-500 text-xs font-bold px-3 py-1 rounded-full z-10">
                    Popular
                </span>
            )}

            {/* Image Area */}
            <div className="w-full h-40 flex items-center justify-center relative mb-4">
                {/* Glow effect behind image */}
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-200/50 to-pink-200/50 rounded-full blur-2xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
                <div className="text-8xl drop-shadow-2xl filter transform group-hover:scale-110 transition-transform duration-300">
                    {image}
                </div>
            </div>

            {/* Content */}
            <div className="w-full space-y-2">
                <h3 className="font-bold text-slate-800 text-lg">{name}</h3>
                <p className="font-extrabold text-veci-dark text-xl">${price}</p>

                {/* Actions Row */}
                <div className="flex items-center gap-2 mt-4">

                    {/* Quantity Selector */}
                    <div className="flex items-center gap-3 bg-white/60 rounded-full px-3 py-2 border border-white/50 shadow-sm">
                        <button className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                            <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold text-slate-700">1</span>
                        <button className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                            <Plus className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Add Button */}
                    <button className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-sm font-bold py-2.5 px-4 rounded-full shadow-lg hover:shadow-xl hover:shadow-purple-200 transition-all flex items-center justify-center">
                        Agregar
                    </button>

                </div>
            </div>

        </motion.div>
    );
}
