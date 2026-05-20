/**
 * Endpoints para registro/baja de tokens FCM por usuario autenticado.
 *
 * POST /api/user/push-token   → upsert token (al login o cuando rota el token)
 * DELETE /api/user/push-token → borrar token específico (al logout)
 *
 * Auth: Authorization: Bearer <accessToken>
 * Solo usuarios tipo "customer" pueden registrar tokens (admins no usan la app).
 */
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userPushTokens } from "@/lib/db/schema";
import { extractBearer, verifyAccessToken, AuthHttpError } from "@/lib/mobile-auth";

const upsertSchema = z.object({
    token: z.string().trim().min(8).max(4096),
    platform: z.enum(["android", "ios"]).default("android"),
});

const deleteSchema = z.object({
    token: z.string().trim().min(8).max(4096),
});

async function authenticate(req: NextRequest): Promise<{ userId: string } | NextResponse> {
    const token = extractBearer(req);
    if (!token) {
        return NextResponse.json({ message: "Falta Authorization", code: "missing_token" }, { status: 401 });
    }
    try {
        const payload = await verifyAccessToken(token);
        if (payload.userType !== "customer") {
            return NextResponse.json({ message: "Solo clientes pueden registrar tokens", code: "forbidden" }, { status: 403 });
        }
        return { userId: payload.sub };
    } catch (err) {
        if (err instanceof AuthHttpError) {
            return NextResponse.json({ message: err.message, code: err.code }, { status: err.status });
        }
        return NextResponse.json({ message: "Token inválido", code: "invalid_token" }, { status: 401 });
    }
}

export async function POST(req: NextRequest) {
    const auth = await authenticate(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json().catch(() => ({}));
        const data = upsertSchema.parse(body);
        const now = new Date().toISOString();

        // Upsert: lookup existente por (userId, token) único
        const existing = await db.query.userPushTokens.findFirst({
            where: and(
                eq(userPushTokens.userId, auth.userId),
                eq(userPushTokens.token, data.token),
            ),
        });

        if (existing) {
            await db.update(userPushTokens)
                .set({ platform: data.platform, updatedAt: now })
                .where(eq(userPushTokens.id, existing.id));
            return NextResponse.json({ success: true, action: "updated" });
        }

        await db.insert(userPushTokens).values({
            id: randomUUID(),
            userId: auth.userId,
            token: data.token,
            platform: data.platform,
            createdAt: now,
            updatedAt: now,
        });
        return NextResponse.json({ success: true, action: "created" }, { status: 201 });
    } catch (error) {
        if (error instanceof ZodError) {
            const issue = error.issues[0];
            const path = issue?.path?.join(".") || "";
            return NextResponse.json({
                message: path ? `Invalid input at "${path}": ${issue?.message}` : issue?.message,
            }, { status: 400 });
        }
        console.error("[PUSH_TOKEN_UPSERT]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const auth = await authenticate(req);
    if (auth instanceof NextResponse) return auth;

    try {
        const body = await req.json().catch(() => ({}));
        const { token } = deleteSchema.parse(body);

        await db.delete(userPushTokens).where(and(
            eq(userPushTokens.userId, auth.userId),
            eq(userPushTokens.token, token),
        ));

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json({
                message: error.issues[0]?.message || "Invalid input",
            }, { status: 400 });
        }
        console.error("[PUSH_TOKEN_DELETE]", error);
        return NextResponse.json({ message: "Error interno" }, { status: 500 });
    }
}
