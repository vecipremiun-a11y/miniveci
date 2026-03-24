import { AccountSidebar } from '@/components/account/AccountSidebar';

export default function AccountLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-veci-blue-900/5 relative overflow-hidden">
            {/* Background Blobs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-20 -left-20 w-[600px] h-[600px] bg-veci-primary/10 rounded-full blur-[120px]" />
                <div className="absolute top-40 right-0 w-[500px] h-[500px] bg-veci-secondary/10 rounded-full blur-[100px]" />
                <div className="absolute -bottom-20 left-1/3 w-[800px] h-[800px] bg-indigo-200/20 rounded-full blur-[150px]" />
            </div>

            <div className="relative z-10 pt-28 pb-12 px-4 md:px-8 max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-slate-800 mb-2">Mi Cuenta</h1>
                <div className="flex items-center gap-2 text-sm text-slate-500 mb-8">
                    <span>Inicio</span>
                    <span>›</span>
                    <span className="text-slate-800 font-medium">Mi cuenta</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-3">
                        <AccountSidebar />
                    </div>
                    <div className="lg:col-span-9">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
