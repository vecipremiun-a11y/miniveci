"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash, UploadCloud, Link as LinkIcon } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ImageProps {
    id?: string;
    url: string;
    altText?: string | null;
    isPrimary?: boolean | null;
}

interface ProductImagesUploadProps {
    productId: string;
    initialImages?: ImageProps[];
}

export function ProductImagesUpload({ productId, initialImages = [] }: ProductImagesUploadProps) {
    const router = useRouter();
    const [images, setImages] = useState<ImageProps[]>(initialImages);
    const [isLoading, setIsLoading] = useState(false);
    const [newUrl, setNewUrl] = useState("");

    const handleAddUrl = async () => {
        if (!newUrl) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/admin/products/${productId}/images`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: newUrl, isPrimary: images.length === 0 }),
            });

            if (!res.ok) throw new Error("Error al agregar imagen");

            const addedImage = await res.json();
            setImages([...images, addedImage]);
            setNewUrl("");
            toast.success("Imagen agregada");
            router.refresh();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (imageId: string) => {
        if (!confirm("¿Eliminar esta imagen?")) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/admin/products/${productId}/images?imageId=${imageId}`, {
                method: "DELETE",
            });

            if (!res.ok) throw new Error("Error al eliminar imagen");

            setImages(images.filter(img => img.id !== imageId));
            toast.success("Imagen eliminada");
            router.refresh();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetPrimary = async (imageId: string) => {
        // Find the image, and try to POST it again forcing it to be primary
        // A more correct way would be a PUT endpoint, but since the POST does the un-set mechanism 
        // we can theoretically use it if the schema allows overriding.
        // For brevity in Phase 5 we can map the "Star" button to it.
        toast.info("Función de marcado principal en desarrollo");
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="https://ejemplo.com/imagen.jpg"
                        className="pl-9"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        disabled={isLoading}
                    />
                </div>
                <Button type="button" onClick={handleAddUrl} disabled={isLoading || !newUrl}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                    Añadir URL
                </Button>
            </div>

            {images.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                    {images.map((img) => (
                        <div key={img.id} className="relative group border rounded-lg overflow-hidden aspect-square bg-gray-50 flex items-center justify-center">
                            <img src={img.url} alt={img.altText || "Product image"} className="max-w-full max-h-full object-contain" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                {img.id && (
                                    <Button size="icon" variant="destructive" type="button" onClick={() => handleDelete(img.id as string)}>
                                        <Trash className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                            {img.isPrimary && (
                                <div className="absolute top-2 left-2 bg-yellow-500 text-white text-[10px] px-2 py-1 rounded font-bold uppercase">
                                    Principal
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-muted-foreground bg-gray-50">
                    <UploadCloud className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-sm">No hay imágenes. Añade una URL arriba.</p>
                </div>
            )}
        </div>
    );
}
