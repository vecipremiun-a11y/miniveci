'use client';

import { motion } from 'framer-motion';

export function Deals() {
    return (
        <section className="py-10 px-6 md:px-12">
            <div className="max-w-7xl mx-auto">
                <h2 className="text-3xl font-bold text-center text-veci-dark mb-10">Ofertas del día ✨</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">

                    {/* Deal 1: Bananas */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="glass-card p-6 rounded-3xl flex flex-col justify-between h-64 relative overflow-hidden group"
                    >
                        <div className="z-10">
                            <h3 className="text-2xl font-bold text-slate-800">Bananas</h3>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-lg text-slate-400 line-through">$6.99</span>
                            </div>
                            <button className="mt-6 bg-gradient-to-r from-orange-300 to-rose-300 text-white font-bold py-2 px-6 rounded-full shadow-lg transform active:scale-95 transition-all">
                                Comprar
                            </button>
                            <p className="mt-2 text-xs text-slate-400">Solo por $1.40</p>
                        </div>

                        {/* Image Placeholder */}
                        <div className="absolute -bottom-4 -right-4 w-40 h-40 bg-yellow-100 rounded-full flex items-center justify-center text-6xl group-hover:scale-110 transition-transform duration-500">
                            🍌
                        </div>
                    </motion.div>

                    {/* Deal 2: Delivery/Scooter */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-3xl flex flex-col justify-between h-64 relative overflow-hidden border border-white/50"
                    >
                        <div className="z-10">
                            <h3 className="text-2xl font-bold text-slate-800">Bananas</h3>
                            <h4 className="text-xl font-bold text-slate-800">$1.40</h4>

                            <button className="mt-6 bg-indigo-400 text-white font-bold py-2 px-6 rounded-full shadow-lg transform active:scale-95 transition-all">
                                Agregar
                            </button>
                        </div>

                        {/* Image Placeholder */}
                        <div className="absolute bottom-4 right-4 text-8xl transform rotate-12 group-hover:rotate-0 transition-transform duration-500">
                            🛵
                        </div>
                    </motion.div>

                    {/* Deal 3: Cleaning */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="bg-blue-50/50 backdrop-blur-sm p-6 rounded-3xl flex flex-col justify-between h-64 relative overflow-hidden border border-white/50"
                    >
                        <div className="z-10">
                            <h3 className="text-2xl font-bold text-slate-800">Limpieza</h3>
                            <p className="text-slate-500">Jabón</p>

                            <div className="mt-8 text-slate-400 text-sm">
                                6.00 <br />
                                3.0.3.0
                            </div>
                        </div>

                        {/* Image Placeholder */}
                        <div className="absolute bottom-0 right-0 w-48 h-32 bg-blue-100 rounded-tl-[4rem] flex items-center justify-center text-6xl shadow-inner group-hover:scale-105 transition-transform">
                            🧺
                        </div>
                    </motion.div>

                </div>
            </div>
        </section>
    );
}
