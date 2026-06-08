"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, Search, Ticket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface RaffleRow {
    id: string;
    slug: string;
    name: string;
    type: "free" | "paid";
    price: number | null;
    audience: "all" | "customers" | "subscribers";
    totalNumbers: number;
    status: "draft" | "active" | "closed" | "drawn";
    coverImage: string | null;
    drawAt: string | null;
    endsAt: string | null;
    featured: boolean;
    soldCount: number;
}

const STATUS_LABEL: Record<string, string> = {
    draft: "Borrador",
    active: "Activo",
    closed: "Cerrado",
    drawn: "Sorteado",
};

const STATUS_COLOR: Record<string, string> = {
    draft: "bg-slate-200 text-slate-700",
    active: "bg-emerald-100 text-emerald-700",
    closed: "bg-amber-100 text-amber-700",
    drawn: "bg-violet-100 text-violet-700",
};

export default function AdminSorteosPage() {
    const [raffles, setRaffles] = useState<RaffleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("all");

    useEffect(() => {
        const t = setTimeout(() => {
            fetchRaffles();
        }, 200);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, status]);

    async function fetchRaffles() {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (status !== "all") params.set("status", status);
            const res = await fetch(`/api/admin/raffles?${params}`);
            const data = await res.json();
            // La temporada (in_store) se administra en su propio panel.
            setRaffles((data.raffles || []).filter((r: RaffleRow) => (r.type as string) !== "in_store"));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Sorteos</h2>
                    <p className="text-sm text-muted-foreground">
                        Crea y administra rifas gratis o pagadas con grilla de números.
                    </p>
                </div>
                <Button asChild>
                    <Link href="/admin/sorteos/nuevo">
                        <Plus className="mr-2 h-4 w-4" />
                        Nuevo sorteo
                    </Link>
                </Button>
            </div>

            <Card>
                <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nombre o slug…"
                            className="pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="w-full sm:w-48">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            <SelectItem value="draft">Borrador</SelectItem>
                            <SelectItem value="active">Activos</SelectItem>
                            <SelectItem value="closed">Cerrados</SelectItem>
                            <SelectItem value="drawn">Sorteados</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : raffles.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <Ticket className="h-12 w-12 text-muted-foreground mb-3" />
                        <p className="text-sm text-muted-foreground mb-4">
                            No hay sorteos todavía. Crea el primero para empezar a vender números.
                        </p>
                        <Button asChild>
                            <Link href="/admin/sorteos/nuevo">
                                <Plus className="mr-2 h-4 w-4" />
                                Crear sorteo
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {raffles.map((r) => {
                        const pct = r.totalNumbers > 0 ? Math.round((r.soldCount / r.totalNumbers) * 100) : 0;
                        return (
                            <Link
                                key={r.id}
                                href={`/admin/sorteos/${r.id}`}
                                className="group block overflow-hidden rounded-xl border bg-white hover:border-veci-primary hover:shadow-md transition"
                            >
                                <div className="relative aspect-video bg-slate-100">
                                    {r.coverImage ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={r.coverImage} alt={r.name} className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full items-center justify-center">
                                            <Ticket className="h-10 w-10 text-slate-300" />
                                        </div>
                                    )}
                                    <span className={`absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded ${STATUS_COLOR[r.status]}`}>
                                        {STATUS_LABEL[r.status]}
                                    </span>
                                    {r.type === "free" && (
                                        <span className="absolute top-2 right-2 text-xs font-extrabold px-2 py-1 rounded bg-gradient-to-r from-amber-400 to-yellow-500 text-white">
                                            GRATIS
                                        </span>
                                    )}
                                </div>
                                <div className="p-3 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-bold text-sm line-clamp-1">{r.name}</h3>
                                        {r.featured && <Badge variant="outline" className="text-[10px]">Destacado</Badge>}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {r.type === "paid" ? (
                                            <>Precio: <span className="font-semibold text-slate-700">${(r.price ?? 0).toLocaleString("es-CL")}</span></>
                                        ) : (
                                            <>Tipo: <span className="font-semibold text-amber-600">Gratis</span></>
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="text-muted-foreground">
                                                {r.soldCount}/{r.totalNumbers} números
                                            </span>
                                            <span className="font-semibold">{pct}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-veci-primary transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
