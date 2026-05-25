import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { customers, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z, ZodError } from "zod";
import { AuthHttpError, requireUser } from "@/lib/mobile-auth";
import { adminToApiUser, customerToApiUser, customerToProfile } from "@/lib/user-shape";
import {
    claimUnclaimedOrdersForCustomer,
    rutTakenByOtherCustomer,
    syncCustomerToPosveci,
} from "@/lib/pos-customer-match";

export async function GET(req: NextRequest) {
    try {
        const authed = await requireUser(req);
        if (authed.userType === "admin") {
            const u = await db.query.users.findFirst({ where: eq(users.id, authed.userId) });
            if (!u || !u.active) {
                return NextResponse.json({ message: "Usuario no encontrado", code: "user_not_found" }, { status: 404 });
            }
            return NextResponse.json(adminToApiUser(u));
        }
        const c = await db.query.customers.findFirst({ where: eq(customers.id, authed.userId) });
        if (!c || !c.active) {
            return NextResponse.json({ message: "Usuario no encontrado", code: "user_not_found" }, { status: 404 });
        }
        return NextResponse.json(customerToProfile(c));
    } catch (error) {
        if (error instanceof AuthHttpError) {
            return NextResponse.json({ message: error.message, code: error.code }, { status: error.status });
        }
        console.error("[AUTH_ME]", error);
        return NextResponse.json({ message: "Error interno", code: "internal_error" }, { status: 500 });
    }
}

const updateProfileSchema = z.object({
    name: z.string().min(2, "Nombre muy corto").max(80).optional(),
    firstName: z.string().min(1).max(80).optional(),
    lastName: z.string().max(80).optional(),
    phone: z.string().max(20).optional().nullable(),
    rut: z.string().max(20).optional().nullable(),
    address: z.string().max(240).optional().nullable(),
    comuna: z.string().max(120).optional().nullable(),
    city: z.string().max(120).optional().nullable(),
    addressNotes: z.string().max(280).optional().nullable(),
    avatarUrl: z.string().max(500).optional().nullable(),
}).strict();

function splitName(fullName: string): { firstName: string; lastName: string } {
    const trimmed = fullName.trim();
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx === -1) return { firstName: trimmed, lastName: "" };
    return { firstName: trimmed.slice(0, spaceIdx), lastName: trimmed.slice(spaceIdx + 1).trim() };
}

/**
 * PATCH /api/auth/me
 *
 * Edición de perfil desde la app (Flutter) vía JWT (Bearer). Hermano mobile del
 * PUT /api/store/customer que usa sesión web. Solo customers.
 *
 * Body (todos opcionales, se actualiza solo lo que venga):
 *   { name | firstName/lastName, phone, rut, address, comuna, city, addressNotes, avatarUrl }
 *
 * Reglas:
 *   - RUT único por tienda → 409 si el RUT ya está en otra cuenta.
 *   - Al editar, sincroniza el cliente a POSVECI por ID maestro (background).
 *   - Si cambió el RUT, reclama encargos presenciales pendientes (background).
 *
 * Responde el perfil actualizado (CustomerProfile).
 */
export async function PATCH(req: NextRequest) {
    try {
        const authed = await requireUser(req);
        if (authed.userType !== "customer") {
            return NextResponse.json({ message: "Solo clientes pueden editar este perfil", code: "forbidden" }, { status: 403 });
        }

        const body = await req.json().catch(() => ({}));
        const data = updateProfileSchema.parse(body);

        const customer = await db.query.customers.findFirst({ where: eq(customers.id, authed.userId) });
        if (!customer || !customer.active) {
            return NextResponse.json({ message: "Usuario no encontrado", code: "user_not_found" }, { status: 404 });
        }

        const updateData: Record<string, string | null> = { updatedAt: new Date().toISOString() };

        // Nombre: aceptar `name` (se parte) o firstName/lastName explícitos.
        if (data.name !== undefined) {
            const { firstName, lastName } = splitName(data.name);
            updateData.firstName = firstName;
            updateData.lastName = lastName;
        }
        if (data.firstName !== undefined) updateData.firstName = data.firstName.trim();
        if (data.lastName !== undefined) updateData.lastName = data.lastName.trim();
        if (data.phone !== undefined) updateData.phone = data.phone?.trim() || "";
        if (data.rut !== undefined) updateData.rut = data.rut?.trim() || null;
        if (data.address !== undefined) updateData.address = data.address?.trim() || null;
        if (data.comuna !== undefined) updateData.comuna = data.comuna?.trim() || null;
        if (data.city !== undefined) updateData.city = data.city?.trim() || null;
        if (data.addressNotes !== undefined) updateData.addressNotes = data.addressNotes?.trim() || null;
        if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl?.trim() || null;

        // RUT único por tienda (espeja POSVECI). Solo valida si llega un RUT no vacío.
        const newRut = typeof updateData.rut === "string" ? updateData.rut : null;
        if (newRut && await rutTakenByOtherCustomer(newRut, authed.userId)) {
            return NextResponse.json({ message: "Ya existe una cuenta con este RUT", code: "rut_taken" }, { status: 409 });
        }

        await db.update(customers).set(updateData).where(eq(customers.id, authed.userId));

        const rutChanged = data.rut !== undefined;
        after(async () => {
            await syncCustomerToPosveci(authed.userId);
            if (rutChanged) {
                try {
                    await claimUnclaimedOrdersForCustomer(authed.userId);
                } catch (err) {
                    console.error(`[CLAIM] PATCH /me threw para ${authed.userId}:`, (err as Error).message);
                }
            }
        });

        const updated = await db.query.customers.findFirst({ where: eq(customers.id, authed.userId) });
        return NextResponse.json(updated ? customerToProfile(updated) : customerToApiUser(customer));
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json({ message: error.issues[0]?.message || "Datos inválidos", code: "validation_error" }, { status: 422 });
        }
        if (error instanceof AuthHttpError) {
            return NextResponse.json({ message: error.message, code: error.code }, { status: error.status });
        }
        console.error("[AUTH_ME_PATCH]", error);
        return NextResponse.json({ message: "Error interno", code: "internal_error" }, { status: 500 });
    }
}
