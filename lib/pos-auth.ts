import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiCredentials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Auth y CORS compartidos para todos los endpoints /api/pos/*.
 * Mismo patrón que sync/products y sync/stock.
 *
 * POS Veci envía credenciales en headers (acepta varios alias por compatibilidad):
 *   x-api-key | x-api-consumer-key | api_key | api-key
 *   x-api-secret | x-api-consumer-secret | api_secret | api-secret
 *
 * Validadas contra la fila id="main" de la tabla `api_credentials`.
 */

export const POS_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
        "Content-Type, x-api-key, x-api-secret, x-api-consumer-key, x-api-consumer-secret, api_key, api_secret, api-key, api-secret",
};

export function withPosCors(response: NextResponse): NextResponse {
    for (const [k, v] of Object.entries(POS_CORS_HEADERS)) {
        response.headers.set(k, v);
    }
    return response;
}

export function extractPosCredentials(req: NextRequest): { apiKey: string | null; apiSecret: string | null } {
    const apiKey =
        req.headers.get("x-api-key") ||
        req.headers.get("x-api-consumer-key") ||
        req.headers.get("api_key") ||
        req.headers.get("api-key");

    const apiSecret =
        req.headers.get("x-api-secret") ||
        req.headers.get("x-api-consumer-secret") ||
        req.headers.get("api_secret") ||
        req.headers.get("api-secret");

    return { apiKey, apiSecret };
}

/**
 * Devuelve null si las credenciales son válidas, o un NextResponse con error si no.
 * Uso típico:
 *   const denial = await requirePosCredentials(req);
 *   if (denial) return denial;
 */
export async function requirePosCredentials(req: NextRequest): Promise<NextResponse | null> {
    const { apiKey, apiSecret } = extractPosCredentials(req);
    if (!apiKey || !apiSecret) {
        return withPosCors(NextResponse.json({ error: "Missing api_key or api_secret" }, { status: 401 }));
    }
    const credentials = await db.query.apiCredentials.findFirst({
        where: eq(apiCredentials.id, "main"),
    });
    if (!credentials) {
        return withPosCors(NextResponse.json({ error: "API credentials not configured" }, { status: 503 }));
    }
    if (credentials.clientId !== apiKey || credentials.clientSecret !== apiSecret) {
        return withPosCors(NextResponse.json({ error: "Invalid api_key or api_secret" }, { status: 401 }));
    }
    return null;
}
