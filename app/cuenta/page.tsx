import { AccountSidebar } from '@/components/account/AccountSidebar';
import { ProfileSummary } from '@/components/account/ProfileSummary';
import { OrderHistory } from '@/components/account/OrderHistory';

export default function AccountPage() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Sidebar - Left */}
            <div className="lg:col-span-3">
                <AccountSidebar />
            </div>

            {/* Main Content - Right */}
            <div className="lg:col-span-9">
                <ProfileSummary />
                <OrderHistory />

                {/* Active Orders Section */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <ActiveOrderCard status="Empresa" />
                    <ActiveOrderCard status="En camino" />
                    <ActiveOrderCard status="Pago seguro" />
                </div>
            </div>
        </div>
    );
}

function ActiveOrderCard({ status }: { status: string }) {
    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-lg hover:bg-white/60 transition-colors">
            <div className="w-full aspect-video bg-indigo-50 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                <img src={`https://placehold.co/400x250/e0e7ff/6366f1?text=${status}`} alt={status} className="w-full h-full object-cover mix-blend-multiply" />
            </div>
            <h4 className="font-bold text-slate-700 mb-1">{status}</h4>
            <div className="flex items-center justify-between mb-4">
                <span className="text-slate-500 font-medium">$14.89</span>
                <span className="text-slate-500 font-medium line-through text-xs">$14.95</span>
            </div>
            <button className="w-full py-2 rounded-xl bg-violet-100 text-violet-600 font-bold text-sm hover:bg-violet-200 transition-colors">
                Ver pedido
            </button>
        </div>
    )
}
