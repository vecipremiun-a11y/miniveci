import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posSyncLogs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);

        const logs = await db.select().from(posSyncLogs)
            .orderBy(desc(posSyncLogs.createdAt))
            .limit(limit);

        return NextResponse.json({ data: logs });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
