"use client";

import { useEffect, useState } from "react";
import { Loader2, Trophy, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NumberEntry {
    number: number;
    status: "available" | "reserved" | "paid" | "free";
    entry: any | null;
}

const STATUS_COLOR: Record<string, string> = {
    available: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
    reserved: "bg-amber-50 text-amber-700 border-amber-200",
    paid: "bg-slate-200 text-slate-700 border-slate-300",
    free: "bg-slate-200 text-slate-700 border-slate-300",
};

const STATUS_LABEL: Record<string, string> = {
    available: "Libre",
    reserved: "Reservado",
    paid: "Vendido",
    free: "Tomado",
};

export function RaffleNumbers({ raffleId, status }: { raffleId: string; status: string }) {
    const [data, setData] = useState<{ numbers: NumberEntry[]; sold: number; reserved: number; available: number; totalNumbers: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<NumberEntry | null>(null);
    const [drawing, setDrawing] = useState(false);

    async function load() {
        const res = await fetch(`/api/admin/raffles/${raffleId}/numbers`);
        const json = await res.json();
        if (res.ok) setData(json);
        setLoading(false);
    }

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [raffleId]);

    async function executeDraw() {
        if (!confirm("¿Realizar el sorteo ahora? Esta acción no se puede deshacer.")) return;
        setDrawing(true);
        try {
            const res = await fetch(`/api/admin/raffles/${raffleId}/draw`, { method: "POST" });
            const json = await res.json();
            if (!res.ok) {
                toast.error(json.error || "Error al realizar el sorteo");
                return;
            }
            toast.success(`Sorteo realizado: ${json.winners.length} ganador(es)`);
            window.location.reload();
        } finally {
            setDrawing(false);
        }
    }

    if (loading || !data) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
                <Card>
                    <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Vendidos</p>
                        <p className="text-xl font-bold text-veci-primary">{data.sold}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Reservados</p>
                        <p className="text-xl font-bold text-amber-600">{data.reserved}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Disponibles</p>
                        <p className="text-xl font-bold text-emerald-600">{data.available}</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base">Grilla de números</CardTitle>
                    {status !== "drawn" && (
                        <Button onClick={executeDraw} disabled={drawing} variant="default">
                            {drawing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
                            Sortear ganadores
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1.5">
                        {data.numbers.map((n) => (
                            <button
                                key={n.number}
                                onClick={() => setSelected(n)}
                                className={`aspect-square rounded text-xs font-bold border transition ${STATUS_COLOR[n.status]}`}
                                title={STATUS_LABEL[n.status]}
                            >
                                {n.number}
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {selected && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center justify-between">
                            Número {selected.number}
                            <button
                                className="text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setSelected(null)}
                            >
                                Cerrar
                            </button>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm space-y-1">
                        <p>
                            <strong>Estado:</strong> {STATUS_LABEL[selected.status]}
                        </p>
                        {selected.entry ? (
                            <>
                                <p><strong>Cliente:</strong> {selected.entry.customerName ?? "Invitado"}</p>
                                <p><strong>Email:</strong> {selected.entry.customerEmail ?? "—"}</p>
                                <p><strong>Teléfono:</strong> {selected.entry.customerPhone ?? "—"}</p>
                                {selected.entry.paidAt && (
                                    <p><strong>Pagado:</strong> {new Date(selected.entry.paidAt).toLocaleString("es-CL")}</p>
                                )}
                                {selected.entry.expiresAt && selected.entry.status === "reserved" && (
                                    <p className="flex items-center gap-1 text-amber-700">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        Reserva expira: {new Date(selected.entry.expiresAt).toLocaleString("es-CL")}
                                    </p>
                                )}
                            </>
                        ) : (
                            <p className="text-muted-foreground">Sin participante asignado.</p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
