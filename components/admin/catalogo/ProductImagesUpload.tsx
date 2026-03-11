"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, UploadCloud, Link as LinkIcon, ImagePlus, Star } from "lucide-react";
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
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const uploadFile = async (file: File) => {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/admin/products/${productId}/images/upload`, {
            method: "POST",
            body: formData,
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Error al subir imagen" }));
            throw new Error(err.error || "Error al subir imagen");
        }

        return res.json();
    };

    const handleFileUpload = async (files: FileList | File[]) => {
        const fileArray = Array.from(files).slice(0, 10);
        if (fileArray.length === 0) return;

        setIsLoading(true);
        let successCount = 0;

        for (const file of fileArray) {
            try {
                const addedImage = await uploadFile(file);
                setImages((prev) => [...prev, addedImage]);
                successCount++;
            } catch (error: any) {
                toast.error(`${file.name}: ${error.message}`);
            }
        }

        if (successCount > 0) {
            toast.success(`${successCount} imagen${successCount > 1 ? "es subidas" : " subida"}`);
            router.refresh();
        }
        setIsLoading(false);
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
        setIsLoading(true);
        try {
            const res = await fetch(`/api/admin/products/${productId}/images`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageId }),
            });

            if (!res.ok) throw new Error("Error al cambiar imagen principal");

            setImages((prev) =>
                prev.map((img) => ({ ...img, isPrimary: img.id === imageId }))
            );
            toast.success("Imagen principal actualizada");
            router.refresh();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) {
            handleFileUpload(e.dataTransfer.files);
        }
    }, []);

    return (
        <div className="space-y-4">
            {/* URL input */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <LinkIcon className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="https://ejemplo.com/imagen.jpg"
                        className="pl-9"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddUrl(); } }}
                        disabled={isLoading}
                    />
                </div>
                <Button type="button" onClick={handleAddUrl} disabled={isLoading || !newUrl}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-2" />}
                    Añadir URL
                </Button>
            </div>

            {/* File upload drop zone */}
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
                    isDragging
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
                }`}
            >
                <ImagePlus className={`h-8 w-8 mb-2 ${isDragging ? "text-blue-500" : "text-gray-400"}`} />
                <p className="text-sm font-medium text-gray-600">
                    {isLoading ? "Subiendo..." : "Arrastra imágenes aquí o haz clic para seleccionar"}
                </p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP — Máx 5MB por archivo</p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files) handleFileUpload(e.target.files);
                        e.target.value = "";
                    }}
                />
            </div>

            {/* Image grid */}
            {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                    {images.map((img) => (
                        <div key={img.id || img.url} className={`relative border-2 rounded-lg overflow-hidden aspect-square bg-gray-50 flex items-center justify-center ${img.isPrimary ? 'border-yellow-400' : 'border-gray-200'}`}>
                            <img src={img.url} alt={img.altText || "Product image"} className="max-w-full max-h-full object-contain" />
                            {img.isPrimary && (
                                <div className="absolute top-2 left-2 bg-yellow-500 text-white text-[10px] px-2 py-1 rounded font-bold uppercase shadow">
                                    Principal
                                </div>
                            )}
                            {/* Action buttons - always visible */}
                            {img.id && (
                                <div className="absolute bottom-2 right-2 flex gap-1.5">
                                    {!img.isPrimary && (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleSetPrimary(img.id as string); }}
                                            disabled={isLoading}
                                            className="p-1.5 rounded-md bg-white shadow-md border border-gray-200 hover:bg-yellow-50 hover:border-yellow-300 transition-colors"
                                            title="Marcar como principal"
                                        >
                                            <Star className="h-4 w-4 text-yellow-500" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); handleDelete(img.id as string); }}
                                        disabled={isLoading}
                                        className="p-1.5 rounded-md bg-white shadow-md border border-gray-200 hover:bg-red-50 hover:border-red-300 transition-colors"
                                        title="Eliminar imagen"
                                    >
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
