"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { productSchema, ProductFormValues } from "@/lib/validations/product";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X, UploadCloud, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductImagesUpload } from "./ProductImagesUpload";

interface ProductFormProps {
    initialData?: Partial<ProductFormValues> & { id: string };
    categories: { id: string; name: string }[];
}

export function ProductForm({ initialData, categories }: ProductFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [newTag, setNewTag] = useState("");

    const form = useForm<ProductFormValues>({
        resolver: zodResolver(productSchema) as any,
        defaultValues: {
            name: initialData?.name || "",
            sku: initialData?.sku || "",
            slug: initialData?.slug || "",
            description: initialData?.description || "",
            categoryId: initialData?.categoryId || "",
            webPrice: initialData?.webPrice || 0,
            webStock: initialData?.webStock || 0,
            webTitle: initialData?.webTitle || "",
            webDescription: initialData?.webDescription || "",
            seoTitle: initialData?.seoTitle || "",
            seoDescription: initialData?.seoDescription || "",
            offerPrice: initialData?.offerPrice ?? null,
            isOffer: initialData?.isOffer ?? false,
            unit: initialData?.unit || "Und",
            equivLabel: initialData?.equivLabel ?? null,
            equivWeight: initialData?.equivWeight ?? null,
            taxRate: initialData?.taxRate ?? null,
            priceSource: initialData?.priceSource || "global",
            stockSource: initialData?.stockSource || "global",
            reservedQty: initialData?.reservedQty || 0,
            isPublished: initialData?.isPublished ?? true,
            isFeatured: initialData?.isFeatured ?? false,
            tags: initialData?.tags || [],
            badges: initialData?.badges || [],
            images: initialData?.images || [],
        },
    });

    const onSubmit = async (data: ProductFormValues) => {
        setIsLoading(true);
        try {
            const url = initialData
                ? `/api/admin/products/${initialData.id}`
                : `/api/admin/products`;
            const method = initialData ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Algo salió mal");
            }

            toast.success(initialData ? "Producto actualizado" : "Producto creado");
            router.push("/admin/catalogo");
            router.refresh();
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSlugGeneraton = () => {
        const name = form.getValues("name");
        if (name) {
            const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
            form.setValue("slug", slug);
        }
    };

    const addTag = () => {
        if (newTag) {
            const currentTags = form.getValues("tags") || [];
            if (!currentTags.includes(newTag)) {
                form.setValue("tags", [...currentTags, newTag]);
            }
            setNewTag("");
        }
    }

    const removeTag = (tag: string) => {
        const currentTags = form.getValues("tags") || [];
        form.setValue("tags", currentTags.filter(t => t !== tag));
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="flex gap-6 flex-col lg:flex-row">

                    {/* Left Column (Main Content) */}
                    <div className="flex-1 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Información Básica</CardTitle>
                                <CardDescription>Detalles principales del producto</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nombre del Producto</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Ej: Coca Cola 3L"
                                                    {...field}
                                                    onBlur={() => { field.onBlur(); if (!form.getValues("slug")) handleSlugGeneraton(); }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="slug"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Slug</FormLabel>
                                                <FormControl>
                                                    <div className="flex">
                                                        <Input {...field} placeholder="url-amigable" />
                                                        <Button type="button" variant="outline" size="icon" onClick={handleSlugGeneraton} className="ml-2" title="Generar Slug">
                                                            <RefreshCwIcon className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="sku"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>SKU</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="COD-12345" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Descripción</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Descripción detallada del producto..." className="min-h-[120px]" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Tags Input */}
                                <FormItem>
                                    <FormLabel>Tags</FormLabel>
                                    <div className="flex gap-2 mb-2 flex-wrap">
                                        {form.watch("tags")?.map((tag) => (
                                            <Badge key={tag} variant="secondary">
                                                {tag}
                                                <X className="w-3 h-3 ml-1 cursor-pointer" onClick={() => removeTag(tag)} />
                                            </Badge>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Agregar tag..."
                                            value={newTag}
                                            onChange={(e) => setNewTag(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addTag();
                                                }
                                            }}
                                        />
                                        <Button type="button" variant="secondary" onClick={addTag}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </FormItem>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Imágenes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {initialData?.id ? (
                                    <ProductImagesUpload productId={initialData.id} initialImages={initialData.images} />
                                ) : (
                                    <div className="border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center text-muted-foreground bg-gray-50">
                                        <p className="text-sm">Guarda el producto primero para habilitar la subida de imágenes.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>SEO</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="seoTitle"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Meta Título</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Título para buscadores" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="seoDescription"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Meta Descripción</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Descripción para buscadores" className="h-20" {...field} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Right Column (Sidebar) */}
                    <div className="w-full lg:w-1/3 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Estado</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="isPublished"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel>Publicado</FormLabel>
                                                <FormDescription>
                                                    Visible en la tienda
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="isFeatured"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel>Destacado</FormLabel>
                                                <FormDescription>
                                                    Aparece en inicio
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="categoryId"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Categoría</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {categories.map((c) => (
                                                        <SelectItem key={c.id} value={c.id}>
                                                            {c.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Info className="h-4 w-4" /> Datos POS
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="offerPrice"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Precio de Oferta</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                                                    <Input type="number" className="pl-7" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="isOffer"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                            <div className="space-y-0.5">
                                                <FormLabel>En Oferta</FormLabel>
                                                <FormDescription>Producto en promoción</FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="unit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Unidad de Medida</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Und">Unidad (Und)</SelectItem>
                                                    <SelectItem value="Kg">Kilogramo (Kg)</SelectItem>
                                                    <SelectItem value="Lt">Litro (Lt)</SelectItem>
                                                    <SelectItem value="Mt">Metro (Mt)</SelectItem>
                                                    <SelectItem value="Caja">Caja</SelectItem>
                                                    <SelectItem value="Pack">Pack</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="taxRate"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tasa de Impuesto (%)</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="Ej: 19" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {/* Equivalencia de peso — solo visible para Kg */}
                                {form.watch("unit") === "Kg" && (
                                    <div className="mt-2 p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
                                        <div className="flex items-center gap-2 text-amber-700">
                                            <Info className="h-4 w-4" />
                                            <span className="text-xs font-bold uppercase tracking-wide">Venta por unidad equivalente</span>
                                        </div>
                                        <p className="text-xs text-amber-600">Si este producto se vende por unidad (ej: 1 Palta), define la etiqueta y el peso promedio. El cliente comprará unidades y el stock se descontará en kg.</p>
                                        <FormField
                                            control={form.control}
                                            name="equivLabel"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Etiqueta de venta</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ej: Palta, Pechuga, Malla" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value || null)} />
                                                    </FormControl>
                                                    <FormDescription>Nombre de la unidad que verá el cliente</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="equivWeight"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Peso por unidad (kg)</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" step="0.001" min="0.001" placeholder="Ej: 0.365" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))} />
                                                    </FormControl>
                                                    <FormDescription>Cuánto pesa una unidad en kg (3 decimales)</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Control de Precios</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="priceSource"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-muted-foreground">Fuente de Precio</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="global">Configuración Global</SelectItem>
                                                    <SelectItem value="pos">Precio POS</SelectItem>
                                                    <SelectItem value="manual">Manual</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="webPrice"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Precio Web</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                                                    <Input type="number" className="pl-7" {...field} />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Control de Stock</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="stockSource"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-muted-foreground">Fuente de Stock</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="global">Configuración Global</SelectItem>
                                                    <SelectItem value="pos">Stock POS</SelectItem>
                                                    <SelectItem value="manual">Manual</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="webStock"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Stock Web</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <div className="gap-2 flex flex-col">
                            <Button type="submit" disabled={isLoading} className="w-full">
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {initialData ? "Actualizar Producto" : "Crear Producto"}
                            </Button>
                            <Button type="button" variant="outline" className="w-full" onClick={() => router.back()}>
                                Cancelar
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
        </Form>
    );
}

function RefreshCwIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
        </svg>
    )
}
