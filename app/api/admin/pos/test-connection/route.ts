import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { posConfig } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
    try {
        const rows = await db.select().from(posConfig).limit(1);
        const config = rows[0];

        if (!config?.apiUrl || !config?.apiKey) {
            return NextResponse.json({
                success: false,
                message: "Configura primero la URL y API Key del POS.",
            });
        }

        const pingUrl = config.apiUrl.replace(/\/$/, "") + "/api/external/ping";

        const res = await fetch(pingUrl, {
            headers: { Authorization: `Bearer ${config.apiKey}` },
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
            const body = await res.text();
            await db.update(posConfig).set({
                isConnected: false,
                lastConnectionTest: new Date().toISOString(),
            }).where(eq(posConfig.id, config.id));

            return NextResponse.json({
                success: false,
                message: `Error ${res.status}: ${body.slice(0, 200)}`,
            });
        }

        const data = await res.json();

        await db.update(posConfig).set({
            isConnected: true,
            lastConnectionTest: new Date().toISOString(),
        }).where(eq(posConfig.id, config.id));

        return NextResponse.json({
            success: true,
            message: `Conectado a ${data.service || "POS"} v${data.version || "?"}`,
        });
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            message: error.message || "Error de conexión desconocido",
        }, { status: 500 });
    }
}
