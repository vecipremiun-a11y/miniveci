import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { customers, customerAddresses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "@/lib/auth-utils";
import { claimUnclaimedOrdersForCustomer, rutTakenByOtherCustomer, syncCustomerToPosveci } from "@/lib/pos-customer-match";
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

        // RUT único por tienda (espeja la regla de POSVECI). Solo valida contra escrituras nuevas.
        if (data.rut?.trim() && await rutTakenByOtherCustomer(data.rut.trim())) {
            return NextResponse.json(
                { error: "Ya existe una cuenta con este RUT" },
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

        // Si el cliente cargó dirección + comuna en el registro, crear también una
        // entrada en customerAddresses (predeterminada) para que aparezca preseleccionada
        // en el checkout y listada en "Mis Direcciones". Sin esto la dirección quedaría
        // solo en el perfil y el cliente tendría que reescribirla al pedir.
        if (data.address?.trim() && data.comuna?.trim()) {
            await db.insert(customerAddresses).values({
                id: crypto.randomUUID(),
                customerId: id,
                label: "Casa",
                address: data.address.trim(),
                comuna: data.comuna.trim(),
                city: data.city?.trim() || "Santiago",
                addressNotes: data.addressNotes?.trim() || null,
                isDefault: true,
            });
        }

        // Post-registro (background): sincronizar cliente a POSVECI por ID maestro y
        // reclamar encargos presenciales pendientes con estos identificadores.
        after(async () => {
            await syncCustomerToPosveci(id);
            try {
                await claimUnclaimedOrdersForCustomer(id);
            } catch (err) {
                console.error(`[CLAIM] register threw para ${id}:`, (err as Error).message);
            }
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
