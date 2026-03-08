export type ProductInput = {
    webPrice?: number | null;
    webStock?: number | null;
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

export type ResolvedProduct = ProductInput & {
    resolved_price: number;
    resolved_stock: number;
    price_source_label: string;
    stock_source_label: string;
    is_available: boolean;
};

export function resolveProductPrice(
    product: ProductInput,
    category?: CategoryInput | null
): { price: number; label: string } {
    const source = product.priceSource || "global";

    if (source === "manual") {
        return { price: product.webPrice ?? 0, label: "Manual" };
    }

    if (source === "pos") {
        return { price: product.webPrice ?? 0, label: "Manual" };
    }

    // "global" fallback logic
    const catSource = category?.syncPriceSource || "global";

    if (catSource === "manual") {
        return { price: product.webPrice ?? 0, label: "Manual (Categoría)" };
    }

    if (catSource === "pos") {
        return { price: product.webPrice ?? 0, label: "Manual (Categoría)" };
    }

    return { price: product.webPrice ?? 0, label: "Manual (Global)" };
}

export function resolveProductStock(
    product: ProductInput,
    category?: CategoryInput | null
): { stock: number; label: string } {
    const source = product.stockSource || "global";

    if (source === "manual") {
        return { stock: product.webStock ?? 0, label: "Manual" };
    }

    if (source === "pos") {
        return { stock: product.webStock ?? 0, label: "Manual" };
    }

    if (source === "reserved") {
        const web = product.webStock ?? 0;
        const reserved = product.reservedQty ?? 0;
        const calculated = Math.max(0, web - reserved);
        return { stock: calculated, label: "Web - Reservas" };
    }

    // "global" fallback logic
    const catSource = category?.syncStockSource || "global";

    if (catSource === "manual") {
        return { stock: product.webStock ?? 0, label: "Manual (Categoría)" };
    }

    if (catSource === "pos") {
        return { stock: product.webStock ?? 0, label: "Manual (Categoría)" };
    }

    if (catSource === "reserved") {
        const web = product.webStock ?? 0;
        const reserved = product.reservedQty ?? 0;
        const calculated = Math.max(0, web - reserved);
        return { stock: calculated, label: "Web - Reservas (Categoría)" };
    }

    return { stock: product.webStock ?? 0, label: "Manual (Global)" };
}

export function resolveProduct(
    product: ProductInput,
    category?: CategoryInput | null
): ResolvedProduct {
    const { price, label: priceLabel } = resolveProductPrice(product, category);
    const { stock, label: stockLabel } = resolveProductStock(product, category);

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
