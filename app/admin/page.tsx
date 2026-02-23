import { StatsCards } from "@/components/admin/dashboard/StatsCards";
import { SalesChart } from "@/components/admin/dashboard/SalesChart";
import { RecentOrders } from "@/components/admin/dashboard/RecentOrders";
import { TopProducts } from "@/components/admin/dashboard/TopProducts";
import { SystemAlerts } from "@/components/admin/dashboard/SystemAlerts";

export default function AdminDashboard() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <p className="text-muted-foreground">
                    Resumen de actividad de MiniVeci.
                </p>
            </div>

            {/* Top Stats */}
            <StatsCards />

            {/* Main Content Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                {/* Chart Section */}
                <div className="col-span-4 lg:col-span-4">
                    <SalesChart />
                </div>

                {/* System Alerts - Right side on large screens */}
                <div className="col-span-4 lg:col-span-3">
                    <SystemAlerts />
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                {/* Recent Orders */}
                <RecentOrders />

                {/* Top Products */}
                <TopProducts />
            </div>
        </div>
    );
}
