import { describe, expect, it } from "vitest";
import { isReceiptUrl } from "../payment-receipt";

describe("isReceiptUrl", () => {
    it("acepta un comprobante subido a nuestro blob", () => {
        expect(isReceiptUrl("https://abc123.public.blob.vercel-storage.com/receipts/guest/3f2a-x1Y2.jpg")).toBe(true);
        expect(isReceiptUrl("https://abc123.public.blob.vercel-storage.com/receipts/user-1/doc.pdf")).toBe(true);
    });

    it("rechaza enlaces de otros dominios o carpetas", () => {
        expect(isReceiptUrl("https://evil.example.com/receipts/x.jpg")).toBe(false);
        expect(isReceiptUrl("https://public.blob.vercel-storage.com.evil.com/receipts/x.jpg")).toBe(false);
        expect(isReceiptUrl("https://abc123.public.blob.vercel-storage.com/chat/x.jpg")).toBe(false);
        expect(isReceiptUrl("http://abc123.public.blob.vercel-storage.com/receipts/x.jpg")).toBe(false);
    });

    it("rechaza lo que no es una URL", () => {
        expect(isReceiptUrl("confirmed")).toBe(false);
        expect(isReceiptUrl("")).toBe(false);
        expect(isReceiptUrl(null)).toBe(false);
        expect(isReceiptUrl(undefined)).toBe(false);
    });
});
