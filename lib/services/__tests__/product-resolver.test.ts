import { describe, it, expect } from "vitest";
import { resolveProductPrice, resolveProductStock, resolveProduct, ProductInput, CategoryInput, PosConfigInput } from "../product-resolver";

describe("Product Resolver Logic", () => {

    const baseProduct: ProductInput = {
        webPrice: 1000,
        posPrice: 1500,
        webStock: 10,
        posStock: 20,
        reservedQty: 5,
        priceSource: "global",
        stockSource: "global",
        isPublished: true,
    };

    const baseConfig: PosConfigInput = {
        syncPrices: false,
        syncStock: false,
    };

    describe("resolveProductPrice", () => {
        it("should use web price if product overrides to manual", () => {
            const product = { ...baseProduct, priceSource: "manual" };
            const result = resolveProductPrice(product, null, baseConfig);
            expect(result.price).toBe(1000);
            expect(result.label).toBe("Manual");
        });

        it("should use pos price if product overrides to pos", () => {
            const product = { ...baseProduct, priceSource: "pos" };
            const result = resolveProductPrice(product, null, baseConfig);
            expect(result.price).toBe(1500);
            expect(result.label).toBe("POS");
        });

        it("should use web price if global cascade hits category manual", () => {
            const category: CategoryInput = { syncPriceSource: "manual" };
            const result = resolveProductPrice(baseProduct, category, baseConfig);
            expect(result.price).toBe(1000);
            expect(result.label).toBe("Manual (Categoría)");
        });

        it("should use pos price if global cascade hits pos setting", () => {
            const config = { syncPrices: true };
            const result = resolveProductPrice(baseProduct, null, config);
            expect(result.price).toBe(1500);
            expect(result.label).toBe("POS (Global)");
        });
    });

    describe("resolveProductStock", () => {
        it("should use manual stock if product overrides", () => {
            const product = { ...baseProduct, stockSource: "manual" };
            const result = resolveProductStock(product, null, baseConfig);
            expect(result.stock).toBe(10);
            expect(result.label).toBe("Manual");
        });

        it("should use pos stock if product overrides", () => {
            const product = { ...baseProduct, stockSource: "pos" };
            const result = resolveProductStock(product, null, baseConfig);
            expect(result.stock).toBe(20);
            expect(result.label).toBe("POS");
        });

        it("should calculate reserved stock", () => {
            const product = { ...baseProduct, stockSource: "reserved" };
            const result = resolveProductStock(product, null, baseConfig);
            expect(result.stock).toBe(15); // 20 posStock - 5 reserved
            expect(result.label).toBe("POS - Reservas");
        });

        it("should not drop below zero in reserved calculations", () => {
            const product = { ...baseProduct, stockSource: "reserved", posStock: 3, reservedQty: 5 };
            const result = resolveProductStock(product, null, baseConfig);
            expect(result.stock).toBe(0);
        });

        it("should fallback to global config if category is global", () => {
            const category = { syncStockSource: "global" };
            const config = { syncStock: true };
            const result = resolveProductStock(baseProduct, category, config);
            expect(result.stock).toBe(20);
            expect(result.label).toBe("POS (Global)");
        });
    });

    describe("resolveProduct wrapper", () => {
        it("should package everything properly", () => {
            const product = { ...baseProduct, priceSource: "manual", stockSource: "pos" };
            const result = resolveProduct(product, null, baseConfig);

            expect(result.resolved_price).toBe(1000);
            expect(result.price_source_label).toBe("Manual");
            expect(result.resolved_stock).toBe(20);
            expect(result.stock_source_label).toBe("POS");
            expect(result.is_available).toBe(true);
        });

        it("should return false for is_available if out of stock", () => {
            const product = { ...baseProduct, stockSource: "manual", webStock: 0 };
            const result = resolveProduct(product, null, baseConfig);
            expect(result.is_available).toBe(false);
        });

        it("should return false for is_available if unpublished", () => {
            const product = { ...baseProduct, stockSource: "manual", webStock: 10, isPublished: false };
            const result = resolveProduct(product, null, baseConfig);
            expect(result.is_available).toBe(false);
        });
    });

});
