'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Home, ShoppingBag, Heart, MapPin, CreditCard, Settings, LogOut, Shield, Crown } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';

const ADMIN_ROLES = ['owner', 'admin', 'preparacion', 'reparto', 'contenido'];

const menuItems = [
    { icon: Home, label: 'Panel', href: '/cuenta' },
    { icon: Crown, label: 'Mi Membresía', href: '/cuenta/membresia' },
    { icon: ShoppingBag, label: 'Mis Pedidos', href: '/cuenta/pedidos' },
    { icon: Heart, label: 'Favoritos', href: '/cuenta/favoritos' },
    { icon: MapPin, label: 'Direcciones', href: '/cuenta/direcciones' },
    { icon: CreditCard, label: 'Métodos de pago', href: '/cuenta/pagos' },
    { icon: Settings, label: 'Ajustes', href: '/cuenta/ajustes' },
];

export function AccountSidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [isSubscriber, setIsSubscriber] = useState(false);

    useEffect(() => {
        if (!session?.user?.id || session.user.role !== 'customer') return;
        fetch('/api/store/customer/subscription')
            .then(r => r.json())
            .then(d => setIsSubscriber(d.subscription?.status === 'active'))
            .catch(() => {});
    }, [session?.user?.id, session?.user?.role]);

    const isAdmin = session?.user?.role && ADMIN_ROLES.includes(session.user.role);
    const userName = session?.user?.name || 'Usuario';
    const userEmail = session?.user?.email || '';
    const initials = userName.charAt(0).toUpperCase();

    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-6 shadow-xl h-fit">

            {/* User Profile Mini */}
            <div className="flex flex-col items-center mb-8">
                <div className={`w-20 h-20 rounded-full ${isSubscriber ? 'bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 shadow-amber-200' : 'bg-gradient-to-br from-blue-300 to-indigo-400'} p-1 shadow-lg mb-3`}>
                    <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                        {session?.user?.image ? (
                            <img
                                src={session.user.image}
                                alt="User Avatar"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <span className={`text-2xl font-bold ${isSubscriber ? 'text-amber-600' : 'text-indigo-500'}`}>{initials}</span>
                        )}
                    </div>
                </div>
                <h2 className="font-bold text-slate-800 text-lg">¡Hola, {userName}!</h2>
                <p className="text-slate-500 text-sm">{userEmail}</p>
                {isSubscriber && (
                    <span className="mt-2 inline-flex items-center gap-1 px-3 py-1 text-[11px] font-bold uppercase bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 rounded-full border border-amber-200">
                        <Crown className="w-3 h-3" /> Suscriptor
                    </span>
                )}
                {isAdmin && (
                    <span className="mt-2 inline-block px-3 py-1 text-[11px] font-bold uppercase bg-indigo-100 text-indigo-600 rounded-full">
                        {session?.user?.role}
                    </span>
                )}
            </div>

            {/* Admin Link */}
            {isAdmin && (
                <div className="mb-4">
                    <Link
                        href="/admin"
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-50 text-indigo-600 font-semibold text-sm hover:bg-indigo-100 transition-colors"
                    >
                        <Shield className="w-5 h-5" />
                        <span>Ir al Panel Admin</span>
                    </Link>
                </div>
            )}

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
            <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-50 text-red-500 font-medium hover:bg-red-100 transition-colors"
            >
                <LogOut className="w-5 h-5" />
                <span>Cerrar sesión</span>
            </button>

        </div>
    );
}
