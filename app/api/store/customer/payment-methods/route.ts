import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customerPaymentMethods } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";

// List saved payment methods
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const methods = await db
            .select({
                id: customerPaymentMethods.id,
                brand: customerPaymentMethods.brand,
                lastFourDigits: customerPaymentMethods.lastFourDigits,
                expirationMonth: customerPaymentMethods.expirationMonth,
                expirationYear: customerPaymentMethods.expirationYear,
                cardholderName: customerPaymentMethods.cardholderName,
                isDefault: customerPaymentMethods.isDefault,
                createdAt: customerPaymentMethods.createdAt,
            })
            .from(customerPaymentMethods)
            .where(eq(customerPaymentMethods.customerId, session.user.id))
            .orderBy(customerPaymentMethods.createdAt);

        return NextResponse.json(methods);
    } catch (error) {
        console.error("Error fetching payment methods:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

// Save a new payment method from MP card data
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { mpCustomerId, mpCardId, brand, lastFourDigits, expirationMonth, expirationYear, cardholderName } = body;

        if (!lastFourDigits || !brand) {
            return NextResponse.json({ error: "Datos de tarjeta incompletos" }, { status: 400 });
        }

        // Check if this card already exists
        const existing = await db
            .select()
            .from(customerPaymentMethods)
            .where(
                and(
                    eq(customerPaymentMethods.customerId, session.user.id),
                    eq(customerPaymentMethods.lastFourDigits, lastFourDigits)
                )
            );

        if (existing.length > 0) {
            return NextResponse.json({ error: "Esta tarjeta ya está guardada" }, { status: 409 });
        }

        // Check if this is the first card (auto-set as default)
        const allCards = await db
            .select()
            .from(customerPaymentMethods)
            .where(eq(customerPaymentMethods.customerId, session.user.id));

        const isDefault = allCards.length === 0;

        const id = randomUUID();
        await db.insert(customerPaymentMethods).values({
            id,
            customerId: session.user.id,
            mpCustomerId: mpCustomerId || null,
            mpCardId: mpCardId || null,
            brand: brand.toLowerCase(),
            lastFourDigits,
            expirationMonth: expirationMonth || null,
            expirationYear: expirationYear || null,
            cardholderName: cardholderName || null,
            isDefault,
        });

        return NextResponse.json({ success: true, id }, { status: 201 });
    } catch (error) {
        console.error("Error saving payment method:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

// Delete a payment method
export async function DELETE(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const methodId = searchParams.get("id");

        if (!methodId) {
            return NextResponse.json({ error: "ID requerido" }, { status: 400 });
        }

        // Ensure the method belongs to this customer
        const [method] = await db
            .select()
            .from(customerPaymentMethods)
            .where(
                and(
                    eq(customerPaymentMethods.id, methodId),
                    eq(customerPaymentMethods.customerId, session.user.id)
                )
            );

        if (!method) {
            return NextResponse.json({ error: "Método de pago no encontrado" }, { status: 404 });
        }

        await db.delete(customerPaymentMethods).where(eq(customerPaymentMethods.id, methodId));

        // If we deleted the default card, set another as default
        if (method.isDefault) {
            const remaining = await db
                .select()
                .from(customerPaymentMethods)
                .where(eq(customerPaymentMethods.customerId, session.user.id))
                .limit(1);

            if (remaining.length > 0) {
                await db.update(customerPaymentMethods)
                    .set({ isDefault: true })
                    .where(eq(customerPaymentMethods.id, remaining[0].id));
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting payment method:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

// Set default payment method
export async function PUT(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id || session.user.role !== "customer") {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }

        const body = await req.json();
        const { id: methodId } = body;

        if (!methodId) {
            return NextResponse.json({ error: "ID requerido" }, { status: 400 });
        }

        // Verify ownership
        const [method] = await db
            .select()
            .from(customerPaymentMethods)
            .where(
                and(
                    eq(customerPaymentMethods.id, methodId),
                    eq(customerPaymentMethods.customerId, session.user.id)
                )
            );

        if (!method) {
            return NextResponse.json({ error: "Método de pago no encontrado" }, { status: 404 });
        }

        // Reset all to non-default
        await db.update(customerPaymentMethods)
            .set({ isDefault: false })
            .where(eq(customerPaymentMethods.customerId, session.user.id));

        // Set selected as default
        await db.update(customerPaymentMethods)
            .set({ isDefault: true })
            .where(eq(customerPaymentMethods.id, methodId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error updating payment method:", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
