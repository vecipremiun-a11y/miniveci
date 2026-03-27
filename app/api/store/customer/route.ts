import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const result = await db
            .select({
                id: customers.id,
                email: customers.email,
                firstName: customers.firstName,
                lastName: customers.lastName,
                phone: customers.phone,
                rut: customers.rut,
                avatarUrl: customers.avatarUrl,
                address: customers.address,
                comuna: customers.comuna,
                city: customers.city,
                addressNotes: customers.addressNotes,
            })
            .from(customers)
            .where(eq(customers.id, session.user.id))
            .limit(1);

        if (result.length === 0) {
            return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
        }

        return NextResponse.json(result[0]);
    } catch (error) {
        console.error("[CUSTOMER_PROFILE_GET]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();

        const updateData: Record<string, string | null> = {
            updatedAt: new Date().toISOString(),
        };

        // Solo actualizar campos que vienen explícitamente en el body
        if ('firstName' in body) updateData.firstName = body.firstName?.trim();
        if ('lastName' in body) updateData.lastName = body.lastName?.trim();
        if ('phone' in body) updateData.phone = body.phone?.trim();
        if ('rut' in body) updateData.rut = body.rut?.trim() || null;
        if ('address' in body) updateData.address = body.address?.trim() || null;
        if ('comuna' in body) updateData.comuna = body.comuna?.trim() || null;
        if ('city' in body) updateData.city = body.city?.trim() || null;
        if ('addressNotes' in body) updateData.addressNotes = body.addressNotes?.trim() || null;
        if ('avatarUrl' in body) updateData.avatarUrl = body.avatarUrl || null;

        await db.update(customers).set(updateData).where(eq(customers.id, session.user.id));

        return NextResponse.json({ message: "Perfil actualizado" });
    } catch (error) {
        console.error("[CUSTOMER_PROFILE_PUT]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
