'use client';

import Link from 'next/link';
import { Home, ShoppingBag, Heart, MapPin, CreditCard, Settings, LogOut } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const menuItems = [
    { icon: Home, label: 'Panel', href: '/cuenta' },
    { icon: ShoppingBag, label: 'Mis Pedidos', href: '/cuenta/pedidos' },
    { icon: Heart, label: 'Favoritos', href: '/cuenta/favoritos' },
    { icon: MapPin, label: 'Direcciones', href: '/cuenta/direcciones' },
    { icon: CreditCard, label: 'Métodos de pago', href: '/cuenta/pagos' },
    { icon: Settings, label: 'Ajustes', href: '/cuenta/ajustes' },
];

export function AccountSidebar() {
    const pathname = usePathname();

    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-xl h-fit">

            {/* User Profile Mini */}
            <div className="flex flex-col items-center mb-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-300 to-indigo-400 p-1 shadow-lg mb-3">
                    <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                        <img
                            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
                            alt="User Avatar"
                            className="w-full h-full object-cover"
                        />
                    </div>
                </div>
                <h2 className="font-bold text-slate-800 text-lg">¡Hola, Juan Pérez!</h2>
                <p className="text-slate-500 text-sm">juanperezz@email.com</p>
            </div>

            {/* Navigation */}
            <nav className="space-y-2 mb-8">
                {menuItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-medium text-sm",
                                isActive
                                    ? "bg-gradient-to-r from-veci-primary to-veci-secondary text-white shadow-lg shadow-veci-primary/25"
                                    : "text-slate-600 hover:bg-white/50 hover:text-veci-primary"
                            )}
                        >
                            <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-400 group-hover:text-veci-primary")} />
                            <span>{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Logout */}
            <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-50 text-red-500 font-medium hover:bg-red-100 transition-colors">
                <LogOut className="w-5 h-5" />
                <span>Cerrar sesión</span>
            </button>

        </div>
    );
}
