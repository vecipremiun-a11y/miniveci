import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posWebhookEvents } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

        const hooks = await db.select().from(posWebhookEvents)
            .orderBy(desc(posWebhookEvents.createdAt))
            .limit(limit);

        return NextResponse.json({ data: hooks });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const id = crypto.randomUUID();

        await db.insert(posWebhookEvents).values({
            id,
            eventType: body.event_type || "unknown",
            payload: body,
            processed: false,
            retryCount: 0,
        });

        return NextResponse.json({ success: true, id });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
