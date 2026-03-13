"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  GripVertical,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Banner {
  id: string;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number | null;
  isActive: boolean | null;
  createdAt: string | null;
}

export default function ContenidoPage() {
  const [bannerList, setBannerList] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const fetchBanners = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/banners");
      if (res.ok) {
        const data = await res.json();
        setBannerList(data);
      }
    } catch {
      toast.error("Error al cargar banners");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
  }, [fetchBanners]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecciona una imagen");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title) formData.append("title", title);
      if (linkUrl) formData.append("linkUrl", linkUrl);

      const res = await fetch("/api/admin/banners", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Error al subir banner");
        return;
      }

      toast.success("Banner agregado");
      setFile(null);
      setPreview(null);
      setTitle("");
      setLinkUrl("");
      // Reset file input
      const fileInput = document.getElementById("banner-file") as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      fetchBanners();
    } catch {
      toast.error("Error al subir banner");
    } finally {
      setUploading(false);
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      const res = await fetch(`/api/admin/banners/${banner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !banner.isActive }),
      });
      if (res.ok) {
        setBannerList((prev) =>
          prev.map((b) =>
            b.id === banner.id ? { ...b, isActive: !b.isActive } : b
          )
        );
        toast.success(banner.isActive ? "Banner desactivado" : "Banner activado");
      }
    } catch {
      toast.error("Error al actualizar");
    }
  };

  const handleDelete = async (banner: Banner) => {
    if (!confirm("¿Eliminar este banner permanentemente?")) return;

    try {
      const res = await fetch(`/api/admin/banners/${banner.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBannerList((prev) => prev.filter((b) => b.id !== banner.id));
        toast.success("Banner eliminado");
      }
    } catch {
      toast.error("Error al eliminar");
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const updated = [...bannerList];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];

    // Update sort orders
    const promises = updated.map((b, i) =>
      fetch(`/api/admin/banners/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: i }),
      })
    );

    setBannerList(updated);
    await Promise.all(promises);
  };

  const handleMoveDown = async (index: number) => {
    if (index === bannerList.length - 1) return;
    const updated = [...bannerList];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];

    const promises = updated.map((b, i) =>
      fetch(`/api/admin/banners/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: i }),
      })
    );

    setBannerList(updated);
    await Promise.all(promises);
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold tracking-tight">Contenido</h2>
        <p className="text-muted-foreground">
          Gestiona los banners del carrusel de la página principal.
        </p>
      </div>

      {/* Upload Form */}
      <div className="rounded-xl border bg-white p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Plus className="h-5 w-5" />
          Agregar nuevo banner
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="banner-file">Imagen del banner</Label>
            <Input
              id="banner-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={handleFileChange}
            />
            <p className="text-xs text-muted-foreground">
              JPG, PNG, WebP o AVIF. Máximo 5MB. Recomendado: 1920×600px.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="banner-title">Título (opcional)</Label>
              <Input
                id="banner-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Ofertas de verano"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="banner-link">Enlace (opcional)</Label>
              <Input
                id="banner-link"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="Ej: /productos?categoria=ofertas"
              />
            </div>
          </div>
        </div>

        {preview && (
          <div className="relative w-full aspect-[2.5/1] rounded-lg overflow-hidden border bg-gray-50">
            <Image
              src={preview}
              alt="Preview"
              fill
              className="object-cover"
            />
          </div>
        )}

        <Button onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Subiendo...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Subir banner
            </>
          )}
        </Button>
      </div>

      {/* Banner List */}
      <div className="rounded-xl border bg-white p-6 space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Banners actuales ({bannerList.length})
        </h3>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : bannerList.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ImageIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No hay banners. Sube el primero arriba.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bannerList.map((banner, index) => (
              <div
                key={banner.id}
                className="flex items-center gap-4 rounded-lg border p-3 bg-gray-50"
              >
                {/* Reorder Controls */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
                    title="Subir"
                  >
                    <GripVertical className="h-4 w-4 rotate-90 scale-x-[-1]" />
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === bannerList.length - 1}
                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"
                    title="Bajar"
                  >
                    <GripVertical className="h-4 w-4 rotate-90" />
                  </button>
                </div>

                {/* Thumbnail */}
                <div className="relative w-40 aspect-[2.5/1] rounded overflow-hidden bg-gray-200 shrink-0">
                  <Image
                    src={banner.imageUrl}
                    alt={banner.title || "Banner"}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {banner.title || "Sin título"}
                  </p>
                  {banner.linkUrl && (
                    <p className="text-xs text-muted-foreground truncate">
                      {banner.linkUrl}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Posición: {index + 1}
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${banner.id}`} className="text-xs">
                      {banner.isActive ? "Activo" : "Inactivo"}
                    </Label>
                    <Switch
                      id={`active-${banner.id}`}
                      checked={banner.isActive ?? false}
                      onCheckedChange={() => handleToggleActive(banner)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(banner)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
