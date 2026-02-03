'use client';

import { motion } from 'framer-motion';

export function Hero() {
    return (
        <section className="relative pt-32 pb-20 px-6 md:px-12 flex flex-col items-center justify-center min-h-[85vh] text-center overflow-hidden">
            {/* Background Decorative Blobs */}
            <div className="absolute top-20 left-10 w-64 h-64 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
            <div className="absolute top-20 right-10 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-32 left-20 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>

            {/* Main Content Card - Glassmorphism */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="glass p-12 md:p-16 rounded-[3rem] max-w-5xl w-full flex flex-col items-center justify-center relative z-10"
            >
                <h1 className="text-4xl md:text-6xl font-extrabold text-veci-dark leading-tight mb-6">
                    Compra rápido, fresco <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-veci-dark to-slate-600">
                        y al instante.
                    </span>
                </h1>

                <p className="text-xl text-slate-500 mb-10 max-w-2xl leading-relaxed">
                    Stock en tiempo real, precios claros y entrega / retiro en local.
                    La mejor experiencia de compra para tu minimarket favorito.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
                    <button className="btn-primary px-10 py-4 rounded-full text-lg font-bold w-full sm:w-auto shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                        Comprar ahora
                    </button>

                    <button className="px-10 py-4 rounded-full text-lg font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-veci-secondary hover:text-veci-purple transition-all w-full sm:w-auto btn-secondary">
                        Explorar categorías
                    </button>
                </div>
            </motion.div>

            {/* Floating Elements (Simulating the side cards) */}
            {/* Left Top - Frutas */}
            <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="hidden lg:flex absolute top-40 left-[5%] glass-card p-6 rounded-3xl flex-col items-center gap-2 w-48 rotate-[-6deg] z-0 hover:z-20"
            >
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-4xl shadow-inner">
                    🫐
                </div>
                <span className="font-bold text-slate-700 text-lg">Frutas</span>
            </motion.div>

            {/* Left Bottom - Bebidas */}
            <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="hidden lg:flex absolute bottom-40 left-[5%] glass-card p-6 rounded-3xl flex-col items-center gap-2 w-48 rotate-[4deg] z-0 hover:z-20"
            >
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center text-4xl shadow-inner">
                    🥤
                </div>
                <span className="font-bold text-slate-700 text-lg">Bebidas</span>
            </motion.div>

            {/* Right Top - Snacks */}
            <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="hidden lg:flex absolute top-40 right-[5%] glass-card p-6 rounded-3xl flex-col items-center gap-2 w-48 rotate-[6deg] z-0 hover:z-20"
            >
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center text-4xl shadow-inner">
                    🍿
                </div>
                <span className="font-bold text-slate-700 text-lg">Snacks</span>
            </motion.div>

            {/* Right Bottom - Lácteos */}
            <motion.div
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="hidden lg:flex absolute bottom-40 right-[5%] glass-card p-6 rounded-3xl flex-col items-center gap-2 w-48 rotate-[-4deg] z-0 hover:z-20"
            >
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-4xl shadow-inner">
                    🥛
                </div>
                <span className="font-bold text-slate-700 text-lg">Lácteos</span>
            </motion.div>

        </section>
    );
}
