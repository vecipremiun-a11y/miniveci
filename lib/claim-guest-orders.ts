import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, orders } from "@/lib/db/schema";

/**
 * Vincula a la cuenta los pedidos de tienda que la persona hizo como invitada
 * (sin iniciar sesión) con su mismo correo.
 *
 * El correo se compara sin mayúsculas ni espacios: "Ana@x.cl" y "ana@x.cl" son
 * la misma casilla. Solo se hace con cuentas de correo VERIFICADO (hoy, las que
 * entran con Google): si no, cualquiera podría registrarse con un correo ajeno
 * y ver sus pedidos, con dirección y teléfono.
 *
 * Idempotente y barato: solo toca pedidos sin cliente. Devuelve los números de
 * pedido vinculados.
 */
export async function claimGuestStoreOrders(customerId: string): Promise<string[]> {
    const customer = await db.query.customers.findFirst({
        where: eq(customers.id, customerId),
        columns: { email: true, emailVerified: true },
    });
    if (!customer?.emailVerified) return [];

    const email = customer.email.trim().toLowerCase();
    if (!email) return [];

    const claimed = await db
        .update(orders)
        .set({ customerId, updatedAt: new Date().toISOString() })
        .where(and(
            isNull(orders.customerId),
            sql`lower(trim(${orders.customerEmail})) = ${email}`,
        ))
        .returning({ orderNumber: orders.orderNumber });

    const numbers = claimed.map((o) => o.orderNumber);
    if (numbers.length > 0) {
        console.log(`[CLAIM] customer ${customerId.slice(0, 8)}... vinculó ${numbers.length} pedido(s) de invitado: ${numbers.join(", ")}`);
    }
    return numbers;
}
