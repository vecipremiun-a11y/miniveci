import { ShoppingBag, Heart, CircleDollarSign } from 'lucide-react';

export function ProfileSummary() {
    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">

                {/* User Info */}
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-300 to-indigo-400 p-1 shadow-lg shrink-0">
                        <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                            <img
                                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                                alt="User Avatar"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">Juan Pérez</h1>
                        <p className="text-slate-500 mb-1">juanperezz@email.com</p>
                        <p className="text-slate-500 text-sm mb-4">+57 300 456 7890</p>

                        <div className="flex items-center gap-2 text-slate-600 text-sm mb-4">
                            <span className="w-2 h-2 rounded-full bg-veci-primary inline-block"></span>
                            Calle Falsa 123, Santiago, CL
                        </div>

                        <button className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-semibold hover:bg-indigo-100 transition-colors">
                            Editar información
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="w-full md:w-auto flex flex-col gap-3 min-w-[280px]">
                    <h3 className="font-semibold text-slate-700 mb-1">Resumen</h3>

                    <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
                                <ShoppingBag className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-slate-700">Pedidos</span>
                        </div>
                        <span className="font-bold text-slate-800 text-lg">5</span>
                    </div>

                    <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-500">
                                <Heart className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-slate-700">Favoritos</span>
                        </div>
                        <span className="font-bold text-slate-800 text-lg">3</span>
                    </div>

                    <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-500">
                                <CircleDollarSign className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-slate-700">Gastado</span>
                        </div>
                        <span className="font-bold text-slate-800 text-lg">$48.50</span>
                    </div>
                </div>

            </div>
        </div>
    );
}
