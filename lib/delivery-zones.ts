/**
 * Tarifas de envío por comuna.
 *
 * El costo base (`delivery_fee`) vale para Iquique y cualquier dirección que no
 * calce con una zona; cada zona (ej. Alto Hospicio) tiene su propio costo. El
 * envío gratis sobre un monto sigue siendo uno solo para todas.
 *
 * Sin dependencias de servidor: el checkout lo usa para mostrar el envío y el
 * servidor para cobrarlo, con la misma regla.
 */

export interface DeliveryZoneFee {
    /** Nombre de la comuna tal como se muestra, ej. "Alto Hospicio". */
    comuna: string;
    /** Costo de envío en CLP para esa comuna. */
    fee: number;
}

/** Mientras el admin no guarde zonas, Alto Hospicio va con su tarifa. */
export const DEFAULT_DELIVERY_ZONE_FEES: DeliveryZoneFee[] = [{ comuna: "Alto Hospicio", fee: 3000 }];

export const MAX_DELIVERY_ZONES = 20;

export interface DeliveryDestination {
    comuna?: string | null;
    city?: string | null;
    address?: string | null;
}

/** "Alto  Hospicio," → "alto hospicio": sin tildes, mayúsculas ni signos. */
export function normalizePlace(value: string | null | undefined): string {
    return (value ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function mentions(text: string | null | undefined, zone: DeliveryZoneFee): boolean {
    const name = normalizePlace(zone.comuna);
    return name !== "" && ` ${normalizePlace(text)} `.includes(` ${name} `);
}

/**
 * Zona que le toca a la dirección, o null si va con la tarifa base.
 *
 * La comuna elegida manda: si dice "Iquique", es Iquique aunque la calle se
 * llame "Alto Hospicio". Sin comuna (la app móvil o una dirección tipeada a
 * mano) se busca la zona en la ciudad y después en el texto de la dirección.
 */
export function findDeliveryZone(zones: DeliveryZoneFee[], destination: DeliveryDestination): DeliveryZoneFee | null {
    if (normalizePlace(destination.comuna)) {
        return zones.find(z => mentions(destination.comuna, z)) ?? null;
    }
    return zones.find(z => mentions(destination.city, z))
        ?? zones.find(z => mentions(destination.address, z))
        ?? null;
}

export function deliveryFeeFor(baseFee: number, zones: DeliveryZoneFee[], destination: DeliveryDestination): number {
    return findDeliveryZone(zones, destination)?.fee ?? baseFee;
}

/**
 * Lee las zonas guardadas en `store_config` (JSON). Descarta las entradas
 * inválidas y las comunas repetidas (queda la primera). null = nunca se guardó
 * nada, y el que llama decide el valor por defecto.
 */
export function parseDeliveryZoneFees(raw: string | null | undefined): DeliveryZoneFee[] | null {
    if (raw == null) return null;
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!Array.isArray(data)) return null;

    const seen = new Set<string>();
    const zones: DeliveryZoneFee[] = [];
    for (const item of data) {
        const comuna = typeof item?.comuna === "string" ? item.comuna.trim() : "";
        const fee = Number(item?.fee);
        const key = normalizePlace(comuna);
        if (!key || seen.has(key) || !Number.isInteger(fee) || fee < 0) continue;
        seen.add(key);
        zones.push({ comuna, fee });
        if (zones.length >= MAX_DELIVERY_ZONES) break;
    }
    return zones;
}
