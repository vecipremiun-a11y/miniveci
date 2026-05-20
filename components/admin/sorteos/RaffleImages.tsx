"use client";

import { useRef, useState } from "react";
import { Upload, Star, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RaffleImage {
    id: string;
    url: string;
    isPrimary: boolean;
    position: number;
}

export function RaffleImages({ raffleId, images: initial }: { raffleId: string; images: RaffleImage[] }) {
    const [images, setImages] = useState<RaffleImage[]>(initial);
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        setUploading(true);
        try {
            for (const file of files) {
                const fd = new FormData();
                fd.append("file", file);
                const res = await fetch(`/api/admin/raffles/${raffleId}/images/upload`, {
                    method: "POST",
                    body: fd,
                });
                const data = await res.json();
                if (!res.ok) {
                    toast.error(data.error || `Error subiendo ${file.name}`);
                    continue;
                }
                setImages((prev) => [...prev, data]);
            }
            toast.success("Imágenes subidas");
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    async function setPrimary(imageId: string) {
        const res = await fetch(`/api/admin/raffles/${raffleId}/images/${imageId}`, { method: "PUT" });
        if (!res.ok) return toast.error("Error al actualizar");
        setImages((prev) => prev.map((i) => ({ ...i, isPrimary: i.id === imageId })));
        toast.success("Imagen principal actualizada");
    }

    async function deleteImage(imageId: string) {
        if (!confirm("¿Eliminar esta imagen?")) return;
        const res = await fetch(`/api/admin/raffles/${raffleId}/images/${imageId}`, { method: "DELETE" });
        if (!res.ok) return toast.error("Error al eliminar");
        setImages((prev) => prev.filter((i) => i.id !== imageId));
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Imágenes</CardTitle>
                <Button onClick={() => inputRef.current?.click()} disabled={uploading} size="sm">
                    {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
                    Subir
                </Button>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    multiple
                    className="hidden"
                    onChange={handleUpload}
                />
            </CardHeader>
            <CardContent>
                {images.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                        Sube una imagen principal y otras adicionales.
                    </p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {images.map((img) => (
                            <div key={img.id} className="relative aspect-square rounded-lg overflow-hidden border bg-slate-50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img.url} alt="" className="h-full w-full object-cover" />
                                {img.isPrimary && (
                                    <span className="absolute top-1.5 left-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400 text-amber-900">
                                        Principal
                                    </span>
                                )}
                                <div className="absolute inset-x-0 bottom-0 p-1.5 flex justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition">
                                    {!img.isPrimary && (
                                        <button
                                            onClick={() => setPrimary(img.id)}
                                            className="p-1.5 bg-white/90 rounded hover:bg-white"
                                            title="Marcar como principal"
                                        >
                                            <Star className="h-3.5 w-3.5 text-amber-500" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => deleteImage(img.id)}
                                        className="p-1.5 bg-white/90 rounded hover:bg-white"
                                        title="Eliminar"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
