export type ProductInput = {
    webPrice?: number | null;
    posPrice?: number | null;
    webStock?: number | null;
    posStock?: number | null;
    priceSource?: string | null;
    stockSource?: string | null;
    reservedQty?: number | null;
    isPublished?: boolean | null;
    [key: string]: any;
};

export type CategoryInput = {
    syncPriceSource?: string | null;
    syncStockSource?: string | null;
    [key: string]: any;
};

export type PosConfigInput = {
    syncPrices?: boolean | null;
    syncStock?: boolean | null;
    [key: string]: any;
};

export type ResolvedProduct = ProductInput & {
    resolved_price: number;
    resolved_stock: number;
    price_source_label: string;
    stock_source_label: string;
    is_available: boolean;
};

export function resolveProductPrice(
    product: ProductInput,
    category?: CategoryInput | null,
    posConfig?: PosConfigInput | null
): { price: number; label: string } {
    const source = product.priceSource || "global";

    if (source === "manual") {
        return { price: product.webPrice ?? 0, label: "Manual" };
    }

    if (source === "pos") {
        // If POS price is null, fall back to web price
        if (product.posPrice != null) return { price: product.posPrice, label: "POS" };
        return { price: product.webPrice ?? 0, label: "Manual (fallback)" };
    }

    // "global" fallback logic
    const catSource = category?.syncPriceSource || "global";

    if (catSource === "manual") {
        return { price: product.webPrice ?? 0, label: "Manual (Categoría)" };
    }

    if (catSource === "pos") {
        if (product.posPrice != null) return { price: product.posPrice, label: "POS (Categoría)" };
        return { price: product.webPrice ?? 0, label: "Manual (fallback Categoría)" };
    }

    // fallback to global config
    const globalActive = posConfig?.syncPrices ?? false;
    if (globalActive) {
        // If POS price is null, fall back to web price
        if (product.posPrice != null) return { price: product.posPrice, label: "POS (Global)" };
        return { price: product.webPrice ?? 0, label: "Manual (fallback Global)" };
    }

    return { price: product.webPrice ?? 0, label: "Manual (Global)" };
}

export function resolveProductStock(
    product: ProductInput,
    category?: CategoryInput | null,
    posConfig?: PosConfigInput | null
): { stock: number; label: string } {
    const source = product.stockSource || "global";

    if (source === "manual") {
        return { stock: product.webStock ?? 0, label: "Manual" };
    }

    if (source === "pos") {
        if (product.posStock != null) return { stock: product.posStock, label: "POS" };
        return { stock: product.webStock ?? 0, label: "Manual (fallback)" };
    }

    if (source === "reserved") {
        const pos = product.posStock ?? 0;
        const reserved = product.reservedQty ?? 0;
        const calculated = Math.max(0, pos - reserved);
        return { stock: calculated, label: "POS - Reservas" };
    }

    // "global" fallback logic
    const catSource = category?.syncStockSource || "global";

    if (catSource === "manual") {
        return { stock: product.webStock ?? 0, label: "Manual (Categoría)" };
    }

    if (catSource === "pos") {
        if (product.posStock != null) return { stock: product.posStock, label: "POS (Categoría)" };
        return { stock: product.webStock ?? 0, label: "Manual (fallback Categoría)" };
    }

    if (catSource === "reserved") {
        const pos = product.posStock ?? 0;
        const reserved = product.reservedQty ?? 0;
        const calculated = Math.max(0, pos - reserved);
        return { stock: calculated, label: "POS - Reservas (Categoría)" };
    }

    // fallback to global config
    const globalActive = posConfig?.syncStock ?? false;
    if (globalActive) {
        if (product.posStock != null) return { stock: product.posStock, label: "POS (Global)" };
        return { stock: product.webStock ?? 0, label: "Manual (fallback Global)" };
    }

    return { stock: product.webStock ?? 0, label: "Manual (Global)" };
}

export function resolveProduct(
    product: ProductInput,
    category?: CategoryInput | null,
    posConfig?: PosConfigInput | null
): ResolvedProduct {
    const { price, label: priceLabel } = resolveProductPrice(product, category, posConfig);
    const { stock, label: stockLabel } = resolveProductStock(product, category, posConfig);

    const isAvailable = stock > 0 && !!product.isPublished;

    return {
        ...product,
        resolved_price: price,
        resolved_stock: stock,
        price_source_label: priceLabel,
        stock_source_label: stockLabel,
        is_available: isAvailable,
    };
}
