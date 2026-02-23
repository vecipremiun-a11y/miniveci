import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posWebhookEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;

        const rows = await db.select().from(posWebhookEvents).where(eq(posWebhookEvents.id, id));
        if (rows.length === 0) {
            return NextResponse.json({ success: false, message: "Webhook no encontrado" }, { status: 404 });
        }

        // Mark as reprocessed
        await db.update(posWebhookEvents).set({
            processed: true,
            processedAt: new Date().toISOString(),
            processResult: "Reprocesado manualmente",
        }).where(eq(posWebhookEvents.id, id));

        return NextResponse.json({ success: true, message: "Webhook reprocesado." });
    } catch (error: any) {
        return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
}
