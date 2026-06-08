// Configuración de campos de inscripción para sorteos de temporada (type "in_store").
// El admin elige qué campos debe completar el cliente al inscribirse. Compartido entre
// el formulario admin, la página pública y la API de inscripción para mantener una sola
// fuente de verdad. Un campo marcado (true) se muestra y es obligatorio.

export type RaffleEntryFieldKey =
    | "name"
    | "phone"
    | "rut"
    | "email"
    | "receiptNumber"
    | "address";

export interface RaffleEntryFields {
    name: boolean;
    phone: boolean;
    rut: boolean;
    email: boolean;
    receiptNumber: boolean;
    address: boolean;
}

// Orden y etiquetas para la UI (admin + público).
export const RAFFLE_ENTRY_FIELD_META: {
    key: RaffleEntryFieldKey;
    label: string;
    hint?: string;
}[] = [
    { key: "name", label: "Nombre completo" },
    { key: "phone", label: "Celular" },
    { key: "rut", label: "RUT" },
    { key: "email", label: "Correo electrónico" },
    { key: "receiptNumber", label: "N° de boleta", hint: "La que entregas en el local" },
    { key: "address", label: "Dirección" },
];

// Por defecto pedimos lo mínimo para participar: nombre, celular y N° de boleta.
export const DEFAULT_RAFFLE_ENTRY_FIELDS: RaffleEntryFields = {
    name: true,
    phone: true,
    rut: false,
    email: false,
    receiptNumber: true,
    address: false,
};

/** Normaliza la config guardada (JSON string o ya objeto) a un RaffleEntryFields completo. */
export function parseEntryFields(raw: unknown): RaffleEntryFields {
    if (!raw) return { ...DEFAULT_RAFFLE_ENTRY_FIELDS };
    try {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (!parsed || typeof parsed !== "object") return { ...DEFAULT_RAFFLE_ENTRY_FIELDS };
        const p = parsed as Record<string, unknown>;
        return {
            name: !!p.name,
            phone: !!p.phone,
            rut: !!p.rut,
            email: !!p.email,
            receiptNumber: !!p.receiptNumber,
            address: !!p.address,
        };
    } catch {
        return { ...DEFAULT_RAFFLE_ENTRY_FIELDS };
    }
}
