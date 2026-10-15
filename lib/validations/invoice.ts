import { z } from "zod";
import { formatRut, isValidRut } from "../rut";

/** Texto opcional: vacío → null. */
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable()
    .transform((v) => v || null);

/**
 * "Quiero factura" del checkout. RUT y razón social son obligatorios (sin ellos
 * POSVECI hace boleta); el resto es opcional. El RUT se guarda formateado.
 */
export const invoiceInputSchema = z.object({
    rut: z.string().trim()
        .refine(isValidRut, "El RUT de la factura no es válido")
        .transform(formatRut),
    razonSocial: z.string().trim().min(1, "Ingresa la razón social de la factura").max(150),
    giro: optionalText(120),
    direccion: optionalText(200),
    comuna: optionalText(80),
    ciudad: optionalText(80),
    email: z.union([z.literal(""), z.email("El correo de la factura no es válido").max(254)])
        .optional().nullable()
        .transform((v) => v?.toLowerCase() || null),
});

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

/** `invoice` del body del checkout (cualquier medio de pago): ausente o null = boleta. */
export function parseCheckoutInvoice(raw: unknown):
    | { ok: true; invoice: InvoiceInput | null }
    | { ok: false; error: string } {
    if (!raw) return { ok: true, invoice: null };
    const parsed = invoiceInputSchema.safeParse(raw);
    return parsed.success
        ? { ok: true, invoice: parsed.data }
        : { ok: false, error: parsed.error.issues[0]?.message || "Datos de factura inválidos" };
}
