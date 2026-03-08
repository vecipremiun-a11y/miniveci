import { db } from "@/lib/db";
import { apiCredentials, orderItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type PosSyncResult = {
    sent: number;
    failed: number;
    errors: string[];
};

function getSecurityHeaders(clientSecret: string, clientId: string, webhookSecret: string) {
    return {
        "Content-Type": "application/json",
        client_secret: clientSecret,
        client_id: clientId,
        "x-webhook-secret": webhookSecret,
    } as const;
}

export async function syncPaidOrderToPos(orderId: string): Promise<PosSyncResult> {
    const credentials = await db.query.apiCredentials.findFirst({
        where: eq(apiCredentials.id, "main"),
    });

    if (!credentials || !credentials.posWebhookUrl) {
        return {
            sent: 0,
            failed: 0,
            errors: ["No hay credenciales API/POS configuradas"],
        };
    }

    const items = await db.select({
        sku: orderItems.productSku,
        quantity: orderItems.quantity,
    })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId));

    if (items.length === 0) {
        return {
            sent: 0,
            failed: 0,
            errors: ["La orden no tiene items"],
        };
    }

    const result: PosSyncResult = {
        sent: 0,
        failed: 0,
        errors: [],
    };

    for (const item of items) {
        try {
            const response = await fetch(credentials.posWebhookUrl, {
                method: "POST",
                headers: getSecurityHeaders(
                    credentials.clientSecret,
                    credentials.clientId,
                    credentials.webhookSecret,
                ),
                body: JSON.stringify({
                    sku: item.sku,
                    cantidad_vendida: item.quantity,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`POS respondió ${response.status}: ${errorBody}`);
            }

            result.sent += 1;
        } catch (error: any) {
            result.failed += 1;
            result.errors.push(`SKU ${item.sku}: ${error?.message || "Error desconocido"}`);
        }
    }

    return result;
}
