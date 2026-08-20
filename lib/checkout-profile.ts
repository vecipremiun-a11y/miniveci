/**
 * Persiste en el perfil del cliente los datos que tipeó en el checkout, para que
 * el pedido siguiente salga precargado (nombre, teléfono, RUT y dirección).
 *
 * Reglas:
 *  - Identidad (nombre, apellido, teléfono, RUT): solo se rellenan los campos que
 *    están vacíos en el perfil. Nunca se pisa un dato que el cliente ya guardó en
 *    "Mi cuenta" — el checkout completa huecos, no reescribe el perfil.
 *  - Dirección de delivery: se guarda en la libreta (customer_addresses) y queda
 *    como predeterminada, así el checkout siguiente propone la última usada.
 *    Si no vino comuna (dirección escrita a mano) solo se guarda en los campos
 *    legacy del perfil, que sí aceptan comuna nula.
 *
 * Best-effort: cualquier error se loguea y se traga — nunca debe romper un pedido
 * ya creado. Pensado para llamarse dentro de `after()`.
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, customerAddresses } from "@/lib/db/schema";
import { rutTakenByOtherCustomer, syncCustomerToPosveci } from "@/lib/pos-customer-match";

export interface CheckoutProfileInput {
    customerId: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    rut?: string | null;
    /** "delivery" | "pickup" — en pickup no se guarda dirección. */
    deliveryType?: string | null;
    address?: string | null;
    comuna?: string | null;
    city?: string | null;
    addressNotes?: string | null;
}

/** Trim + null si queda vacío. */
function clean(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/** Comparación laxa de direcciones para no duplicar la misma calle en la libreta. */
function sameAddress(a: string, b: string): boolean {
    const norm = (s: string) =>
        s.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.,]/g, "");
    return norm(a) === norm(b);
}

export async function persistCheckoutProfile(input: CheckoutProfileInput): Promise<void> {
    try {
        const rows = await db
            .select({
                firstName: customers.firstName,
                lastName: customers.lastName,
                phone: customers.phone,
                rut: customers.rut,
                address: customers.address,
                comuna: customers.comuna,
                city: customers.city,
                addressNotes: customers.addressNotes,
            })
            .from(customers)
            .where(eq(customers.id, input.customerId))
            .limit(1);

        if (rows.length === 0) return;
        const current = rows[0];

        const isDelivery = (input.deliveryType || "delivery") !== "pickup";
        const address = isDelivery ? clean(input.address) : null;
        const comuna = isDelivery ? clean(input.comuna) : null;
        const city = isDelivery ? clean(input.city) : null;
        const addressNotes = isDelivery ? clean(input.addressNotes) : null;

        const update: Record<string, string | null> = {};
        const fillIfEmpty = (field: string, currentValue: string | null, newValue: string | null) => {
            if (newValue && !clean(currentValue)) update[field] = newValue;
        };

        fillIfEmpty("firstName", current.firstName, clean(input.firstName));
        fillIfEmpty("lastName", current.lastName, clean(input.lastName));
        fillIfEmpty("phone", current.phone, clean(input.phone));

        // RUT: único por tienda (misma regla que el registro y el PUT de perfil).
        const rut = clean(input.rut);
        if (rut && !clean(current.rut) && !(await rutTakenByOtherCustomer(rut, input.customerId))) {
            update.rut = rut;
        }

        // Dirección principal legacy: sirve de respaldo cuando no hay comuna.
        if (address && !clean(current.address)) {
            update.address = address;
            if (comuna) update.comuna = comuna;
            if (city) update.city = city;
            if (addressNotes) update.addressNotes = addressNotes;
        }

        if (Object.keys(update).length > 0) {
            update.updatedAt = new Date().toISOString();
            await db.update(customers).set(update).where(eq(customers.id, input.customerId));
            try {
                await syncCustomerToPosveci(input.customerId);
            } catch (err) {
                console.error(`[CHECKOUT_PROFILE] sync POSVECI falló para ${input.customerId}:`, (err as Error).message);
            }
        }

        // Libreta de direcciones: la última usada queda como predeterminada.
        if (!address || !comuna) return;

        const saved = await db
            .select()
            .from(customerAddresses)
            .where(eq(customerAddresses.customerId, input.customerId));

        const match = saved.find((a) => sameAddress(a.address, address) && sameAddress(a.comuna, comuna));

        await db
            .update(customerAddresses)
            .set({ isDefault: false })
            .where(eq(customerAddresses.customerId, input.customerId));

        if (match) {
            await db
                .update(customerAddresses)
                .set({
                    isDefault: true,
                    city: city || match.city,
                    addressNotes: addressNotes ?? match.addressNotes,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(customerAddresses.id, match.id));
            return;
        }

        await db.insert(customerAddresses).values({
            id: crypto.randomUUID(),
            customerId: input.customerId,
            label: saved.length === 0 ? "Casa" : `Dirección ${saved.length + 1}`,
            address,
            comuna,
            city: city || "Santiago",
            addressNotes,
            isDefault: true,
        });
    } catch (err) {
        console.error(`[CHECKOUT_PROFILE] falló para ${input.customerId}:`, (err as Error).message);
    }
}
