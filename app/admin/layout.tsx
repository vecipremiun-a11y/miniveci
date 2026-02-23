"use client";

import { AdminProvider } from "@/components/admin/AdminProvider";
import Sidebar from "@/components/admin/Sidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { useAdmin } from "@/components/admin/AdminProvider";
import { cn } from "@/lib/utils";

// Separate component to use the context
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
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}

import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SessionProvider>
            <AdminProvider>
                <AdminLayoutContent>{children}</AdminLayoutContent>
                <Toaster position="top-right" richColors closeButton />
            </AdminProvider>
        </SessionProvider>
    );
}
