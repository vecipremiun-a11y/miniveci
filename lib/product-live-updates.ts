import { EventEmitter } from "node:events";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPublicStoreProductById } from "@/lib/store-public-products";
import type { ProductChangeEventPayload, StoreProductField, StoreProductPayload } from "@/lib/store-product-types";

const PRODUCT_CHANGE_EVENT = "product-change";

declare global {
    // eslint-disable-next-line no-var
    var __productLiveUpdatesEmitter: EventEmitter | undefined;
}

function getEmitter() {
    if (!globalThis.__productLiveUpdatesEmitter) {
        globalThis.__productLiveUpdatesEmitter = new EventEmitter();
        globalThis.__productLiveUpdatesEmitter.setMaxListeners(200);
    }

    return globalThis.__productLiveUpdatesEmitter;
}

export function subscribeToProductChanges(listener: (event: ProductChangeEventPayload) => void) {
    const emitter = getEmitter();
    emitter.on(PRODUCT_CHANGE_EVENT, listener);

    return () => {
        emitter.off(PRODUCT_CHANGE_EVENT, listener);
    };
}

export function publishProductChange(event: ProductChangeEventPayload) {
    getEmitter().emit(PRODUCT_CHANGE_EVENT, event);
}

function buildProductChanges(product: StoreProductPayload, changedFields?: StoreProductField[]) {
    if (!changedFields || changedFields.length === 0) {
        return undefined;
    }

    return changedFields.reduce<Partial<StoreProductPayload>>((acc, field) => {
        (acc as any)[field] = product[field];
        return acc;
    }, {});
}

async function getProductSlug(productId: string) {
    const product = await db.query.products.findFirst({
        where: eq(products.id, productId),
        columns: {
            slug: true,
        },
    });

    return product?.slug ?? null;
}

export async function emitProductChange(productId: string, options?: { slug?: string | null; reason?: string; changedFields?: StoreProductField[] }) {
    const product = await getPublicStoreProductById(productId);

    if (product) {
        publishProductChange({
            type: "upsert",
            productId,
            slug: product.slug,
            product,
            changes: buildProductChanges(product, options?.changedFields),
            changedFields: options?.changedFields,
            occurredAt: new Date().toISOString(),
            reason: options?.reason,
        });
        return;
    }

    publishProductChange({
        type: "delete",
        productId,
        slug: options?.slug ?? await getProductSlug(productId),
        product: null,
        changes: null,
        changedFields: options?.changedFields,
        occurredAt: new Date().toISOString(),
        reason: options?.reason,
    });
}

export function emitProductDeletion(productId: string, slug?: string | null, reason?: string) {
    publishProductChange({
        type: "delete",
        productId,
        slug: slug ?? null,
        product: null,
        changes: null,
        changedFields: undefined,
        occurredAt: new Date().toISOString(),
        reason,
    });
}
