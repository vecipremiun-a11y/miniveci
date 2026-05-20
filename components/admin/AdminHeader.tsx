"use client";

import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { useAdmin } from "./AdminProvider";
import { Menu, Bell, User, Search, LogOut, Store } from "lucide-react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

export default function AdminHeader() {
    const pathname = usePathname();
    const { toggleSidebar } = useAdmin();
    const sessionContext = useSession();
    const session = sessionContext?.data || null;
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setUserMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    // Simple breadcrumb logic
    const pathSegments = pathname.split("/").filter(Boolean);
    const breadcrumbs = pathSegments.map((segment, index) => {
        const href = "/" + pathSegments.slice(0, index + 1).join("/");
        const isLast = index === pathSegments.length - 1;
        const name = segment.charAt(0).toUpperCase() + segment.slice(1);

        return { name, href, isLast };
    });

    return (
        <header className="sticky top-0 z-30 flex h-14 sm:h-16 w-full items-center justify-between border-b bg-white px-2 sm:px-4 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <button
                    onClick={toggleSidebar}
                    className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                >
                    <Menu size={22} />
                </button>

                {/* Breadcrumbs */}
                <nav className="hidden md:flex items-center text-sm text-gray-500">
                    {breadcrumbs.map((crumb, index) => (
                        <div key={crumb.href} className="flex items-center">
                            {index > 0 && <span className="mx-2">/</span>}
                            {crumb.isLast ? (
                                <span className="font-semibold text-gray-900">{crumb.name}</span>
                            ) : (
                                <Link href={crumb.href} className="hover:text-gray-900 hover:underline">
                                    {crumb.name}
                                </Link>
                            )}
                        </div>
                    ))}
                </nav>
            </div>

            <div className="flex items-center gap-1 sm:gap-4">
                {/* View Store Link */}
                <Link
                    href="/"
                    target="_blank"
                    className="hidden sm:flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                    <Store size={18} />
                    <span>Ver Tienda</span>
                </Link>

                {/* Search Bar - Placeholder */}
                <div className="relative hidden md:block">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                        type="search"
                        placeholder="Buscar..."
                        className="h-9 w-64 rounded-md border border-gray-200 bg-gray-50 pl-9 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                {/* Notifications */}
                <button className="relative rounded-full p-2 text-gray-500 hover:bg-gray-100">
                    <Bell size={18} />
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                </button>

                {/* User Profile */}
                <div className="relative" ref={userMenuRef}>
                    <button
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        className="flex items-center gap-2 rounded-full bg-gray-100 p-1 sm:pr-3 hover:bg-gray-200"
                    >
                        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-slate-800 text-white">
                            {session?.user?.image ? (
                                <img src={session.user.image} alt="User" className="h-7 w-7 sm:h-8 sm:w-8 rounded-full" />
                            ) : (
                                <User size={14} />
                            )}
                        </div>
                        <span className="text-sm font-medium text-gray-700 hidden sm:block">
                            {session?.user?.name || "Usuario"}
                        </span>
                    </button>

                    {/* Dropdown Menu */}
                    {userMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-gray-100 z-50">
                            <div className="px-4 py-2 border-b border-gray-100">
                                <p className="text-sm font-medium text-gray-900 truncate">{session?.user?.email}</p>
                                <p className="text-xs text-gray-500 capitalize">{session?.user?.role || 'Admin'}</p>
                            </div>
                            <Link href="/" target="_blank" onClick={() => setUserMenuOpen(false)} className="sm:hidden flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                <Store className="h-4 w-4" />
                                Ver Tienda
                            </Link>
                            <Link href="/admin/perfil" onClick={() => setUserMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                Mi Perfil
                            </Link>
                            <Link href="/cuenta" onClick={() => setUserMenuOpen(false)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                Mi Cuenta Cliente
                            </Link>
                            <button
                                onClick={() => signOut({ callbackUrl: "/admin/login" })}
                                className="flex w-full items-center px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                            >
                                <LogOut className="mr-2 h-4 w-4" />
                                Cerrar Sesión
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
