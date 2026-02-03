import { MapPin, RotateCw, Clock } from 'lucide-react';

const orders = [
    {
        id: '1',
        address: 'Calle Falsa 123, Santiago, CL',
        date: '16.ab 2024',
        total: '$14.95',
        items: 'Inito • 1 Detergent • Bananas',
        itemsCount: 3,
        status: 'completed',
        paymentMethod: 'VISA 1234',
        completedTime: '9:00'
    },
    {
        id: '2',
        address: 'Calle Falsa 123, Santiago, CL',
        date: '10.ab 2024',
        total: '$28.85',
        items: 'Bebidas • 8 Galletas • 1 Cereal',
        itemsCount: 3,
        status: 'completed',
        paymentMethod: 'Effectivo',
        completedTime: '9:00'
    },
    {
        id: '3',
        address: 'Calle Falsa 123, Santiago, CL',
        date: '03.ab 2024',
        total: '$7.80',
        items: 'Saggeie • 1 Soba • 1 Meat',
        itemsCount: 3,
        status: 'cancelled',
        paymentMethod: 'Effectivo',
        completedTime: '5:00'
    }
];

export function OrderHistory() {
    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl">
            <h3 className="text-xl font-bold text-slate-800 mb-6">Historial de pedidos</h3>

            <div className="space-y-4">
                {orders.map((order) => (
                    <div key={order.id} className="bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-white hover:shadow-md transition-all flex flex-col md:flex-row items-center justify-between gap-4">

                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-bold text-slate-700">{order.address}</h4>
                            </div>

                            <div className="flex items-center gap-3 text-sm text-slate-500 mb-3">
                                <span className="font-medium">{order.date}</span>
                                <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                                <div className="flex items-center gap-1 text-veci-primary font-bold bg-veci-primary/10 px-2 py-0.5 rounded-full text-xs">
                                    <RotateCw className="w-3 h-3" />
                                    Reordenar
                                </div>
                                <span className="font-bold text-slate-800 text-base ml-2">{order.total}</span>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                                <span className="font-bold text-veci-secondary">{order.id}. Envío</span>
                                <span>•</span>
                                <span className="truncate max-w-[200px]">{order.items}</span>
                            </div>

                            <div className="flex items-center gap-4 text-xs font-semibold">
                                <span className={order.status === 'completed' ? 'text-green-600 flex items-center gap-1' : 'text-red-500 flex items-center gap-1'}>
                                    {order.status === 'completed' ? (
                                        <>
                                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                            {order.total}
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                            {order.total}
                                        </>
                                    )}
                                </span>
                                <span className="text-slate-400 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {order.completedTime}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-3 min-w-[140px]">
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
                                {order.paymentMethod.includes('VISA') ? (
                                    <span className="font-bold text-blue-800 text-xs">VISA</span>
                                ) : (
                                    <MapPin className="w-4 h-4 text-purple-500" />
                                )}
                                <span className="text-sm font-medium text-slate-600">{order.paymentMethod.replace('VISA ', '')}</span>
                            </div>

                            <button className="px-5 py-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-sm font-bold shadow-md hover:shadow-lg hover:scale-105 transition-all">
                                Cambiar
                            </button>
                        </div>

                    </div>
                ))}
            </div>

            <div className="mt-8 flex justify-center">
                <button className="px-8 py-3 rounded-full bg-indigo-500/10 text-indigo-600 font-bold hover:bg-indigo-500/20 transition-colors">
                    Ver más pedidos
                </button>
            </div>

        </div>
    );
}
