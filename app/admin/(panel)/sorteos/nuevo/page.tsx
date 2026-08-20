"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { RaffleForm } from "@/components/admin/sorteos/RaffleForm";

export default function NuevoSorteoPage() {
    return (
        <div className="space-y-4 max-w-4xl mx-auto">
            <Link href="/admin/sorteos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Volver a sorteos
            </Link>
            <h2 className="text-2xl sm:text-3xl font-bold">Nuevo sorteo</h2>
            <RaffleForm mode="create" />
        </div>
    );
}
