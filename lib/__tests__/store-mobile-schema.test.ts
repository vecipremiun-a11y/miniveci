import { describe, expect, it } from "vitest";
import { storeMobileOrderSchema } from "../validations/store-mobile";

const base = {
    items: [{ productId: "p1", quantity: 1 }],
    method: "pickup" as const,
    phone: "+56912345678",
};
const RECEIPT = "https://abc123.public.blob.vercel-storage.com/receipts/u1/x.jpg";

describe("storeMobileOrderSchema", () => {
    it("sigue aceptando el contrato viejo (cash / mercado_pago sin factura)", () => {
        expect(storeMobileOrderSchema.safeParse({ ...base, paymentMethod: "cash" }).success).toBe(true);
        expect(storeMobileOrderSchema.safeParse({ ...base, paymentMethod: "mercado_pago" }).success).toBe(true);
    });

    it("transferencia exige un comprobante subido por upload-receipt", () => {
        expect(storeMobileOrderSchema.safeParse({ ...base, paymentMethod: "transferencia" }).success).toBe(false);
        expect(storeMobileOrderSchema.safeParse({ ...base, paymentMethod: "transferencia", receiptUrl: "https://evil.com/x.jpg" }).success).toBe(false);
        expect(storeMobileOrderSchema.safeParse({ ...base, paymentMethod: "transferencia", receiptUrl: RECEIPT }).success).toBe(true);
    });

    it("valida y normaliza la factura", () => {
        const ok = storeMobileOrderSchema.parse({
            ...base, paymentMethod: "cash", invoice: { rut: "760864285", razonSocial: "Comercial Veci SpA" },
        });
        expect(ok.invoice?.rut).toBe("76.086.428-5");
        expect(storeMobileOrderSchema.safeParse({
            ...base, paymentMethod: "cash", invoice: { rut: "76.086.428-1", razonSocial: "X" },
        }).success).toBe(false);
    });
});
