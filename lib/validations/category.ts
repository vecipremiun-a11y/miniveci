import * as z from "zod";

export const categorySchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    slug: z.string().min(1, "El slug es requerido").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido"),
    description: z.string().optional(),
    imageUrl: z.string().url("URL de imagen inválida").optional().or(z.literal("")),
    parentId: z.string().optional().nullable(),
    isActive: z.boolean().default(true),
    syncPriceSource: z.enum(["global", "pos", "manual"]).default("global"),
    syncStockSource: z.enum(["global", "pos", "manual"]).default("global"),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
