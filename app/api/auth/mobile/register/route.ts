import { NextRequest, NextResponse, after } from "next/server";
import { randomUUID } from "crypto";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth-utils";
import { registerSchema } from "@/lib/validations/mobile-auth";
import { issueTokens } from "@/lib/mobile-auth";
import { customerToApiUser } from "@/lib/user-shape";
import { claimUnclaimedOrdersForCustomer } from "@/lib/pos-customer-match";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const data = registerSchema.parse(body);

        // Email único — busca en customers
        const existing = await db.query.customers.findFirst({ where: eq(customers.email, data.email) });
        if (existing) {
            return NextResponse.json({ message: "Ese email ya está registrado", code: "email_taken" }, { status: 409 });
        }

        // Separar el `name` en firstName + lastName (todo lo que viene después del primer espacio)
        const trimmedName = data.name.trim();
        const spaceIdx = trimmedName.indexOf(" ");
        const firstName = spaceIdx === -1 ? trimmedName : trimmedName.slice(0, spaceIdx);
        const lastName = spaceIdx === -1 ? "" : trimmedName.slice(spaceIdx + 1).trim();

        const id = randomUUID();
        const now = new Date().toISOString();
        const passwordHash = await hashPassword(data.password);

        await db.insert(customers).values({
            id,
            email: data.email,
            passwordHash,
            firstName,
            lastName,
            phone: data.phone?.trim() || "",
            active: true,
            createdAt: now,
            updatedAt: now,
        });

        const created = await db.query.customers.findFirst({ where: eq(customers.id, id) });
        if (!created) {
            return NextResponse.json({ message: "Error al crear el usuario", code: "create_failed" }, { status: 500 });
        }

        const tokens = await issueTokens({
            id: created.id,
            email: created.email,
            role: "customer",
            userType: "customer",
        });

        // Reclamar encargos presenciales que POSVECI haya empujado antes con estos identificadores.
        after(async () => {
            try {
                await claimUnclaimedOrdersForCustomer(created.id);
            } catch (err) {
                console.error(`[CLAIM] mobile register threw para ${created.id}:`, (err as Error).message);
            }
        });

        return NextResponse.json({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: customerToApiUser(created),
        }, { status: 201 });
    } catch (error: any) {
        if (error instanceof ZodError) {
            return NextResponse.json({ message: error.issues[0]?.message || "Datos inválidos", code: "validation_error" }, { status: 422 });
        }
        console.error("[AUTH_MOBILE_REGISTER]", error);
        return NextResponse.json({ message: "Error interno", code: "internal_error" }, { status: 500 });
    }
}
