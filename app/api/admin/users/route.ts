import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAuth, AuthError, hashPassword } from "@/lib/auth-utils";
import { createUserSchema } from "@/lib/validations/user";
import { desc, eq, like, or, sql, and } from "drizzle-orm";
import { ZodError } from "zod";

export async function GET(req: NextRequest) {
    try {
        const session = await requireAuth();

        // Only owner and admin can manage users
        if (!["owner", "admin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search") || "";
        const role = searchParams.get("role") || "";
        const status = searchParams.get("status") || ""; // "active", "inactive", ""

        const conditions = [];

        if (search) {
            conditions.push(
                or(
                    like(users.name, `%${search}%`),
                    like(users.email, `%${search}%`)
                )
            );
        }

        if (role && role !== "all") {
            conditions.push(eq(users.role, role));
        }

        if (status === "active") {
            conditions.push(eq(users.active, true));
        } else if (status === "inactive") {
            conditions.push(eq(users.active, false));
        }

        const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

        const result = await db
            .select({
                id: users.id,
                email: users.email,
                name: users.name,
                role: users.role,
                active: users.active,
                avatarUrl: users.avatarUrl,
                createdAt: users.createdAt,
                updatedAt: users.updatedAt,
            })
            .from(users)
            .where(whereCondition)
            .orderBy(desc(users.createdAt));

        return NextResponse.json({ users: result });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[USERS_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await requireAuth();

        // Only owner and admin can create users
        if (!["owner", "admin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const validatedData = createUserSchema.parse(body);

        // Prevent non-owners from creating owner accounts
        if (validatedData.role === "owner" && session.user.role !== "owner") {
            return NextResponse.json(
                { error: "Solo un dueño puede crear cuentas de dueño" },
                { status: 403 }
            );
        }

        // Check email uniqueness
        const existingUser = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, validatedData.email))
            .limit(1);

        if (existingUser.length > 0) {
            return NextResponse.json(
                { error: "Ya existe un usuario con este correo electrónico" },
                { status: 409 }
            );
        }

        // Hash the password
        const passwordHash = await hashPassword(validatedData.password);

        const newUser = await db
            .insert(users)
            .values({
                id: crypto.randomUUID(),
                email: validatedData.email,
                passwordHash,
                name: validatedData.name,
                role: validatedData.role,
                active: validatedData.active,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            })
            .returning({
                id: users.id,
                email: users.email,
                name: users.name,
                role: users.role,
                active: users.active,
                createdAt: users.createdAt,
            });

        return NextResponse.json(newUser[0], { status: 201 });
    } catch (error: any) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (error?.name === "ZodError" || error instanceof ZodError) {
            return NextResponse.json(
                { error: "Error de validación", details: error.errors },
                { status: 400 }
            );
        }
        console.error("[USERS_POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
