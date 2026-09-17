/**
 * Identidad de compra de la sesión web.
 *
 * Todo lo de `/api/store/customer/*` (pedidos, direcciones, favoritos, medios de
 * pago, membresía) cuelga de una fila de `customers`. Quién puede usar esos
 * endpoints no es una cuestión de rol sino de tener una cuenta de tienda:
 *
 *   - un cliente la tiene, y su `customerId` es su propio id;
 *   - un admin/owner también, en `users.customer_id`, así compra con el mismo
 *     login que usa para el panel (ver lib/admin-customer-account.ts);
 *   - una sesión sin cuenta de tienda no puede, y eso es un 401.
 *
 * Antes estos endpoints exigían `role === "customer"`, que dejaba afuera a los
 * admins aunque tuvieran cuenta. Peor: como el rol iba junto con usar
 * `session.user.id` de customerId, relajar el rol habría escrito el id de
 * `users` en columnas que apuntan a `customers`.
 */
import { auth } from "@/lib/auth";

/**
 * `customers.id` de quien está usando la sesión, o null si esta sesión no
 * compra (sin login, o un admin cuya cuenta de tienda no se pudo resolver).
 *
 * Es la ÚNICA forma válida de sacar el customerId en un handler: nunca usar
 * `session.user.id` para eso, y nunca aceptar un customerId del body.
 */
export async function getSessionCustomerId(): Promise<string | null> {
    const session = await auth();
    if (!session?.user?.id) return null;

    if (session.user.customerId) return session.user.customerId;

    // Sesión emitida antes de que el token llevara customerId. El JWT se
    // revalida solo cada pocos minutos (ver ROLE_REVALIDATE_MS en lib/auth.ts),
    // así que hasta entonces un cliente se apoya en que su id ES su customerId.
    if (session.user.role === "customer") return session.user.id;

    return null;
}
