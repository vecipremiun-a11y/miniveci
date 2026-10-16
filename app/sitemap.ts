import type { MetadataRoute } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { absoluteUrl, parseDbTimestamp } from "@/lib/seo";

// Se regenera cada hora: los productos se publican y despublican desde POSVECI.
export const revalidate = 3600;

const STATIC_PATHS = ["/", "/productos", "/amasanderia", "/contacto", "/suscripcion", "/sorteos", "/politica-privacidad"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({ url: absoluteUrl(path) }));

    try {
        const rows = await db
            .select({ slug: products.slug, updatedAt: products.updatedAt })
            .from(products)
            .where(sql`${products.isPublished} = 1`);

        for (const row of rows) {
            const lastModified = parseDbTimestamp(row.updatedAt);
            entries.push({
                url: absoluteUrl(`/productos/${row.slug}`),
                ...(lastModified ? { lastModified } : {}),
            });
        }
    } catch (error) {
        // Mejor un sitemap sin productos que un 500: Google lo volverá a pedir.
        console.error("[sitemap] no se pudieron leer los productos", error);
    }

    return entries;
}
