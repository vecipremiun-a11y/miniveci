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
    X
} from "lucide-react";

interface SidebarProps {
    className?: string;
}

const menuItems = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Catálogo", href: "/admin/catalogo", icon: Package },
    { name: "Pedidos", href: "/admin/pedidos", icon: ShoppingCart },
    { name: "Clientes", href: "/admin/clientes", icon: Users },
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
                            const isActive = pathname === item.href;
                            const Icon = item.icon;

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
