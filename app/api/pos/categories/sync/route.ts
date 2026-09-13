import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { categories, products } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requirePosCredentials, withPosCors } from "@/lib/pos-auth";
import { foldSearchText } from "@/lib/search-text";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POSVECI manda el árbol completo de categorías (categoría → subcategoría → hija).
// La llave es el id de POSVECI, no el nombre: el nombre cambia, el id no.
// Acepta camelCase y snake_case, igual que el sync de productos.
const idLike = z.union([z.string(), z.number()]).transform((v) => String(v).trim());
const optionalIdLike = z.union([z.string(), z.number()]).nullish().transform((v) =>
    v === null || v === undefined ? null : String(v).trim() || null
);

const categoryRawSchema = z.object({
    posCategoryId: idLike.optional(),
    pos_category_id: idLike.optional(),
    id: idLike.optional(),
    name: z.string().trim().min(1, "name es requerido"),
    parentPosCategoryId: optionalIdLike,
    parent_pos_category_id: optionalIdLike,
    parentId: optionalIdLike,
    parent_id: optionalIdLike,
    active: z.boolean().optional(),
    status: z.string().optional(),
    sortOrder: z.number().optional(),
    sort_order: z.number().optional(),
}).transform((c) => ({
    posCategoryId: c.posCategoryId || c.pos_category_id || c.id || "",
    name: c.name,
    parentPosCategoryId: c.parentPosCategoryId ?? c.parent_pos_category_id ?? c.parentId ?? c.parent_id ?? null,
    active: c.active ?? (c.status === undefined ? true : c.status === "active"),
    sortOrder: c.sortOrder ?? c.sort_order ?? null,
})).refine((c) => c.posCategoryId.length > 0, {
    message: "Falta posCategoryId (el id de la categoría en POSVECI)",
});

const bodySchema = z.union([
    z.array(categoryRawSchema),
    z.object({
        categories: z.array(categoryRawSchema),
        // Desactiva en la tienda las categorías de POSVECI que ya no vengan en el
        // envío. Por defecto no, para que un envío parcial no apague media tienda.
        deactivateMissing: z.boolean().optional(),
    }),
]);

type IncomingCategory = z.output<typeof categoryRawSchema>;
type ExistingCategory = {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    posCategoryId: string | null;
    isActive: boolean | null;
    sortOrder: number | null;
};

function uniqueSlug(name: string, posCategoryId: string, used: Set<string>): string {
    const base = slugify(name) || `categoria-${slugify(posCategoryId) || "pos"}`;
    let candidate = used.has(base) ? `${base}-${slugify(posCategoryId) || "pos"}` : base;
    let n = 2;
    while (used.has(candidate)) candidate = `${base}-${n++}`;
    used.add(candidate);
    return candidate;
}

export async function OPTIONS() {
    return withPosCors(new NextResponse(null, { status: 204 }));
}

