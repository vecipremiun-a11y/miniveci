'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ShoppingBag, Heart, CircleDollarSign, Pencil } from 'lucide-react';
import Link from 'next/link';

interface CustomerProfile {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    rut: string | null;
    address: string | null;
    comuna: string | null;
    city: string | null;
}

interface Summary {
    totalOrders: number;
    totalSpent: number;
    favorites: number;
}

export function ProfileSummary() {
    const { data: session } = useSession();
    const [profile, setProfile] = useState<CustomerProfile | null>(null);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!session?.user?.id) return;

        const fetchData = async () => {
            try {
                const [profileRes, summaryRes] = await Promise.all([
                    fetch('/api/store/customer'),
                    fetch('/api/store/customer/summary'),
                ]);
                if (profileRes.ok) setProfile(await profileRes.json());
                if (summaryRes.ok) setSummary(await summaryRes.json());
            } catch (error) {
                console.error('Error loading profile:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [session?.user?.id]);

    const displayName = profile
        ? `${profile.firstName} ${profile.lastName}`
        : session?.user?.name || 'Usuario';
    const displayEmail = profile?.email || session?.user?.email || '';
    const initials = displayName.charAt(0).toUpperCase();
    const addressParts = [profile?.address, profile?.comuna, profile?.city].filter(Boolean);
    const displayAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

    if (loading) {
        return (
            <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl mb-6 animate-pulse">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="w-24 h-24 rounded-full bg-gray-200 shrink-0" />
                        <div className="space-y-3">
                            <div className="h-6 w-40 bg-gray-200 rounded" />
                            <div className="h-4 w-52 bg-gray-200 rounded" />
                            <div className="h-4 w-32 bg-gray-200 rounded" />
                        </div>
                    </div>
                    <div className="w-full md:w-auto flex flex-col gap-3 min-w-[280px]">
                        <div className="h-14 bg-gray-200 rounded-2xl" />
                        <div className="h-14 bg-gray-200 rounded-2xl" />
                        <div className="h-14 bg-gray-200 rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">

                {/* User Info */}
                <div className="flex items-center gap-6">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-300 to-indigo-400 p-1 shadow-lg shrink-0">
                        <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                            {session?.user?.image ? (
                                <img src={session.user.image} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-3xl font-bold text-indigo-500">{initials}</span>
                            )}
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-1">{displayName}</h1>
                        <p className="text-slate-500 mb-1">{displayEmail}</p>
                        {profile?.phone && <p className="text-slate-500 text-sm mb-4">{profile.phone}</p>}

                        {displayAddress && (
                            <div className="flex items-center gap-2 text-slate-600 text-sm mb-4">
                                <span className="w-2 h-2 rounded-full bg-veci-primary inline-block"></span>
                                {displayAddress}
                            </div>
                        )}

                        <Link href="/cuenta/ajustes"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-semibold hover:bg-indigo-100 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                            Editar información
                        </Link>
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
                        <span className="font-bold text-slate-800 text-lg">{summary?.totalOrders ?? 0}</span>
                    </div>

                    <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-500">
                                <Heart className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-slate-700">Favoritos</span>
                        </div>
                        <span className="font-bold text-slate-800 text-lg">{summary?.favorites ?? 0}</span>
                    </div>

                    <div className="flex items-center justify-between bg-white/50 backdrop-blur-sm p-4 rounded-2xl border border-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-500">
                                <CircleDollarSign className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-slate-700">Gastado</span>
                        </div>
                        <span className="font-bold text-slate-800 text-lg">${(summary?.totalSpent ?? 0).toLocaleString('es-CL')}</span>
                    </div>
                </div>

            </div>
        </div>
    );
}
