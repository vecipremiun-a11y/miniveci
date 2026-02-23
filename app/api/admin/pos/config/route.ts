import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
    try {
        const rows = await db.select().from(posConfig).limit(1);
        if (rows.length === 0) {
            const id = "main";
            await db.insert(posConfig).values({ id });
            const created = await db.select().from(posConfig).where(eq(posConfig.id, id));
            return NextResponse.json(created[0]);
        }
        return NextResponse.json(rows[0]);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const id = "main";

        const rows = await db.select().from(posConfig).where(eq(posConfig.id, id));
        if (rows.length === 0) {
            await db.insert(posConfig).values({ id });
        }

        await db.update(posConfig).set({
            apiUrl: body.apiUrl ?? null,
            apiKey: body.apiKey ?? null,
            companyId: body.companyId ?? null,
            syncPrices: body.syncPrices ?? true,
            syncStock: body.syncStock ?? true,
            syncName: body.syncName ?? false,
            syncImages: body.syncImages ?? false,
            updatedAt: new Date().toISOString(),
        }).where(eq(posConfig.id, id));

        const updated = await db.select().from(posConfig).where(eq(posConfig.id, id));
        return NextResponse.json(updated[0]);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