async function handleCategoriesSync(req: NextRequest) {
    const denial = await requirePosCredentials(req);
    if (denial) return denial;

    try {
        const parsed = bodySchema.parse(await req.json());
        const incoming: IncomingCategory[] = Array.isArray(parsed) ? parsed : parsed.categories;
        const deactivateMissing = Array.isArray(parsed) ? false : parsed.deactivateMissing ?? false;

        if (incoming.length === 0) {
            return withPosCors(NextResponse.json({ error: "El payload no trae categorías" }, { status: 400 }));
        }

        // Si un id viene repetido en el payload, se queda el último
        const unique = new Map<string, IncomingCategory>(incoming.map((c) => [c.posCategoryId, c]));

        const existing: ExistingCategory[] = await db
            .select({
                id: categories.id,
                name: categories.name,
                slug: categories.slug,
                parentId: categories.parentId,
                posCategoryId: categories.posCategoryId,
                isActive: categories.isActive,
                sortOrder: categories.sortOrder,
            })
            .from(categories);

        const counts = await db
            .select({ categoryId: products.categoryId, total: sql<number>`count(*)`.mapWith(Number) })
            .from(products)
            .groupBy(products.categoryId);
        const productCount = new Map(counts.map((row) => [row.categoryId ?? "", row.total]));

        const existingById = new Map(existing.map((row) => [row.id, row]));
        const byPosId = new Map<string, ExistingCategory>();
        const bySlug = new Map<string, ExistingCategory>();
        const byName = new Map<string, ExistingCategory>();

        for (const row of existing) {
            if (row.posCategoryId) byPosId.set(row.posCategoryId, row);
            if (!bySlug.has(row.slug)) bySlug.set(row.slug, row);

            // Con nombres repetidos (las tildes dejaron "Estantería" duplicada) gana
            // la que ya tiene id de POSVECI y, si no, la que tiene más productos:
            // esa es la que la tienda está usando de verdad.
            const key = foldSearchText(row.name);
            const current = byName.get(key);
            const mejor = !current
                || (Boolean(row.posCategoryId) && !current.posCategoryId)
                || (productCount.get(row.id) ?? 0) > (productCount.get(current.id) ?? 0);
            if (mejor) byName.set(key, row);
        }

        const now = new Date().toISOString();
        const internalIdByPosId = new Map<string, string>();
        const takenInternalIds = new Set<string>();
        const usedSlugs = new Set(existing.map((row) => row.slug));
        let created = 0;
        let updated = 0;
        let adopted = 0;

        // 1) Cada categoría de POSVECI pasa a existir en la tienda (o se reusa la que ya estaba)
        for (const incomingCategory of unique.values()) {
            // El nombre va antes que el slug: el slug limpio ("estanteria") es justo el
            // de la fila duplicada vacía, y la que usa la tienda quedó con el viejo
            // ("estanter-a"). byName ya elige la fila con más productos.
            const candidate = byPosId.get(incomingCategory.posCategoryId)
                ?? byName.get(foldSearchText(incomingCategory.name))
                ?? bySlug.get(slugify(incomingCategory.name));
            // Dos categorías de POSVECI no pueden quedarse con la misma fila
            const match = candidate && !takenInternalIds.has(candidate.id) ? candidate : undefined;

            if (match) {
                takenInternalIds.add(match.id);
                const changes: Record<string, unknown> = {};
                if (match.posCategoryId !== incomingCategory.posCategoryId) {
                    changes.posCategoryId = incomingCategory.posCategoryId;
                    adopted++;
                }
                if (match.name !== incomingCategory.name) changes.name = incomingCategory.name;
                if (incomingCategory.sortOrder !== null && match.sortOrder !== incomingCategory.sortOrder) {
                    changes.sortOrder = incomingCategory.sortOrder;
                }
                if (Boolean(match.isActive) !== incomingCategory.active) changes.isActive = incomingCategory.active;

                if (Object.keys(changes).length > 0) {
                    changes.updatedAt = now;
                    await db.update(categories).set(changes).where(eq(categories.id, match.id));
                    updated++;
                }
                internalIdByPosId.set(incomingCategory.posCategoryId, match.id);
            } else {
                const id = crypto.randomUUID();
                await db.insert(categories).values({
                    id,
                    name: incomingCategory.name,
                    slug: uniqueSlug(incomingCategory.name, incomingCategory.posCategoryId, usedSlugs),
                    posCategoryId: incomingCategory.posCategoryId,
                    isActive: incomingCategory.active,
                    sortOrder: incomingCategory.sortOrder ?? 0,
                    createdAt: now,
                    updatedAt: now,
                });
                takenInternalIds.add(id);
                internalIdByPosId.set(incomingCategory.posCategoryId, id);
                created++;
            }
        }

        // 2) Recién con todas creadas se puede atar cada una a su padre.
        // Un padre que no venga en el envío deja la categoría en primer nivel.
        let parentsLinked = 0;
        for (const incomingCategory of unique.values()) {
            const id = internalIdByPosId.get(incomingCategory.posCategoryId);
            if (!id) continue;

            const parentId = incomingCategory.parentPosCategoryId
                ? internalIdByPosId.get(incomingCategory.parentPosCategoryId) ?? null
                : null;
            const safeParentId = parentId && parentId !== id ? parentId : null;
            const before = existingById.get(id)?.parentId ?? null;

            if (before !== safeParentId) {
                await db.update(categories).set({ parentId: safeParentId, updatedAt: now }).where(eq(categories.id, id));
                if (safeParentId) parentsLinked++;
            }
        }

        let deactivated = 0;
        if (deactivateMissing) {
            for (const row of existing) {
                if (row.posCategoryId && !unique.has(row.posCategoryId) && row.isActive) {
                    await db.update(categories).set({ isActive: false, updatedAt: now }).where(eq(categories.id, row.id));
                    deactivated++;
                }
            }
        }

        return withPosCors(NextResponse.json({
            success: true,
            message: "Árbol de categorías sincronizado",
            received: unique.size,
            created,
            updated,
            adopted,
            parentsLinked,
            deactivated,
        }, { status: 200 }));
    } catch (error: unknown) {
        if (error instanceof z.ZodError) {
            return withPosCors(NextResponse.json({ error: "Validation Error", details: error.issues }, { status: 400 }));
        }
        console.error("[POS_SYNC_CATEGORIES]", error);
        return withPosCors(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
    }
}

export async function POST(req: NextRequest) {
    return handleCategoriesSync(req);
}

export async function PUT(req: NextRequest) {
    return handleCategoriesSync(req);
}
