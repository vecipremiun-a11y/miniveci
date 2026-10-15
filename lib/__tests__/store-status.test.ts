import { describe, expect, it } from "vitest";
import { isConfirmedTransfer } from "../store-status";

describe("isConfirmedTransfer", () => {
    it("bloquea la transferencia que el local ya confirmó", () => {
        expect(isConfirmedTransfer({ paymentMethod: "transferencia", paymentStatus: "paid" })).toBe(true);
    });

    it("deja cancelar la transferencia que aún espera confirmación", () => {
        expect(isConfirmedTransfer({ paymentMethod: "transferencia", paymentStatus: "pending" })).toBe(false);
    });

    it("no aplica a otros medios de pago", () => {
        expect(isConfirmedTransfer({ paymentMethod: "mercadopago", paymentStatus: "paid" })).toBe(false);
        expect(isConfirmedTransfer({ paymentMethod: "contrarembolso", paymentStatus: "paid" })).toBe(false);
        expect(isConfirmedTransfer({ paymentMethod: null, paymentStatus: null })).toBe(false);
    });
});
