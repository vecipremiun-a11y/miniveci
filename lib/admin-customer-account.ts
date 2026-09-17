/**
 * La cuenta de cliente de un admin/owner.
 *
 * El rol y la identidad de compra son cosas distintas:
 *   - `users.role` dice qué puede administrar (panel, pedidos, catálogo…).
 *   - `users.customer_id` dice a qué cuenta de tienda se le cuelgan sus pedidos,
 *     direcciones y membresía cuando compra como un cliente más.
 *
 * Con un solo login se usan las dos: entrás con tu cuenta del panel y comprás
 * con tu propia cuenta de cliente, sin tener que registrarte aparte.
 *
 * Lo que esto NO hace: dar beneficios. Ser owner no te hace suscriptor — para
 * eso hay que comprar la membresía igual que cualquiera, porque la suscripción
 * se chequea contra la tabla `subscriptions` y no contra el rol (ver
 * lib/subscriptions.ts).
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, customers } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth-utils";

/** Parte un "Kevin Chero" en nombre y apellido para la fila de `customers`. */
function splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: "Cliente", lastName: "" };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/**
 * Devuelve el `customers.id` del admin, creándolo o enlazándolo la primera vez.
 *
 * Orden:
 *   1. `users.customer_id` si ya está resuelto (el caso normal, sin escrituras).
 *   2. Un `customers` con el mismo email — es la misma persona que ya compraba
 *      antes de ser admin; se enlaza en vez de duplicarla.
 *   3. Si no hay ninguno, se crea la cuenta de cliente.
 *
 * Best-effort: si algo falla devuelve null y el admin simplemente no puede
 * comprar en esa request. Nunca lanza, porque corre dentro del login.
 */
export async function resolveAdminCustomerId(
    userId: string,
    email: string,
    name: string,
): Promise<string | null> {
    try {
        const admin = await db.query.users.findFirst({
            where: eq(users.id, userId),
            columns: { customerId: true },
        });
        if (admin?.customerId) {
            // Verificar que la fila siga existiendo: si el cliente fue borrado,
            // el enlace quedó colgando y hay que rehacerlo.
            const still = await db.query.customers.findFirst({
                where: eq(customers.id, admin.customerId),
                columns: { id: true },
            });
            if (still) return admin.customerId;
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existing = await db.query.customers.findFirst({
            where: eq(customers.email, normalizedEmail),
            columns: { id: true },
        });

        let customerId = existing?.id ?? null;

        if (!customerId) {
            const { firstName, lastName } = splitName(name || normalizedEmail);
            customerId = crypto.randomUUID();
            await db.insert(customers).values({
                id: customerId,
                email: normalizedEmail,
                // Esta cuenta no se usa para entrar: el login va contra `users`.
                // Igual va un hash real y no una constante, para que nadie pueda
                // autenticarse contra ella adivinando el valor.
                passwordHash: await hashPassword(crypto.randomUUID()),
                firstName,
                lastName,
                phone: "", // lo completa el checkout (persistCheckoutProfile)
                active: true,
            });
            console.log(`[ADMIN_CUSTOMER] cuenta de cliente creada para admin ${userId}`);
        }

        await db.update(users).set({ customerId }).where(eq(users.id, userId));
        return customerId;
    } catch (err) {
        console.error(`[ADMIN_CUSTOMER] no se pudo resolver la cuenta de cliente de ${userId}:`, (err as Error).message);
        return null;
    }
}
