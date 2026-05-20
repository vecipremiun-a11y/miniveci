import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { bakeryConfig } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth-utils";
import { bakeryConfigUpdateSchema } from "@/lib/validations/bakery";
import { loadBakeryConfig } from "@/lib/bakery";
import { ZodError } from "zod";

const SERIALIZERS: Record<string, (v: any) => string> = {
    min_hours_ahead: (v) => String(v),
    max_days_ahead: (v) => String(v),
    closed_weekdays: (v) => JSON.stringify(v),
    open_hour: (v) => String(v),
    close_hour: (v) => String(v),
    slot_minutes: (v) => String(v),
    offers_delivery: (v) => (v ? "true" : "false"),
    delivery_fee: (v) => String(v),
};

export async function PATCH(req: NextRequest) {
    try {
        await requireAuth();
        const body = await req.json().catch(() => ({}));
        const data = bakeryConfigUpdateSchema.parse(body);

        // Upsert por cada key presente
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined) continue;
            const stringified = SERIALIZERS[key](value);
            await db.insert(bakeryConfig)
                .values({ key, value: stringified })
                .onConflictDoUpdate({
                    target: bakeryConfig.key,
                    set: { value: stringified },
                });
        }

        const cfg = await loadBakeryConfig();
        return NextResponse.json(cfg);
    } catch (error: any) {
        if (error instanceof AuthError) return NextResponse.json({ message: "No autorizado" }, { status: 401 });
        if (error instanceof ZodError) {
            return NextResponse.json({ message: error.issues[0]?.message || "Datos inválidos" }, { status: 400 });
        }
        console.error("[ADMIN_BAKERY_CONFIG_PATCH]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}
