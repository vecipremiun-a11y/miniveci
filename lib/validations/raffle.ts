import * as z from "zod";

export const rafflePrizeSchema = z.object({
    id: z.string().optional(),
    position: z.number().int().min(1),
    name: z.string().min(1, "El nombre del premio es requerido"),
    description: z.string().optional().nullable(),
});

export const raffleSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    slug: z.string().min(1).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido").optional(),
    description: z.string().optional().nullable(),
    type: z.enum(["free", "paid", "in_store"]),
    price: z.number().int().min(0).optional().nullable(),
    audience: z.enum(["all", "customers", "subscribers"]).default("all"),
    totalNumbers: z.number().int().min(1, "Mínimo 1 número").max(9999, "Máximo 9999 números"),
    status: z.enum(["draft", "active", "closed", "drawn"]).default("draft"),
    startsAt: z.string().optional().nullable(),
    endsAt: z.string().optional().nullable(),
    drawAt: z.string().optional().nullable(),
    coverImage: z.string().url().optional().nullable().or(z.literal("")),
    terms: z.string().optional().nullable(),
    featured: z.boolean().default(false),
    prizes: z.array(rafflePrizeSchema).min(1, "Debe haber al menos un premio").optional(),
}).refine(
    (data) => data.type !== "paid" || (data.price != null && data.price > 0),
    { message: "Los sorteos pagados requieren precio > 0", path: ["price"] }
);

export type RaffleFormValues = z.infer<typeof raffleSchema>;
export type RafflePrizeFormValues = z.infer<typeof rafflePrizeSchema>;
