import type { StoreProductField } from "@/lib/store-product-types";

const mutationKeyMap: Record<string, StoreProductField[]> = {
    name: ["name"],
    slug: ["slug"],
    description: ["description"],
    webDescription: ["description"],
    seoTitle: ["seoTitle"],
    seoDescription: ["seoDescription"],
    categoryId: ["category"],
    badges: ["badges"],
    tags: ["tags"],
    webPrice: ["price"],
    priceSource: ["price"],
    webStock: ["stock"],
    stockSource: ["stock"],
    reservedQty: ["stock"],
    unit: ["unit"],
};

export function mapMutationKeysToStoreFields(keys: string[]): StoreProductField[] {
    const fields = new Set<StoreProductField>();

    for (const key of keys) {
        const mapped = mutationKeyMap[key];
        if (!mapped) continue;
        for (const field of mapped) {
            fields.add(field);
        }
    }

    return Array.from(fields);
}
