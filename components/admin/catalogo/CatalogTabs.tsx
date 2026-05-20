"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Cookie } from "lucide-react";

export type CatalogTab = "tienda" | "amasanderia";

export function CatalogTabs({ current }: { current: CatalogTab }) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const handleChange = (value: string) => {
        const next = value === "amasanderia" ? "amasanderia" : "tienda";
        const params = new URLSearchParams(searchParams.toString());
        if (next === "tienda") params.delete("tab");
        else params.set("tab", next);
        // Reset page when switching tabs
        params.delete("page");
        const qs = params.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    };

    return (
        <Tabs value={current} onValueChange={handleChange}>
            <TabsList className="bg-slate-100 h-11">
                <TabsTrigger value="tienda" className="gap-2 px-4">
                    <Package className="h-4 w-4" />
                    Tienda
                </TabsTrigger>
                <TabsTrigger value="amasanderia" className="gap-2 px-4">
                    <Cookie className="h-4 w-4" />
                    Amasandería
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
