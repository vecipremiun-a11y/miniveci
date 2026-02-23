import { Badge } from "@/components/ui/badge";

type BadgeType = "order" | "product" | "sync";

interface StatusBadgeProps {
    status: string;
    type: BadgeType;
    className?: string;
}

export function StatusBadge({ status, type, className = "" }: StatusBadgeProps) {
    const getOrderColor = (s: string) => {
        switch (s.toLowerCase()) {
            case "new": return "bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200";
            case "paid": return "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200";
            case "preparing": return "bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200";
            case "ready": return "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200";
            case "shipped": return "bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200";
            case "delivered": return "bg-green-100 text-green-700 hover:bg-green-200 border-green-200";
            case "cancelled": return "bg-red-100 text-red-700 hover:bg-red-200 border-red-200";
            case "refunded": return "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200";
            default: return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    const getProductColor = (s: string) => {
        switch (s.toLowerCase()) {
            case "published":
            case "true":
            case "activo":
                return "bg-green-100 text-green-700 hover:bg-green-200 border-green-200";
            case "draft":
            case "false":
            case "inactivo":
                return "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200";
            default: return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    const getSyncColor = (s: string) => {
        switch (s.toLowerCase()) {
            case "success": return "bg-green-100 text-green-700 hover:bg-green-200 border-green-200";
            case "error": return "bg-red-100 text-red-700 hover:bg-red-200 border-red-200";
            case "partial": return "bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200";
            default: return "bg-gray-100 text-gray-700 border-gray-200";
        }
    };

    const formatLabel = (s: string) => {
        if (s === "true" || s === true as unknown as string) return "Activo";
        if (s === "false" || s === false as unknown as string) return "Inactivo";
        return s;
    };

    let colorClass = "bg-gray-100 text-gray-700 border-gray-200";
    if (type === "order") colorClass = getOrderColor(status);
    if (type === "product") colorClass = getProductColor(status);
    if (type === "sync") colorClass = getSyncColor(status);

    return (
        <Badge variant="outline" className={`capitalize font-medium ${colorClass} ${className}`}>
            {formatLabel(status)}
        </Badge>
    );
}
