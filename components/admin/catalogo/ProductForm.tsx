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
import { Loader2, Plus, X, UploadCloud, Info, Trash2, TrendingDown, Infinity, ArrowRight, Zap, Tag, DollarSign, TrendingUp } from "lucide-react";
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
    const [subscriptionUtility, setSubscriptionUtility] = useState(5);

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
            costPrice: initialData?.costPrice ?? null,
            profitMargin: initialData?.profitMargin ?? null,
            subscriptionPrice: initialData?.subscriptionPrice ?? null,
            priceSource: initialData?.priceSource || "global",
            stockSource: initialData?.stockSource || "global",
            reservedQty: initialData?.reservedQty || 0,
            isPublished: initialData?.isPublished ?? true,
            isFeatured: initialData?.isFeatured ?? false,
            tags: initialData?.tags || [],
            badges: initialData?.badges || [],
            priceTiers: initialData?.priceTiers || [],
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
                                    <Info className="h-4 w-4" /> Promoción y Detalles
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
                                <CardTitle>Precio</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="priceSource"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-muted-foreground">Modo de precio</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="global">Automático</SelectItem>
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
                                            <FormLabel>Precio</FormLabel>
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

                        {/* Costo del Producto */}
                        <Card className="overflow-hidden border-0 shadow-lg shadow-emerald-100/50">
                            <CardHeader className="pb-3 bg-gradient-to-r from-emerald-600 to-teal-500 text-white">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                                        <DollarSign className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base text-white">Costo del Producto</CardTitle>
                                        <CardDescription className="text-emerald-100">Precio de costo y margen de ganancia</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-5 bg-gradient-to-b from-emerald-50/40 to-white space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="costPrice"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Precio de Costo</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-sm">$</span>
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            className="pl-7 h-11 border-2 border-emerald-200 rounded-xl font-bold text-emerald-800 focus:border-emerald-400"
                                                            value={field.value ?? ''}
                                                            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="taxRate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Impuesto (%)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            placeholder="Ej: 19"
                                                            className="pr-8 h-11 border-2 border-emerald-200 rounded-xl font-bold text-emerald-800 focus:border-emerald-400"
                                                            value={field.value ?? ''}
                                                            onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                                                        />
                                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-sm">%</span>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                {/* Calculated profit summary — discounts tax from price first */}
                                {(() => {
                                    const cost = form.watch('costPrice');
                                    const price = form.watch('webPrice');
                                    const taxRate = form.watch('taxRate');
                                    if (!cost || !price || cost <= 0) return null;
                                    const tax = taxRate && taxRate > 0 ? taxRate : 0;
                                    const priceWithoutTax = Math.round(price / (1 + tax / 100));
                                    const taxAmount = price - priceWithoutTax;
                                    const profit = priceWithoutTax - cost;
                                    const margin = ((profit / priceWithoutTax) * 100).toFixed(1);
                                    const fmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
                                    return (
                                        <div className="rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/60 p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <TrendingUp className="h-4 w-4 text-emerald-600" />
                                                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Resumen</span>
                                            </div>
                                            <div className={`grid ${tax > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-3 text-center`}>
                                                <div>
                                                    <p className="text-[10px] text-emerald-600 font-semibold uppercase">Costo</p>
                                                    <p className="text-sm font-black text-emerald-800">{fmt.format(cost)}</p>
                                                </div>
                                                {tax > 0 && (
                                                    <div>
                                                        <p className="text-[10px] text-emerald-600 font-semibold uppercase">Impuesto</p>
                                                        <p className="text-sm font-black text-amber-600">{fmt.format(taxAmount)}</p>
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-[10px] text-emerald-600 font-semibold uppercase">Ganancia</p>
                                                    <p className={`text-sm font-black ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{fmt.format(profit)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-emerald-600 font-semibold uppercase">Margen real</p>
                                                    <p className={`text-sm font-black ${profit >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{margin}%</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>

                        {/* Precio Suscripción */}
                        <Card className="overflow-hidden border-0 shadow-lg shadow-blue-100/50">
                            <CardHeader className="pb-3 bg-gradient-to-r from-blue-600 to-indigo-500 text-white">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                                        <Zap className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base text-white">Precio Suscripción</CardTitle>
                                        <CardDescription className="text-blue-100">Precio especial para clientes con suscripción activa</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-5 bg-gradient-to-b from-blue-50/40 to-white space-y-4">
                                {(() => {
                                    const cost = form.watch('costPrice');
                                    const taxRate = form.watch('taxRate');
                                    const subscriptionPrice = form.watch('subscriptionPrice');
                                    const webPrice = form.watch('webPrice');
                                    const tax = taxRate && taxRate > 0 ? taxRate : 0;
                                    const costPlusTax = cost && cost > 0 ? Math.round(cost * (1 + tax / 100)) : null;
                                    const fmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });
                                    const savings = subscriptionPrice && webPrice ? webPrice - subscriptionPrice : null;
                                    const savingsPercent = savings && webPrice ? ((savings / webPrice) * 100).toFixed(0) : null;

                                    const [utilityPct, setUtilityPct] = [subscriptionUtility, setSubscriptionUtility];
                                    const suggestedPrice = costPlusTax ? Math.round(costPlusTax * (1 + utilityPct / 100)) : null;

                                    return (
                                        <>
                                            {costPlusTax && (
                                                <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 space-y-2">
                                                    <div className="text-xs text-blue-700">
                                                        <span className="font-semibold">Costo + IVA:</span> {fmt.format(costPlusTax)} <span className="text-blue-500">({fmt.format(cost!)} + {tax}%)</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-semibold text-blue-700">Utilidad:</span>
                                                        <div className="relative w-24">
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                step={0.5}
                                                                value={utilityPct}
                                                                onChange={(e) => setUtilityPct(Number(e.target.value) || 0)}
                                                                className="h-7 pr-7 text-xs font-bold text-blue-800 border-blue-200 rounded-lg"
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 text-xs font-bold">%</span>
                                                        </div>
                                                        <ArrowRight className="h-3 w-3 text-blue-400" />
                                                        <span className="text-xs font-bold text-blue-800">{suggestedPrice ? fmt.format(suggestedPrice) : '-'}</span>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                                                            onClick={() => suggestedPrice && form.setValue('subscriptionPrice', suggestedPrice)}
                                                        >
                                                            Aplicar
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                            <FormField
                                                control={form.control}
                                                name="subscriptionPrice"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-bold text-blue-700 uppercase tracking-wider">Precio Suscriptor</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 font-bold text-sm">$</span>
                                                                <Input
                                                                    type="number"
                                                                    min={0}
                                                                    className="pl-7 h-11 border-2 border-blue-200 rounded-xl font-bold text-blue-800 focus:border-blue-400"
                                                                    value={field.value ?? ''}
                                                                    onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                                                                />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            {savings !== null && savings > 0 && (
                                                <div className="rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/60 p-3">
                                                    <div className="grid grid-cols-3 gap-3 text-center">
                                                        <div>
                                                            <p className="text-[10px] text-blue-600 font-semibold uppercase">Precio Normal</p>
                                                            <p className="text-sm font-black text-gray-400 line-through">{fmt.format(webPrice!)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-blue-600 font-semibold uppercase">Precio Suscriptor</p>
                                                            <p className="text-sm font-black text-blue-700">{fmt.format(subscriptionPrice!)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] text-blue-600 font-semibold uppercase">Ahorro</p>
                                                            <p className="text-sm font-black text-green-600">{fmt.format(savings)} ({savingsPercent}%)</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </CardContent>
                        </Card>

                        {/* Escala de Precios */}
                        <Card className="overflow-hidden border-0 shadow-lg shadow-purple-100/50">
                            <CardHeader className="pb-4 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-500 text-white">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                                        <Tag className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-base text-white">Escala de Precios por Cantidad</CardTitle>
                                        <CardDescription className="text-purple-100">Define precios especiales según la cantidad que compre el cliente</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="pt-5 bg-gradient-to-b from-purple-50/40 to-white">
                                <FormField
                                    control={form.control}
                                    name="priceTiers"
                                    render={({ field }) => {
                                        const tiers = field.value || [];

                                        const tierColors = [
                                            { bg: 'from-blue-50 to-sky-50', border: 'border-blue-200', badge: 'bg-blue-500', badgeText: 'text-white', accent: 'text-blue-600', label: 'bg-blue-100 text-blue-700', ring: 'ring-blue-200' },
                                            { bg: 'from-emerald-50 to-teal-50', border: 'border-emerald-200', badge: 'bg-emerald-500', badgeText: 'text-white', accent: 'text-emerald-600', label: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-200' },
                                            { bg: 'from-amber-50 to-orange-50', border: 'border-amber-200', badge: 'bg-amber-500', badgeText: 'text-white', accent: 'text-amber-600', label: 'bg-amber-100 text-amber-700', ring: 'ring-amber-200' },
                                            { bg: 'from-rose-50 to-pink-50', border: 'border-rose-200', badge: 'bg-rose-500', badgeText: 'text-white', accent: 'text-rose-600', label: 'bg-rose-100 text-rose-700', ring: 'ring-rose-200' },
                                            { bg: 'from-violet-50 to-purple-50', border: 'border-violet-200', badge: 'bg-violet-500', badgeText: 'text-white', accent: 'text-violet-600', label: 'bg-violet-100 text-violet-700', ring: 'ring-violet-200' },
                                        ];

                                        const addTier = () => {
                                            const updated = [...tiers];
                                            if (updated.length > 0 && updated[updated.length - 1].maxQty === null) {
                                                const prevMin = updated[updated.length - 1].minQty ?? 1;
                                                updated[updated.length - 1] = { ...updated[updated.length - 1], maxQty: prevMin + 9 };
                                            }
                                            const lastMax = updated.length > 0 ? (updated[updated.length - 1].maxQty ?? 0) : 0;
                                            field.onChange([...updated, { minQty: lastMax + 1, maxQty: null, price: 0 }]);
                                        };

                                        const updateTier = (index: number, key: string, value: number | null) => {
                                            const updated = [...tiers];
                                            updated[index] = { ...updated[index], [key]: value };
                                            field.onChange(updated);
                                        };

                                        const removeTier = (index: number) => {
                                            field.onChange(tiers.filter((_: any, i: number) => i !== index));
                                        };

                                        return (
                                            <FormItem>
                                                {tiers.length > 0 && (
                                                    <div className="space-y-3">
                                                        {tiers.map((tier: any, i: number) => {
                                                            const isLast = tier.maxQty === null;
                                                            const colors = tierColors[i % tierColors.length];
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    className={`relative rounded-2xl border-2 ${colors.border} bg-gradient-to-r ${colors.bg} p-4 transition-all hover:shadow-md hover:scale-[1.01]`}
                                                                >
                                                                    {/* Left color stripe */}
                                                                    <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${colors.badge}`} />

                                                                    {/* Header */}
                                                                    <div className="flex items-center justify-between mb-4 pl-3">
                                                                        <div className="flex items-center gap-2.5">
                                                                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black ${colors.badge} ${colors.badgeText} shadow-sm`}>
                                                                                {i + 1}
                                                                            </span>
                                                                            <div>
                                                                                <span className="text-sm font-bold text-slate-800 block">
                                                                                    {isLast
                                                                                        ? `Compra ${tier.minQty}+ unidades`
                                                                                        : `Compra ${tier.minQty} a ${tier.maxQty} unidades`
                                                                                    }
                                                                                </span>
                                                                                {isLast && (
                                                                                    <span className={`inline-flex items-center gap-1 mt-0.5 text-[11px] font-bold ${colors.accent}`}>
                                                                                        <Zap className="h-3 w-3" />
                                                                                        Mejor precio — sin límite de cantidad
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeTier(i)}
                                                                            className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-100 transition-all"
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </button>
                                                                    </div>

                                                                    {/* Inputs */}
                                                                    <div className="grid grid-cols-3 gap-3 pl-3">
                                                                        {/* Min Qty */}
                                                                        <div>
                                                                            <label className={`text-[11px] font-bold uppercase tracking-wider mb-1.5 block ${colors.accent}`}>Desde</label>
                                                                            <Input
                                                                                type="number"
                                                                                min={1}
                                                                                className={`h-11 text-center text-base font-bold bg-white border-2 ${colors.border} focus:${colors.ring} rounded-xl`}
                                                                                value={tier.minQty}
                                                                                onChange={(e) => updateTier(i, 'minQty', Number(e.target.value))}
                                                                            />
                                                                        </div>

                                                                        {/* Max Qty */}
                                                                        <div>
                                                                            <label className={`text-[11px] font-bold uppercase tracking-wider mb-1.5 block ${colors.accent}`}>Hasta</label>
                                                                            {isLast ? (
                                                                                <div className={`h-11 rounded-xl border-2 border-dashed ${colors.border} bg-white/60 flex items-center justify-center gap-2`}>
                                                                                    <Infinity className={`h-5 w-5 ${colors.accent}`} />
                                                                                    <span className={`text-sm font-bold ${colors.accent}`}>∞</span>
                                                                                </div>
                                                                            ) : (
                                                                                <Input
                                                                                    type="number"
                                                                                    min={tier.minQty}
                                                                                    className={`h-11 text-center text-base font-bold bg-white border-2 ${colors.border} rounded-xl`}
                                                                                    value={tier.maxQty ?? ''}
                                                                                    placeholder="∞"
                                                                                    onChange={(e) => updateTier(i, 'maxQty', e.target.value === '' ? null : Number(e.target.value))}
                                                                                />
                                                                            )}
                                                                        </div>

                                                                        {/* Price */}
                                                                        <div>
                                                                            <label className={`text-[11px] font-bold uppercase tracking-wider mb-1.5 block ${colors.accent}`}>Precio c/u</label>
                                                                            <div className="relative">
                                                                                <span className={`absolute left-3 top-1/2 -translate-y-1/2 font-black text-sm ${colors.accent}`}>$</span>
                                                                                <Input
                                                                                    type="number"
                                                                                    min={0}
                                                                                    className={`h-11 pl-7 text-base font-black bg-white border-2 ${colors.border} rounded-xl ${colors.accent}`}
                                                                                    value={tier.price}
                                                                                    onChange={(e) => updateTier(i, 'price', Number(e.target.value))}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={addTier}
                                                    className="mt-4 w-full border-dashed border-2 border-purple-300 hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700 text-purple-500 font-semibold rounded-xl h-11 transition-all hover:shadow-md"
                                                >
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Agregar rango de precio
                                                </Button>
                                                {tiers.length === 0 && (
                                                    <div className="text-center py-8">
                                                        <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-fuchsia-100 flex items-center justify-center mb-3 shadow-inner">
                                                            <Tag className="h-7 w-7 text-purple-400" />
                                                        </div>
                                                        <p className="text-sm font-semibold text-slate-600">
                                                            Sin escala de precios
                                                        </p>
                                                        <p className="text-xs text-slate-400 mt-1 max-w-[250px] mx-auto">
                                                            Agrega rangos para ofrecer mejores precios por mayor cantidad
                                                        </p>
                                                    </div>
                                                )}
                                                <FormMessage />
                                            </FormItem>
                                        );
                                    }}
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Inventario</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="stockSource"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs text-muted-foreground">Modo de inventario</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="global">Automático</SelectItem>
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
                                            <FormLabel>Stock</FormLabel>
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
