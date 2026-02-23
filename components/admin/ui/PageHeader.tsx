import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface PageHeaderProps {
    title: string;
    description?: string;
    breadcrumbs?: BreadcrumbItem[];
    actions?: ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <nav className="flex items-center text-sm text-slate-500 mb-2" aria-label="Breadcrumb">
                        <ol className="flex items-center space-x-2">
                            <li>
                                <Link href="/admin" className="hover:text-slate-900 transition-colors" title="Inicio" aria-label="Inicio">
                                    <Home className="w-4 h-4" />
                                </Link>
                            </li>
                            {breadcrumbs.map((crumb, index) => (
                                <li key={index} className="flex items-center space-x-2">
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                    {crumb.href ? (
                                        <Link href={crumb.href} className="hover:text-slate-900 transition-colors">
                                            {crumb.label}
                                        </Link>
                                    ) : (
                                        <span className="text-slate-900 font-medium" aria-current="page">
                                            {crumb.label}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </nav>
                )}
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
                {description && <p className="text-slate-500 mt-1">{description}</p>}
            </div>

            {actions && (
                <div className="flex items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}
