/**
 * Seed de productos de amasandería.
 *
 * Uso:
 *   npm run db:seed:bakery
 *
 * Lee `.env.local` para TURSO_DATABASE_URL / TURSO_AUTH_TOKEN.
 * Inserta solo los que no existan (por id determinístico) — re-ejecutar es seguro.
 */
// Las env vars se cargan con `tsx --env-file=.env.local` (ver package.json).
import { db } from "../lib/db";
import { bakeryProducts } from "../lib/db/schema";
import { eq } from "drizzle-orm";

interface SeedProduct {
    id: string;
    name: string;
    description: string;
    category: "pan" | "sandwich" | "hamburguesa" | "canape" | "dulce";
    pricingMode: "unit" | "kg";
    price: number;
    gramsPerUnit: number | null;
    allowsNotes: boolean;
    sortOrder: number;
}

const PRODUCTS: SeedProduct[] = [
    {
        id: "bp_seed_marraqueta",
        name: "Marraqueta",
        description: "Pan tradicional chileno, crujiente por fuera y esponjoso por dentro.",
        category: "pan",
        pricingMode: "kg",
        price: 2200,
        gramsPerUnit: 90,
        allowsNotes: false,
        sortOrder: 1,
    },
    {
        id: "bp_seed_hallulla",
        name: "Hallulla",
        description: "Pan plano y redondo, ideal para sándwiches.",
        category: "pan",
        pricingMode: "kg",
        price: 2400,
        gramsPerUnit: 80,
        allowsNotes: false,
        sortOrder: 2,
    },
    {
        id: "bp_seed_sandwich_ave_palta",
        name: "Sándwich Ave Palta",
        description: "Pan amasado, pollo deshilachado y palta fresca.",
        category: "sandwich",
        pricingMode: "unit",
        price: 3500,
        gramsPerUnit: null,
        allowsNotes: true,
        sortOrder: 10,
    },
    {
        id: "bp_seed_sandwich_italiano",
        name: "Sándwich Italiano",
        description: "Tomate, palta y mayonesa en pan frica.",
        category: "sandwich",
        pricingMode: "unit",
        price: 3200,
        gramsPerUnit: null,
        allowsNotes: true,
        sortOrder: 11,
    },
    {
        id: "bp_seed_empanada_pino",
        name: "Empanada de pino",
        description: "Horneada al momento — carne, cebolla, huevo y aceituna.",
        category: "dulce",
        pricingMode: "unit",
        price: 2500,
        gramsPerUnit: null,
        allowsNotes: false,
        sortOrder: 20,
    },
];

async function main() {
    const now = new Date().toISOString();
    let inserted = 0;
    let skipped = 0;

    for (const p of PRODUCTS) {
        const existing = await db.query.bakeryProducts.findFirst({
            where: eq(bakeryProducts.id, p.id),
            columns: { id: true },
        });
        if (existing) {
            skipped++;
            console.log(`  · skip ${p.id} (ya existe)`);
            continue;
        }
        await db.insert(bakeryProducts).values({
            ...p,
            imageUrl: null,
            active: true,
            createdAt: now,
            updatedAt: now,
        });
        inserted++;
        console.log(`  + ${p.name} (${p.category}, ${p.pricingMode === "unit" ? `$${p.price}/u` : `$${p.price}/kg`})`);
    }

    console.log(`\nSeed bakery OK — ${inserted} insertados, ${skipped} omitidos.`);
}

main().then(() => process.exit(0)).catch((err) => {
    console.error("[seed-bakery] error:", err);
    process.exit(1);
});
