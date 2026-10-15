/**
 * Datos de factura guardados del cliente ("Mi cuenta → Facturación").
 *
 * Acuerdo con POSVECI: se guardan tras el primer pedido con factura y se
 * precargan en el checkout, pero `invoice` solo viaja en el pedido si el
 * cliente marca "Quiero factura" en ESE pedido. Si en el checkout cambia los
 * datos (otro RUT, otra razón social), los nuevos reemplazan a los guardados.
 * POSVECI no guarda copia: factura con lo que llega en cada pedido.
 */

import { db } from "@/lib/db";
import { customerInvoiceData } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { InvoiceInput } from "@/lib/validations/invoice";

export async function getCustomerInvoice(customerId: string): Promise<InvoiceInput | null> {
    const row = await db.query.customerInvoiceData.findFirst({
        where: eq(customerInvoiceData.customerId, customerId),
    });
    if (!row) return null;
    return {
        rut: row.rut,
        razonSocial: row.razonSocial,
        giro: row.giro,
        direccion: row.direccion,
        comuna: row.comuna,
        ciudad: row.ciudad,
        email: row.email,
    };
}

/** Crea o reemplaza los datos de factura del cliente. */
export async function saveCustomerInvoice(customerId: string, invoice: InvoiceInput): Promise<void> {
    const updatedAt = new Date().toISOString();
    await db.insert(customerInvoiceData)
        .values({ customerId, ...invoice, updatedAt })
        .onConflictDoUpdate({
            target: customerInvoiceData.customerId,
            set: { ...invoice, updatedAt },
        });
}

export async function deleteCustomerInvoice(customerId: string): Promise<void> {
    await db.delete(customerInvoiceData).where(eq(customerInvoiceData.customerId, customerId));
}
