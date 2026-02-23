import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
    title: string;
    value: string | number;
    change?: number; // percentage
    icon: LucideIcon;
    trend?: "up" | "down" | "neutral";
}

export function StatsCard({ title, value, change, icon: Icon, trend }: StatsCardProps) {
    const isPositive = change !== undefined && change > 0;
    const isNegative = change !== undefined && change < 0;

    let TrendIcon = null;
    if (trend === "up" || isPositive) TrendIcon = TrendingUp;
    if (trend === "down" || isNegative) TrendIcon = TrendingDown;

    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <p className="text-3xl font-bold tracking-tight">{value}</p>
                    </div>
                    <div className="p-3 bg-slate-100 rounded-full">
                        <Icon className="w-5 h-5 text-slate-600" />
                    </div>
                </div>

                {change !== undefined && (
                    <div className="mt-4 flex items-center text-sm">
                        <span className={`flex items-center font-medium ${isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-slate-600'}`}>
                            {TrendIcon && <TrendIcon className="w-4 h-4 mr-1" />}
                            {isPositive ? '+' : ''}{change}%
                        </span>
                        <span className="text-muted-foreground ml-2">vs último mes</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
