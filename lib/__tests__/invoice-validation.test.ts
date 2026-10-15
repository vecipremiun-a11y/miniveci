import { describe, expect, it } from "vitest";
import { invoiceInputSchema } from "../validations/invoice";

describe("invoiceInputSchema", () => {
    it("acepta RUT y razón social, formatea el RUT y vacía los opcionales", () => {
        const r = invoiceInputSchema.parse({
            rut: "760864285", razonSocial: "  Comercial Veci SpA ", giro: "", direccion: "", comuna: "", ciudad: "", email: "",
        });
        expect(r).toEqual({
            rut: "76.086.428-5", razonSocial: "Comercial Veci SpA",
            giro: null, direccion: null, comuna: null, ciudad: null, email: null,
        });
    });

    it("guarda los opcionales que vienen", () => {
        const r = invoiceInputSchema.parse({
            rut: "76.086.428-5", razonSocial: "Comercial Veci SpA", giro: "Almacén",
            direccion: "Sotomayor 1460", comuna: "Iquique", ciudad: "Iquique", email: "Pagos@Veci.cl",
        });
        expect(r.giro).toBe("Almacén");
        expect(r.email).toBe("pagos@veci.cl");
    });

    it("exige RUT válido y razón social", () => {
        expect(invoiceInputSchema.safeParse({ rut: "76.086.428-1", razonSocial: "X" }).success).toBe(false);
        expect(invoiceInputSchema.safeParse({ rut: "76.086.428-5", razonSocial: "  " }).success).toBe(false);
        expect(invoiceInputSchema.safeParse({ razonSocial: "X" }).success).toBe(false);
    });

    it("rechaza un correo mal escrito", () => {
        expect(invoiceInputSchema.safeParse({ rut: "76.086.428-5", razonSocial: "X", email: "no-es-correo" }).success).toBe(false);
    });
});
