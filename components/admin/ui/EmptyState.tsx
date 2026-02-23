import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = "" }: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center py-12 px-4 text-center border-2 border-dashed rounded-lg bg-slate-50 ${className}`}>
            <div className="bg-slate-100 p-3 rounded-full mb-4">
                <Icon className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">{title}</h3>
            {description && (
                <p className="text-sm text-slate-500 max-w-sm mb-6">
                    {description}
                </p>
            )}
            {action && (
                <Button onClick={action.onClick} variant="outline" className="bg-white">
                    {action.label}
                </Button>
            )}
        </div>
    );
}
