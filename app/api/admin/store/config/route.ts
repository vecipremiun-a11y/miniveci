import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { storeConfig } from "@/lib/db/schema";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { loadStoreDeliveryConfig, STORE_CONFIG_KEYS } from "@/lib/store-config";
import { z, ZodError } from "zod";

export const dynamic = "force-dynamic";

/** Tope de cordura: nadie cobra 100 lucas de despacho ni regala sobre 10 millones. */
const MAX_DELIVERY_FEE = 100_000;
const MAX_FREE_THRESHOLD = 10_000_000;

const updateSchema = z.object({
    deliveryFee: z.number()
        .int("El costo de envío debe ser un número entero")
        .min(0, "El costo de envío no puede ser negativo")
        .max(MAX_DELIVERY_FEE, `El costo de envío no puede superar $${MAX_DELIVERY_FEE.toLocaleString("es-CL")}`)
        .optional(),
    /** 0 apaga el envío gratis. */
    freeDeliveryThreshold: z.number()
        .int("El monto debe ser un número entero")
        .min(0, "El monto no puede ser negativo")
        .max(MAX_FREE_THRESHOLD, "El monto es demasiado alto")
        .optional(),
});

/** GET /api/admin/store/config — condiciones de envío actuales. */
export async function GET() {
    try {
        await requireAuth();
        return NextResponse.json(await loadStoreDeliveryConfig());
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ message: "No autorizado" }, { status: 401 });
        }
        console.error("[ADMIN_STORE_CONFIG_GET]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}

/** PATCH /api/admin/store/config — guarda solo las claves que vengan. */
export async function PATCH(req: NextRequest) {
    try {
        await requireAuth();
        const body = await req.json().catch(() => ({}));
        const data = updateSchema.parse(body);

        const now = new Date().toISOString();
        const entries: Array<[string, number]> = [];
        if (data.deliveryFee !== undefined) entries.push([STORE_CONFIG_KEYS.deliveryFee, data.deliveryFee]);
        if (data.freeDeliveryThreshold !== undefined) {
            entries.push([STORE_CONFIG_KEYS.freeDeliveryThreshold, data.freeDeliveryThreshold]);
        }

        for (const [key, value] of entries) {
            await db.insert(storeConfig)
                .values({ key, value: String(value), updatedAt: now })
                .onConflictDoUpdate({
                    target: storeConfig.key,
                    set: { value: String(value), updatedAt: now },
                });
        }

        return NextResponse.json(await loadStoreDeliveryConfig());
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ message: "No autorizado" }, { status: 401 });
        }
        if (error instanceof ZodError) {
            return NextResponse.json({ message: error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
        }
        console.error("[ADMIN_STORE_CONFIG_PATCH]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}
