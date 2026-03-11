import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customerAddresses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const addresses = await db
            .select()
            .from(customerAddresses)
            .where(eq(customerAddresses.customerId, session.user.id))
            .orderBy(customerAddresses.createdAt);

        return NextResponse.json(addresses);
    } catch (error) {
        console.error("[ADDRESSES_GET]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        if (!body.address?.trim() || !body.comuna?.trim()) {
            return NextResponse.json({ error: "Dirección y comuna son obligatorios" }, { status: 400 });
        }

        const id = crypto.randomUUID();
        const isDefault = body.isDefault ?? false;

        // If setting as default, unset others first
        if (isDefault) {
            await db.update(customerAddresses)
                .set({ isDefault: false })
                .where(eq(customerAddresses.customerId, session.user.id));
        }

        // If first address, always set as default
        const existing = await db.select({ id: customerAddresses.id })
            .from(customerAddresses)
            .where(eq(customerAddresses.customerId, session.user.id))
            .limit(1);
        const shouldBeDefault = isDefault || existing.length === 0;

        await db.insert(customerAddresses).values({
            id,
            customerId: session.user.id,
            label: body.label?.trim() || "Casa",
            address: body.address.trim(),
            comuna: body.comuna.trim(),
            city: body.city?.trim() || "Santiago",
            addressNotes: body.addressNotes?.trim() || null,
            isDefault: shouldBeDefault,
        });

        return NextResponse.json({ id, message: "Dirección agregada" }, { status: 201 });
    } catch (error) {
        console.error("[ADDRESSES_POST]", error);
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
        if (!body.id) {
            return NextResponse.json({ error: "ID requerido" }, { status: 400 });
        }

        // Verify ownership
        const addr = await db.select({ id: customerAddresses.id })
            .from(customerAddresses)
            .where(and(eq(customerAddresses.id, body.id), eq(customerAddresses.customerId, session.user.id)))
            .limit(1);

        if (addr.length === 0) {
            return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 });
        }

        if (body.isDefault) {
            await db.update(customerAddresses)
                .set({ isDefault: false })
                .where(eq(customerAddresses.customerId, session.user.id));
        }

        await db.update(customerAddresses).set({
            label: body.label?.trim() || "Casa",
            address: body.address?.trim(),
            comuna: body.comuna?.trim(),
            city: body.city?.trim() || "Santiago",
            addressNotes: body.addressNotes?.trim() || null,
            isDefault: body.isDefault ?? undefined,
            updatedAt: new Date().toISOString(),
        }).where(eq(customerAddresses.id, body.id));

        return NextResponse.json({ message: "Dirección actualizada" });
    } catch (error) {
        console.error("[ADDRESSES_PUT]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        if (!id) {
            return NextResponse.json({ error: "ID requerido" }, { status: 400 });
        }

        // Verify ownership
        const addr = await db.select({ id: customerAddresses.id, isDefault: customerAddresses.isDefault })
            .from(customerAddresses)
            .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, session.user.id)))
            .limit(1);

        if (addr.length === 0) {
            return NextResponse.json({ error: "Dirección no encontrada" }, { status: 404 });
        }

        await db.delete(customerAddresses).where(eq(customerAddresses.id, id));

        // If deleted address was default, set another as default
        if (addr[0].isDefault) {
            const remaining = await db.select({ id: customerAddresses.id })
                .from(customerAddresses)
                .where(eq(customerAddresses.customerId, session.user.id))
                .limit(1);
            if (remaining.length > 0) {
                await db.update(customerAddresses)
                    .set({ isDefault: true })
                    .where(eq(customerAddresses.id, remaining[0].id));
            }
        }

        return NextResponse.json({ message: "Dirección eliminada" });
    } catch (error) {
        console.error("[ADDRESSES_DELETE]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
