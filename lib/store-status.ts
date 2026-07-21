/**
 * Máquina de estados de pedidos de Tienda (tabla `orders`).
 *
 * Antes vivía inline en /api/admin/orders/[id]/status; se extrajo aquí para
 * compartirla con el callback de POSVECI (/api/pos/bakery/orders/[id]/status),
 * que ahora también mueve pedidos de tienda.
 *
 * `confirmed` se agregó con la integración POSVECI-tienda: es el "Confirmado"
 * que marca el POS al aceptar el pedido (distinto de `paid`, que refleja pago).
 */

export const STORE_VALID_TRANSITIONS: Record<string, string[]> = {
    "new": ["confirmed", "paid", "preparing", "cancelled"],
    "confirmed": ["paid", "preparing", "cancelled"],
    "paid": ["confirmed", "preparing", "cancelled", "refunded"],
    "preparing": ["ready", "cancelled"],
    "ready": ["shipped", "delivered", "cancelled"],
    "shipped": ["delivered", "cancelled", "refunded"],
    "delivered": ["refunded"],
    "cancelled": [],
    "refunded": [],
};

/** Estados en los que el pedido está "activo" (stock web ya descontado). */
export const STORE_ACTIVE_STATES = ["confirmed", "paid", "preparing", "ready", "shipped", "delivered"];

export function canStoreTransition(from: string, to: string): boolean {
    return STORE_VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Mapea el estado que envía POSVECI (vocabulario de encargos) al estado de
 * pedidos de tienda. `out_for_delivery` no existe en tienda → `shipped`.
 */
export function mapPosStatusToStore(posStatus: string): string | null {
    switch (posStatus) {
        case "pending": return "new";
        case "confirmed": return "confirmed";
        case "preparing": return "preparing";
        case "ready": return "ready";
        case "out_for_delivery": return "shipped";
        case "delivered": return "delivered";
        case "cancelled": return "cancelled";
        default: return null;
    }
}
