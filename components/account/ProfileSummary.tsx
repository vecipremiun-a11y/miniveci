'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ShoppingBag, Heart, CircleDollarSign, Pencil, Crown } from 'lucide-react';
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
    avatarUrl: string | null;
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
    const [isSubscriber, setIsSubscriber] = useState(false);

    useEffect(() => {
        if (!session?.user?.id) return;

        const fetchData = async () => {
            try {
                const [profileRes, summaryRes, subRes] = await Promise.all([
                    fetch('/api/store/customer'),
                    fetch('/api/store/customer/summary'),
                    fetch('/api/store/customer/subscription'),
                ]);
                if (profileRes.ok) setProfile(await profileRes.json());
                if (summaryRes.ok) setSummary(await summaryRes.json());
                if (subRes.ok) {
                    const subData = await subRes.json();
                    setIsSubscriber(subData.subscription?.status === 'active');
                }
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
        <div className="bg-white/40 backdrop-blur-xl border border-white/60 rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-xl mb-4 sm:mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 sm:gap-8">

                {/* User Info */}
                <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto">
                    <div className={`w-16 h-16 sm:w-24 sm:h-24 rounded-full ${isSubscriber ? 'bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-500 shadow-amber-200' : 'bg-gradient-to-br from-blue-300 to-indigo-400'} p-1 shadow-lg shrink-0`}>
                        <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                            {(profile?.avatarUrl || session?.user?.image) ? (
                                <img src={profile?.avatarUrl || session!.user!.image!} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className={`text-2xl sm:text-3xl font-bold ${isSubscriber ? 'text-amber-600' : 'text-indigo-500'}`}>{initials}</span>
                            )}
                        </div>
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h1 className="text-lg sm:text-2xl font-bold text-slate-800 truncate">{displayName}</h1>
                            {isSubscriber && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold uppercase bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-700 rounded-full border border-amber-200">
                                    <Crown className="w-3 h-3" /> Premium
                                </span>
                            )}
                        </div>
                        <p className="text-slate-500 mb-1 text-xs sm:text-base truncate">{displayEmail}</p>
                        {profile?.phone && <p className="text-slate-500 text-xs sm:text-sm mb-2 sm:mb-4">{profile.phone}</p>}

                        {displayAddress && (
                            <div className="hidden sm:flex items-center gap-2 text-slate-600 text-sm mb-4">
                                <span className="w-2 h-2 rounded-full bg-veci-primary inline-block"></span>
                                {displayAddress}
                            </div>
                        )}

                        <Link href="/cuenta/ajustes"
                            className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-indigo-50 text-indigo-600 text-xs sm:text-sm font-semibold hover:bg-indigo-100 transition-colors">
                            <Pencil className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            Editar
                        </Link>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="w-full md:w-auto grid grid-cols-3 md:grid-cols-1 gap-2 sm:gap-3 md:min-w-[280px]">
                    <h3 className="hidden md:block font-semibold text-slate-700 mb-1 col-span-full">Resumen</h3>

                    <div className="flex flex-col md:flex-row items-center md:justify-between bg-white/50 backdrop-blur-sm p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-white gap-1 md:gap-3">
                        <div className="flex flex-col md:flex-row items-center gap-1 md:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
                                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <span className="font-medium text-slate-700 text-[11px] sm:text-base">Pedidos</span>
                        </div>
                        <span className="font-bold text-slate-800 text-sm sm:text-lg">{summary?.totalOrders ?? 0}</span>
                    </div>

                    <div className="flex flex-col md:flex-row items-center md:justify-between bg-white/50 backdrop-blur-sm p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-white gap-1 md:gap-3">
                        <div className="flex flex-col md:flex-row items-center gap-1 md:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-pink-100 flex items-center justify-center text-pink-500">
                                <Heart className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <span className="font-medium text-slate-700 text-[11px] sm:text-base">Favoritos</span>
                        </div>
                        <span className="font-bold text-slate-800 text-sm sm:text-lg">{summary?.favorites ?? 0}</span>
                    </div>

                    <div className="flex flex-col md:flex-row items-center md:justify-between bg-white/50 backdrop-blur-sm p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border border-white gap-1 md:gap-3">
                        <div className="flex flex-col md:flex-row items-center gap-1 md:gap-3">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-500">
                                <CircleDollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <span className="font-medium text-slate-700 text-[11px] sm:text-base">Gastado</span>
                        </div>
                        <span className="font-bold text-slate-800 text-xs sm:text-lg whitespace-nowrap">${(summary?.totalSpent ?? 0).toLocaleString('es-CL')}</span>
                    </div>
                </div>

            </div>
        </div>
    );
}
