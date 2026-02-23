import { Skeleton } from "@/components/ui/skeleton";

interface LoadingSkeletonProps {
    variant?: "table" | "card" | "form" | "dashboard";
    rows?: number;
    className?: string;
}

export function LoadingSkeleton({ variant = "table", rows = 5, className = "" }: LoadingSkeletonProps) {
    if (variant === "table") {
        return (
            <div className={`space-y-4 ${className}`}>
                <div className="flex justify-between items-center mb-4">
                    <Skeleton className="h-10 w-[200px]" />
                    <Skeleton className="h-10 w-[100px]" />
                </div>
                <div className="border rounded-md p-4 space-y-4">
                    <Skeleton className="h-8 w-full" />
                    {Array.from({ length: rows }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                            <Skeleton className="h-8 w-1/4" />
                            <Skeleton className="h-8 w-1/4" />
                            <Skeleton className="h-8 w-1/2" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (variant === "card") {
        return (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
                {Array.from({ length: Object.is(rows, 5) ? 4 : rows }).map((_, i) => (
                    <div key={i} className="p-6 border rounded-xl space-y-3">
                        <Skeleton className="h-5 w-[120px]" />
                        <Skeleton className="h-10 w-[80px]" />
                    </div>
                ))}
            </div>
        );
    }

    if (variant === "form") {
        return (
            <div className={`space-y-6 max-w-2xl ${className}`}>
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-[100px]" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ))}
                <Skeleton className="h-10 w-[150px]" />
            </div>
        );
    }

    if (variant === "dashboard") {
        return (
            <div className={`space-y-6 ${className}`}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-[120px] rounded-xl" />
                    <Skeleton className="h-[120px] rounded-xl" />
                    <Skeleton className="h-[120px] rounded-xl" />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-[400px] lg:col-span-2 rounded-xl" />
                    <Skeleton className="h-[400px] rounded-xl" />
                </div>
            </div>
        );
    }

    return null;
}
