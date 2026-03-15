export interface StoreProductCategory {
    id: string;
    name: string;
    slug: string;
}

export interface StoreProductImage {
    id: string;
    url: string;
    altText?: string | null;
    isPrimary: boolean;
}

export interface PriceTier {
    minQty: number;
    maxQty: number | null;
    price: number;
}

export interface StoreProductPayload {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    price: number;
    offerPrice: number | null;
    isOffer: boolean;
    stock: number;
    unit: string;
    equivLabel: string | null;
    equivWeight: number | null;
    category: StoreProductCategory | null;
    images: StoreProductImage[];
    badges: string[] | null;
    tags: string[] | null;
    priceTiers: PriceTier[];
}

export type StoreProductField = keyof StoreProductPayload;

export interface ProductChangeEventPayload {
    type: 'upsert' | 'delete';
    productId: string;
    slug: string | null;
    product: StoreProductPayload | null;
    changes?: Partial<StoreProductPayload> | null;
    changedFields?: StoreProductField[];
    occurredAt: string;
    reason?: string;
}
