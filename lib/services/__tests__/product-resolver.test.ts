import { describe, it, expect } from "vitest";
import { resolveProductPrice, resolveProductStock, resolveProduct, ProductInput, CategoryInput } from "../product-resolver";

describe("Product Resolver Logic", () => {

    const baseProduct: ProductInput = {
        webPrice: 1000,
        webStock: 10,
        reservedQty: 5,
        priceSource: "global",
        stockSource: "global",
        isPublished: true,
    };

    describe("resolveProductPrice", () => {
        it("should use web price if product overrides to manual", () => {
            const product = { ...baseProduct, priceSource: "manual" };
            const result = resolveProductPrice(product, null);
            expect(result.price).toBe(1000);
            expect(result.label).toBe("Manual");
        });

        it("should fallback to web price if source is pos", () => {
            const product = { ...baseProduct, priceSource: "pos" };
            const result = resolveProductPrice(product, null);
            expect(result.price).toBe(1000);
            expect(result.label).toBe("Manual");
        });

        it("should use web price if global cascade hits category manual", () => {
            const category: CategoryInput = { syncPriceSource: "manual" };
            const result = resolveProductPrice(baseProduct, category);
            expect(result.price).toBe(1000);
            expect(result.label).toBe("Manual (Categoría)");
        });
    });

    describe("resolveProductStock", () => {
        it("should use manual stock if product overrides", () => {
            const product = { ...baseProduct, stockSource: "manual" };
            const result = resolveProductStock(product, null);
            expect(result.stock).toBe(10);
            expect(result.label).toBe("Manual");
        });

        it("should fallback to web stock if source is pos", () => {
            const product = { ...baseProduct, stockSource: "pos" };
            const result = resolveProductStock(product, null);
            expect(result.stock).toBe(10);
            expect(result.label).toBe("Manual");
        });

        it("should calculate reserved stock", () => {
            const product = { ...baseProduct, stockSource: "reserved" };
            const result = resolveProductStock(product, null);
            expect(result.stock).toBe(5); // 10 webStock - 5 reserved
            expect(result.label).toBe("Web - Reservas");
        });

        it("should not drop below zero in reserved calculations", () => {
            const product = { ...baseProduct, stockSource: "reserved", webStock: 3, reservedQty: 5 };
            const result = resolveProductStock(product, null);
            expect(result.stock).toBe(0);
        });
    });

    describe("resolveProduct wrapper", () => {
        it("should package everything properly", () => {
            const product = { ...baseProduct, priceSource: "manual", stockSource: "pos" };
            const result = resolveProduct(product, null);

            expect(result.resolved_price).toBe(1000);
            expect(result.price_source_label).toBe("Manual");
            expect(result.resolved_stock).toBe(10);
            expect(result.stock_source_label).toBe("Manual");
            expect(result.is_available).toBe(true);
        });

        it("should return false for is_available if out of stock", () => {
            const product = { ...baseProduct, stockSource: "manual", webStock: 0 };
            const result = resolveProduct(product, null);
            expect(result.is_available).toBe(false);
        });

        it("should return false for is_available if unpublished", () => {
            const product = { ...baseProduct, stockSource: "manual", webStock: 10, isPublished: false };
            const result = resolveProduct(product, null);
            expect(result.is_available).toBe(false);
        });
    });

});
