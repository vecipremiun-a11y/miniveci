import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAuth, AuthError, hashPassword } from "@/lib/auth-utils";
import { updateUserSchema } from "@/lib/validations/user";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth();

        if (!["owner", "admin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;

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
            .where(eq(users.id, id))
            .limit(1);

        if (result.length === 0) {
            return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
        }

        return NextResponse.json(result[0]);
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[USER_GET]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth();

        if (!["owner", "admin"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const validatedData = updateUserSchema.parse(body);

        // Fetch existing user
        const existingResult = await db
            .select()
            .from(users)
            .where(eq(users.id, id))
            .limit(1);

        if (existingResult.length === 0) {
            return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
        }

        const existingUser = existingResult[0];

        // Prevent non-owners from editing owner accounts
        if (existingUser.role === "owner" && session.user.role !== "owner") {
            return NextResponse.json(
                { error: "Solo un dueño puede editar cuentas de dueño" },
                { status: 403 }
            );
        }

        // Prevent non-owners from assigning owner role
        if (validatedData.role === "owner" && session.user.role !== "owner") {
            return NextResponse.json(
                { error: "Solo un dueño puede asignar el rol de dueño" },
                { status: 403 }
            );
        }

        // Prevent deactivating yourself
        if (id === session.user.id && validatedData.active === false) {
            return NextResponse.json(
                { error: "No puedes desactivar tu propia cuenta" },
                { status: 400 }
            );
        }

        // Prevent changing your own role
        if (id === session.user.id && validatedData.role && validatedData.role !== existingUser.role) {
            return NextResponse.json(
                { error: "No puedes cambiar tu propio rol" },
                { status: 400 }
            );
        }

        // Check email uniqueness if changed
        if (validatedData.email && validatedData.email !== existingUser.email) {
            const emailCheck = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.email, validatedData.email))
                .limit(1);

            if (emailCheck.length > 0) {
                return NextResponse.json(
                    { error: "Ya existe un usuario con este correo electrónico" },
                    { status: 409 }
                );
            }
        }

        // Build update data
        const updateData: Record<string, unknown> = {
            updatedAt: new Date().toISOString(),
        };

        if (validatedData.name) updateData.name = validatedData.name;
        if (validatedData.email) updateData.email = validatedData.email;
        if (validatedData.role) updateData.role = validatedData.role;
        if (validatedData.active !== undefined) updateData.active = validatedData.active;

        // Hash new password if provided
        if (validatedData.password && validatedData.password.length > 0) {
            updateData.passwordHash = await hashPassword(validatedData.password);
        }

        await db.update(users).set(updateData).where(eq(users.id, id));

        // Return updated user (without password)
        const updated = await db
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
            .where(eq(users.id, id))
            .limit(1);

        return NextResponse.json(updated[0]);
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
        console.error("[USER_PUT]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await requireAuth();

        // Only owner can delete users
        if (session.user.role !== "owner") {
            return NextResponse.json(
                { error: "Solo el dueño puede eliminar usuarios" },
                { status: 403 }
            );
        }

        const { id } = await params;

        // Prevent self-deletion
        if (id === session.user.id) {
            return NextResponse.json(
                { error: "No puedes eliminar tu propia cuenta" },
                { status: 400 }
            );
        }

        const existingResult = await db
            .select({ id: users.id, role: users.role })
            .from(users)
            .where(eq(users.id, id))
            .limit(1);

        if (existingResult.length === 0) {
            return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
        }

        await db.delete(users).where(eq(users.id, id));

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        console.error("[USER_DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
