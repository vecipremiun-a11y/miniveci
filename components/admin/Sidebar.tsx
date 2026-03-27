"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAdmin } from "./AdminProvider";
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    Tag,
    Palette,
    Truck,
    CreditCard,
    BarChart3,
    UserCog,
    Settings,
    X,
    Crown,
    ChevronDown,
    UsersRound,
} from "lucide-react";
import { useState, useEffect } from "react";

interface SidebarProps {
    className?: string;
}

interface MenuItem {
    name: string;
    href: string;
    icon: React.ComponentType<{ size?: number }>;
    children?: { name: string; href: string; icon: React.ComponentType<{ size?: number }> }[];
}

const menuItems: MenuItem[] = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Catálogo", href: "/admin/catalogo", icon: Package },
    { name: "Pedidos", href: "/admin/pedidos", icon: ShoppingCart },
    { name: "Clientes", href: "/admin/clientes", icon: Users },
    {
        name: "Membresías", href: "/admin/membresias", icon: Crown,
        children: [
            { name: "Panel", href: "/admin/membresias", icon: BarChart3 },
            { name: "Suscriptores", href: "/admin/membresias/suscriptores", icon: UsersRound },
        ],
    },
    { name: "Promociones", href: "/admin/promociones", icon: Tag },
    { name: "Contenido", href: "/admin/contenido", icon: Palette },
    { name: "Envíos", href: "/admin/envios", icon: Truck },
    { name: "Pagos", href: "/admin/pagos", icon: CreditCard },
    { name: "Reportes", href: "/admin/reportes", icon: BarChart3 },
    { name: "Usuarios", href: "/admin/usuarios", icon: UserCog },
    { name: "Configuración", href: "/admin/configuracion", icon: Settings },
];

export default function Sidebar({ className }: SidebarProps) {
    const pathname = usePathname();
    const { sidebarOpen, setSidebarOpen, isMobile } = useAdmin();
    const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);

    // Auto-expand submenu when navigating to a child route
    useEffect(() => {
        for (const item of menuItems) {
            if (item.children && pathname.startsWith(item.href)) {
                setOpenSubmenu(item.href);
                return;
            }
        }
    }, [pathname]);

    return (
        <>
            {/* Mobile overlay */}
            {isMobile && sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 transition-all duration-300",
                    sidebarOpen ? "w-64" : "w-0 lg:w-20",
                    className
                )}
            >
                {/* Header */}
                <div className="flex h-16 items-center justify-between px-4 text-white">
                    <div className={cn("flex items-center gap-2 font-bold transition-opacity", !sidebarOpen && "lg:opacity-0")}>
                        <span className="text-xl">MiniVeci</span>
                    </div>
                    {isMobile && (
                        <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-white/70 hover:text-white">
                            <X size={24} />
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-4">
                    <ul className="space-y-1 px-2">
                        {menuItems.map((item) => {
                            const isActive = item.children
                                ? pathname.startsWith(item.href)
                                : pathname === item.href;
                            const Icon = item.icon;
                            const isSubmenuOpen = openSubmenu === item.href;

                            if (item.children) {
                                return (
                                    <li key={item.href}>
                                        <button
                                            onClick={() => {
                                                if (!sidebarOpen) return;
                                                setOpenSubmenu(isSubmenuOpen ? null : item.href);
                                            }}
                                            className={cn(
                                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors w-full cursor-pointer",
                                                isActive
                                                    ? "bg-slate-800 text-white"
                                                    : "text-slate-400 hover:bg-slate-800 hover:text-white",
                                                !sidebarOpen && "justify-center px-2"
                                            )}
                                            title={!sidebarOpen ? item.name : undefined}
                                        >
                                            <Icon size={20} />
                                            <span
                                                className={cn(
                                                    "flex-1 text-left transition-all duration-300",
                                                    !sidebarOpen && "w-0 overflow-hidden opacity-0 lg:hidden"
                                                )}
                                            >
                                                {item.name}
                                            </span>
                                            {sidebarOpen && (
                                                <ChevronDown
                                                    size={16}
                                                    className={cn("transition-transform", isSubmenuOpen && "rotate-180")}
                                                />
                                            )}
                                        </button>
                                        {sidebarOpen && isSubmenuOpen && (
                                            <ul className="mt-1 ml-4 space-y-1 border-l border-slate-700 pl-3">
                                                {item.children.map((child) => {
                                                    const isChildActive = pathname === child.href;
                                                    const ChildIcon = child.icon;
                                                    return (
                                                        <li key={child.href}>
                                                            <Link
                                                                href={child.href}
                                                                onClick={() => isMobile && setSidebarOpen(false)}
                                                                className={cn(
                                                                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                                                                    isChildActive
                                                                        ? "bg-slate-800 text-white"
                                                                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                                                )}
                                                            >
                                                                <ChildIcon size={16} />
                                                                {child.name}
                                                            </Link>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        )}
                                    </li>
                                );
                            }

                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        onClick={() => isMobile && setSidebarOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-slate-800 text-white"
                                                : "text-slate-400 hover:bg-slate-800 hover:text-white",
                                            !sidebarOpen && "justify-center px-2"
                                        )}
                                        title={!sidebarOpen ? item.name : undefined}
                                    >
                                        <Icon size={20} />
                                        <span
                                            className={cn(
                                                "transition-all duration-300",
                                                !sidebarOpen && "w-0 overflow-hidden opacity-0 lg:hidden"
                                            )}
                                        >
                                            {item.name}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Footer (User mini profile or logout shortcut could go here) */}
                <div className="border-t border-slate-800 p-4">
                    {/* Placeholder for footer content */}
                </div>
            </aside>
        </>
    );
}
