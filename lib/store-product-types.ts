import type { StorePresentation } from "@/lib/product-presentations";

export type { StorePresentation };

/**
 * Badge que prende el sello "Comercial Veci" (logo arriba a la izquierda de la
 * foto del producto). Se guarda en `products.badges` y se activa desde la ficha
 * del producto en el admin.
 */
export const COMERCIAL_VECI_BADGE = "comercial-veci";

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
    /** Fin programado de la oferta (ISO). null = sin oferta o la oferta no vence. */
    offerEndsAt: string | null;
    /**
     * Oferta por stock: unidades que quedan a precio oferta (kg en los de peso).
     * El carrito no deja pedir más que esto. null = sin oferta o sin límite.
     */
    offerStock: number | null;
    stock: number;
    unit: string;
    equivLabel: string | null;
    equivWeight: number | null;
    category: StoreProductCategory | null;
    images: StoreProductImage[];
    badges: string[] | null;
    tags: string[] | null;
    priceTiers: PriceTier[];
    /**
     * Grupo de escala. Los productos con el mismo grupo suman cantidad en el
     * carrito para la escala de precios. null = sin grupo.
     */
    tierGroup: string | null;
    /** Precio de socio. La API solo lo manda si quien mira es suscriptor. */
    subscriptionPrice?: number | null;
    /**
     * Unidades de medida a la venta (Caja de 30, Bandeja de 15…), de la más chica
     * a la más grande. Solo las activas y visibles, y solo en productos por
     * unidad; vacío si no hay. `price` es el de la presentación entera (fijo:
     * sin escala, oferta ni precio de socio). El stock sigue en unidades: está
     * agotada si `stock < units`. Ver lib/product-presentations.ts.
     */
    presentations?: StorePresentation[];
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
