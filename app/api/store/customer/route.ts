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

        await db.update(customers).set({
            firstName: body.firstName?.trim(),
            lastName: body.lastName?.trim(),
            phone: body.phone?.trim(),
            rut: body.rut?.trim() || null,
            address: body.address?.trim() || null,
            comuna: body.comuna?.trim() || null,
            city: body.city?.trim() || null,
            addressNotes: body.addressNotes?.trim() || null,
            updatedAt: new Date().toISOString(),
        }).where(eq(customers.id, session.user.id));

        return NextResponse.json({ message: "Perfil actualizado" });
    } catch (error) {
        console.error("[CUSTOMER_PROFILE_PUT]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
