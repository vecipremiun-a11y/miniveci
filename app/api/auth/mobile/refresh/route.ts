import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { customers, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { refreshSchema } from "@/lib/validations/mobile-auth";
import { AuthHttpError, issueTokens, revokeRefreshToken, verifyRefreshToken } from "@/lib/mobile-auth";

/**
 * POST /api/auth/mobile/refresh
 * Verifica el refreshToken, lo rota (revoca el anterior y emite uno nuevo)
 * y emite un nuevo accessToken.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { refreshToken } = refreshSchema.parse(body);

        const { payload, row } = await verifyRefreshToken(refreshToken);

        // Buscar el usuario actual para incluir rol y email frescos
        let user: { id: string; email: string; role: string } | null = null;
        if (row.userType === "admin") {
            const u = await db.query.users.findFirst({ where: eq(users.id, row.userId) });
            if (u && u.active) user = { id: u.id, email: u.email, role: u.role };
        } else {
            const c = await db.query.customers.findFirst({ where: eq(customers.id, row.userId) });
            if (c && c.active) user = { id: c.id, email: c.email, role: "customer" };
        }
        if (!user) {
            await revokeRefreshToken(payload.jti!);
            return NextResponse.json({ message: "Usuario no encontrado o inactivo", code: "user_inactive" }, { status: 401 });
        }

        // Rotación: revoca el anterior y emite uno nuevo
        await revokeRefreshToken(payload.jti!);
        const tokens = await issueTokens({
            id: user.id,
            email: user.email,
            role: user.role,
            userType: row.userType as "customer" | "admin",
        });

        return NextResponse.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    } catch (error: any) {
        if (error instanceof AuthHttpError) {
            return NextResponse.json({ message: error.message, code: error.code }, { status: error.status });
        }
        if (error instanceof ZodError) {
            return NextResponse.json({ message: error.issues[0]?.message || "Datos inválidos", code: "validation_error" }, { status: 422 });
        }
        console.error("[AUTH_MOBILE_REFRESH]", error);
        return NextResponse.json({ message: "Error interno", code: "internal_error" }, { status: 500 });
    }
}
