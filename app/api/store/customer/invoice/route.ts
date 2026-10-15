import { NextRequest, NextResponse } from "next/server";
import { getBakeryUser } from "@/lib/bakery-auth";
import { deleteCustomerInvoice, getCustomerInvoice, saveCustomerInvoice } from "@/lib/customer-invoice";
import { invoiceInputSchema } from "@/lib/validations/invoice";

/**
 * Datos de factura guardados del cliente (Mi cuenta → Facturación y precarga
 * del checkout). Ver lib/customer-invoice.ts.
 *
 * Auth: sesión web o `Authorization: Bearer` de la app.
 *
 * GET    → { invoice: {...} | null }
 * PUT    → guarda/reemplaza; responde { invoice }
 * DELETE → borra los datos guardados
 */

async function customerIdFrom(req: NextRequest): Promise<string | null> {
    const user = await getBakeryUser(req);
    return user?.customerId ?? null;
}

export async function GET(req: NextRequest) {
    try {
        const customerId = await customerIdFrom(req);
        if (!customerId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        return NextResponse.json({ invoice: await getCustomerInvoice(customerId) });
    } catch (error) {
        console.error("[CUSTOMER_INVOICE_GET]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const customerId = await customerIdFrom(req);
        if (!customerId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        const parsed = invoiceInputSchema.safeParse(await req.json().catch(() => null));
        if (!parsed.success) {
            return NextResponse.json({ error: parsed.error.issues[0]?.message || "Datos de factura inválidos" }, { status: 400 });
        }
        await saveCustomerInvoice(customerId, parsed.data);
        return NextResponse.json({ invoice: parsed.data });
    } catch (error) {
        console.error("[CUSTOMER_INVOICE_PUT]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const customerId = await customerIdFrom(req);
        if (!customerId) {
            return NextResponse.json({ error: "No autorizado" }, { status: 401 });
        }
        await deleteCustomerInvoice(customerId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[CUSTOMER_INVOICE_DELETE]", error);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
