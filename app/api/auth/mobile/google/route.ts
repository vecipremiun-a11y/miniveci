/**
 * POST /api/auth/mobile/google
 *
 * Recibe un idToken de Google Sign-In emitido del lado app (Flutter).
 * Valida, upsert customer, emite el mismo par JWT que /api/auth/mobile/login.
 *
 * Body:
 *   { idToken: string }
 *
 * Response 200:
 *   { accessToken, refreshToken, user }
 */
import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { verifyGoogleIdToken, GoogleAuthError } from "@/lib/google-auth-verify";
import { upsertCustomerFromGoogle } from "@/lib/customer-google-upsert";
import { issueTokens } from "@/lib/mobile-auth";

const bodySchema = z.object({
    idToken: z.string().min(20),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { idToken } = bodySchema.parse(body);

        // 1. Verificar token de Google
        const google = await verifyGoogleIdToken(idToken);

        // 2. Upsert customer en nuestra DB
        const customer = await upsertCustomerFromGoogle({
            googleSub: google.sub,
            email: google.email,
            name: google.name,
            picture: google.picture,
        });

        // 3. Emitir tokens (mismo formato que /login)
        const tokens = await issueTokens({
            id: customer.id,
            email: customer.email,
            role: "customer",
            userType: "customer",
        });

        return NextResponse.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                phone: customer.phone,
                role: "customer",
                userType: "customer",
            },
        });
    } catch (error: any) {
        if (error instanceof ZodError) {
            return NextResponse.json({ message: error.issues[0]?.message || "Datos inválidos", code: "validation_error" }, { status: 400 });
        }
        if (error instanceof GoogleAuthError) {
            const status = error.code === "not_configured" ? 500 : 400;
            return NextResponse.json({ message: error.message, code: error.code }, { status });
        }
        console.error("[AUTH_MOBILE_GOOGLE]", error);
        return NextResponse.json({ message: "Error interno", code: "internal_error" }, { status: 500 });
    }
}
