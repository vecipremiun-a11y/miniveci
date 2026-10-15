import { StatsCards } from "@/components/admin/dashboard/StatsCards";
import { SalesChart } from "@/components/admin/dashboard/SalesChart";
import { RecentOrders } from "@/components/admin/dashboard/RecentOrders";
import { TopProducts } from "@/components/admin/dashboard/TopProducts";
import { SystemAlerts } from "@/components/admin/dashboard/SystemAlerts";
import { getDashboardData } from "@/lib/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
    const data = await getDashboardData();

    return (
        <div className="space-y-4 sm:space-y-6">
            <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                    Resumen de actividad de MiniVeci.
                </p>
            </div>

            {/* Top Stats */}
            <StatsCards stats={data.stats} />

            {/* Main Content Grid */}
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-7">
                {/* Chart Section */}
                <div className="lg:col-span-4 min-w-0">
                    <SalesChart sales={data.sales} />
                </div>

                {/* System Alerts - Right side on large screens */}
                <div className="lg:col-span-3 min-w-0">
                    <SystemAlerts alerts={data.alerts} />
                </div>
            </div>

            <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
                {/* Recent Orders */}
                <RecentOrders orders={data.recentOrders} />

                {/* Top Products */}
                <TopProducts products={data.topProducts} />
            </div>
        </div>
    );
}
