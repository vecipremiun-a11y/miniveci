import { db } from "@/lib/db";
import { storeConfig } from "@/lib/db/schema";

/**
 * Condiciones de envío de la tienda.
 *
 * Antes el costo de envío estaba escrito a mano en tres archivos (el checkout
 * web, el recálculo server-side y el flujo móvil). Ahora vive en la tabla
 * `store_config` y todos leen de acá, para que cambiarlo desde el admin valga
 * para los tres.
 *
 * La autoridad del cálculo es siempre el servidor: el navegador usa esto solo
 * para mostrar, y al crear el pedido se vuelve a calcular con `resolveShippingCost`.
 */

export interface StoreDeliveryConfig {
    /** Costo de envío a domicilio en CLP. */
    deliveryFee: number;
    /**
     * Monto de compra desde el cual el envío sale gratis.
     * 0 = desactivado (siempre se cobra el envío).
     */
    freeDeliveryThreshold: number;
}

export const DEFAULT_STORE_DELIVERY_CONFIG: StoreDeliveryConfig = {
    deliveryFee: 1990,
    freeDeliveryThreshold: 0,
};

export const STORE_CONFIG_KEYS = {
    deliveryFee: "delivery_fee",
    freeDeliveryThreshold: "free_delivery_threshold",
} as const;

function toInt(value: string | undefined, fallback: number): number {
    if (value == null) return fallback;
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Lee las condiciones de envío. Si la tabla todavía no existe (base sin migrar)
 * devuelve los valores por defecto en vez de romper el checkout.
 */
export async function loadStoreDeliveryConfig(): Promise<StoreDeliveryConfig> {
    try {
        const rows = await db.select().from(storeConfig);
        const map = new Map(rows.map(r => [r.key, r.value]));
        return {
            deliveryFee: toInt(map.get(STORE_CONFIG_KEYS.deliveryFee), DEFAULT_STORE_DELIVERY_CONFIG.deliveryFee),
            freeDeliveryThreshold: toInt(
                map.get(STORE_CONFIG_KEYS.freeDeliveryThreshold),
                DEFAULT_STORE_DELIVERY_CONFIG.freeDeliveryThreshold,
            ),
        };
    } catch (error) {
        console.error("[STORE_CONFIG_LOAD]", error);
        return { ...DEFAULT_STORE_DELIVERY_CONFIG };
    }
}

export function isDeliveryType(deliveryType: string | null | undefined): boolean {
    return deliveryType === "delivery";
}

/**
 * Costo de envío final.
 *
 * `payableSubtotal` es lo que la persona paga en productos, es decir el
 * subtotal ya con los descuentos aplicados: si un cupón la deja bajo el
 * umbral, el envío se cobra. Retiro en tienda nunca paga envío.
 */
export function resolveShippingCost(params: {
    deliveryType: string | null | undefined;
    payableSubtotal: number;
    config: StoreDeliveryConfig;
}): number {
    const { deliveryType, payableSubtotal, config } = params;
    if (!isDeliveryType(deliveryType)) return 0;
    if (config.freeDeliveryThreshold > 0 && payableSubtotal >= config.freeDeliveryThreshold) return 0;
    return config.deliveryFee;
}

/**
 * Cuánto le falta a esta compra para llegar al envío gratis.
 * 0 = ya lo alcanzó, o la promoción está apagada.
 */
export function missingForFreeDelivery(payableSubtotal: number, config: StoreDeliveryConfig): number {
    if (config.freeDeliveryThreshold <= 0) return 0;
    return Math.max(0, config.freeDeliveryThreshold - payableSubtotal);
}
