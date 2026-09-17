import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionCustomerId } from "@/lib/session-customer";

export async function GET() {
    try {
        const customerId = await getSessionCustomerId();
        if (!customerId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const result = await db.select().from(subscriptions)
            .where(eq(subscriptions.customerId, customerId))
            .orderBy(desc(subscriptions.createdAt))
            .limit(1);

        const sub = result[0] ?? null;

        if (sub && sub.status === "active") {
            const now = new Date();
            const endDate = new Date(sub.endDate);
            if (now > endDate) {
                await db.update(subscriptions)
                    .set({ status: "expired", updatedAt: new Date().toISOString() })
                    .where(eq(subscriptions.id, sub.id));
                sub.status = "expired";
            }
        }

        return NextResponse.json({ subscription: sub });
    } catch (error) {
        console.error("[SUBSCRIPTION_GET]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
