import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth-utils";
import { z } from "zod";

const registerSchema = z.object({
    firstName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    lastName: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
    email: z.string().email("Correo electrónico inválido"),
    phone: z.string().min(8, "El teléfono debe tener al menos 8 dígitos"),
    password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
    rut: z.string().optional(),
    address: z.string().optional(),
    comuna: z.string().optional(),
    city: z.string().optional(),
    addressNotes: z.string().optional(),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const data = registerSchema.parse(body);

        // Check if email already exists
        const existing = await db
            .select({ id: customers.id })
            .from(customers)
            .where(eq(customers.email, data.email.toLowerCase().trim()))
            .limit(1);

        if (existing.length > 0) {
            return NextResponse.json(
                { error: "Ya existe una cuenta con este correo electrónico" },
                { status: 409 }
            );
        }

        const passwordHash = await hashPassword(data.password);
        const id = crypto.randomUUID();

        await db.insert(customers).values({
            id,
            email: data.email.toLowerCase().trim(),
            passwordHash,
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            phone: data.phone.trim(),
            rut: data.rut?.trim() || null,
            address: data.address?.trim() || null,
            comuna: data.comuna?.trim() || null,
            city: data.city?.trim() || "Santiago",
            addressNotes: data.addressNotes?.trim() || null,
        });

        return NextResponse.json(
            { message: "Cuenta creada exitosamente", customerId: id },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            const messages = error.issues.map((i: z.ZodIssue) => i.message);
            return NextResponse.json(
                { error: "Datos inválidos", details: messages },
                { status: 400 }
            );
        }
        console.error("[REGISTER_POST]", error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
