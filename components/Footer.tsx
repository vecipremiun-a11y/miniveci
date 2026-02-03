export function Footer() {
    return (
        <footer className="w-full py-6 px-12 bg-white/40 backdrop-blur-md border-t border-white/50">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">

                <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center">f</div>
                    <div className="w-8 h-8 rounded-full bg-pink-500 text-white flex items-center justify-center">📷</div>
                    <div className="w-8 h-8 rounded-full bg-sky-400 text-white flex items-center justify-center">🐦</div>
                    <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">💬</div>
                </div>

                <div className="flex items-center gap-2 bg-white/50 px-4 py-2 rounded-full border border-slate-200">
                    <span className="text-slate-500 text-sm">/ inicio esit anteo</span>
                    <input type="email" placeholder="Tu correo electronico" className="bg-transparent text-sm outline-none w-40" />
                </div>

                <button className="bg-veci-purple text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-purple-700 transition-colors">
                    Suscribirme
                </button>

            </div>
            <div className="text-center text-xs text-slate-400 mt-4">
                VeciMarket © 2026 - Todos los derechos reservados.
            </div>
        </footer>
    );
}
