import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { customers, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { verifyPassword } from "@/lib/auth-utils";
import { loginSchema } from "@/lib/validations/mobile-auth";
import { issueTokens } from "@/lib/mobile-auth";
import { adminToApiUser, customerToApiUser } from "@/lib/user-shape";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const data = loginSchema.parse(body);

        // 1. Buscar primero en admins (users) — su email es único entre admins
        const admin = await db.query.users.findFirst({
            where: and(eq(users.email, data.email), eq(users.active, true)),
        });
        if (admin) {
            const valid = await verifyPassword(data.password, admin.passwordHash);
            if (!valid) {
                return NextResponse.json({ message: "Credenciales inválidas", code: "invalid_credentials" }, { status: 401 });
            }
            const tokens = await issueTokens({
                id: admin.id,
                email: admin.email,
                role: admin.role,
                userType: "admin",
            });
            return NextResponse.json({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                user: adminToApiUser(admin),
            });
        }

        // 2. Buscar en customers
        const customer = await db.query.customers.findFirst({
            where: and(eq(customers.email, data.email), eq(customers.active, true)),
        });
        if (!customer) {
            return NextResponse.json({ message: "Credenciales inválidas", code: "invalid_credentials" }, { status: 401 });
        }
        const validC = await verifyPassword(data.password, customer.passwordHash);
        if (!validC) {
            return NextResponse.json({ message: "Credenciales inválidas", code: "invalid_credentials" }, { status: 401 });
        }
        const tokens = await issueTokens({
            id: customer.id,
            email: customer.email,
            role: "customer",
            userType: "customer",
        });
        return NextResponse.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: customerToApiUser(customer),
        });
    } catch (error: any) {
        if (error instanceof ZodError) {
            return NextResponse.json({ message: error.issues[0]?.message || "Datos inválidos", code: "validation_error" }, { status: 422 });
        }
        console.error("[AUTH_MOBILE_LOGIN]", error);
        return NextResponse.json({ message: "Error interno", code: "internal_error" }, { status: 500 });
    }
}
