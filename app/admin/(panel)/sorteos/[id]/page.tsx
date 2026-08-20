"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Trash2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RaffleForm, RaffleFormInitial } from "@/components/admin/sorteos/RaffleForm";
import { RaffleImages } from "@/components/admin/sorteos/RaffleImages";
import { RaffleNumbers } from "@/components/admin/sorteos/RaffleNumbers";
import { Card, CardContent } from "@/components/ui/card";

interface Raffle extends RaffleFormInitial {
    id: string;
    images: Array<{ id: string; url: string; isPrimary: boolean; position: number }>;
    prizes: Array<{ id: string; position: number; name: string; description: string | null }>;
    soldCount: number;
}

export default function EditarSorteoPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const [raffle, setRaffle] = useState<Raffle | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/admin/raffles/${params.id}`)
            .then((r) => r.json())
            .then((data) => {
                setRaffle(data);
                setLoading(false);
            });
    }, [params.id]);

    async function handleDelete() {
        if (!confirm("¿Eliminar este sorteo? Se borrarán también imágenes, premios y entries.")) return;
        const res = await fetch(`/api/admin/raffles/${params.id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) return toast.error(data.error || "Error al eliminar");
        toast.success("Sorteo eliminado");
        router.push("/admin/sorteos");
    }

    if (loading || !raffle) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-4 max-w-6xl mx-auto">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <Link href="/admin/sorteos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="h-4 w-4" />
                        Volver a sorteos
                    </Link>
                    <h2 className="text-2xl sm:text-3xl font-bold mt-2">{raffle.name}</h2>
                    <p className="text-sm text-muted-foreground">
                        /{raffle.slug} · {raffle.totalNumbers} números · {raffle.status === "drawn" ? "Sorteado" : raffle.status}
                    </p>
                </div>
                <div className="flex gap-2">
                    {raffle.status === "active" && (
                        <Button asChild variant="outline">
                            <Link href={`/sorteos/${raffle.slug}`} target="_blank">Ver página</Link>
                        </Button>
                    )}
                    <Button variant="outline" onClick={handleDelete} disabled={raffle.status === "drawn"}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="datos">
                <TabsList>
                    <TabsTrigger value="datos">Datos</TabsTrigger>
                    <TabsTrigger value="imagenes">Imágenes</TabsTrigger>
                    <TabsTrigger value="numeros">Números & Sorteo</TabsTrigger>
                </TabsList>

                <TabsContent value="datos" className="mt-4">
                    <RaffleForm
                        mode="edit"
                        initial={{ ...raffle, hasEntries: raffle.soldCount > 0 }}
                    />
                </TabsContent>

                <TabsContent value="imagenes" className="mt-4">
                    <RaffleImages raffleId={raffle.id} images={raffle.images} />
                </TabsContent>

                <TabsContent value="numeros" className="mt-4">
                    <RaffleNumbers raffleId={raffle.id} status={raffle.status} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
