/**
 * Estado de la membresía de un cliente.
 *
 * La suscripción NO es un rol: un suscriptor sigue siendo `role: "customer"`.
 * Lo que lo hace suscriptor es tener una fila activa en `subscriptions`. Por eso
 * la única forma de ser suscriptor es comprando la membresía — ni un admin ni un
 * owner heredan el beneficio por su rol.
 */
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";

/**
 * ¿Este cliente tiene la membresía activa AHORA?
 *
 * Exige estado `active` **y** que `endDate` no haya pasado. El estado por sí
 * solo no alcanza: las suscripciones vencidas recién se marcan "expired" cuando
 * el cliente entra a su página de membresía (`/api/store/customer/subscription`),
 * así que una membresía vencida puede seguir figurando como "active" en la tabla
 * durante semanas. Mirar solo el estado le daría precio de suscriptor a alguien
 * que ya dejó de pagar.
 *
 * `endDate` se guarda con `toISOString()` (ver el webhook de MercadoPago), así
 * que la comparación de texto ordena igual que la de fechas.
 */
export async function hasActiveSubscription(customerId: string | null | undefined): Promise<boolean> {
    if (!customerId) return false;

    const rows = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(and(
            eq(subscriptions.customerId, customerId),
            eq(subscriptions.status, "active"),
            gte(subscriptions.endDate, new Date().toISOString()),
        ))
        .limit(1);

    return rows.length > 0;
}
