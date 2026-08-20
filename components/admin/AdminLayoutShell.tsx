"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { AdminProvider, useAdmin } from "@/components/admin/AdminProvider";
import Sidebar from "@/components/admin/Sidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { cn } from "@/lib/utils";

/**
 * Chrome del panel admin (sidebar, header, providers).
 *
 * Vive aparte de `app/admin/layout.tsx` porque ese layout pasó a ser un server
 * component para poder verificar sesión y rol en el servidor.
 */
function AdminLayoutContent({ children }: { children: React.ReactNode }) {
    const { sidebarOpen } = useAdmin();

    return (
        <div className="flex h-screen overflow-hidden bg-gray-50">
            <Sidebar />
            <div
                className={cn(
                    "flex flex-1 flex-col transition-all duration-300",
                    sidebarOpen ? "lg:ml-64" : "lg:ml-20"
                )}
            >
                <AdminHeader />
                <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}

export default function AdminLayoutShell({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <AdminProvider>
                <AdminLayoutContent>{children}</AdminLayoutContent>
                <Toaster position="top-right" richColors closeButton />
            </AdminProvider>
        </SessionProvider>
    );
}
