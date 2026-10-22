'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { findPriceTier, tierGroupKey, tierQuantities } from '@/lib/product-price';
import { cartLineProductId, maxPresentationBoxes, type StorePresentation } from '@/lib/product-presentations';
import type { StoreProductPayload } from '@/lib/store-product-types';

/** Presentación de un renglón del carrito (Caja, Bandeja…). */
export type CartPresentation = StorePresentation;

/** Returns true for weight-based units (kg, lt) that use decimal quantities */
export function isWeightUnit(unit?: string | null): boolean {
    const u = (unit ?? '').toLowerCase();
    return u === 'kg' || u === 'lt';
}

/** Round to 2 decimal places to avoid floating point drift */
function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

export interface PriceTier {
    minQty: number;
    maxQty: number | null;
    price: number;
}

export interface CartItem {
    id: string;
    name: string;
    price: number;
    image?: string | null;
    slug?: string;
    unit?: string;
    equivLabel?: string | null;
    equivWeight?: number | null;
    quantity: number;
    priceTiers?: PriceTier[];
    /** Grupo de escala: los ítems del mismo grupo suman cantidad para el tramo. */
    tierGroup?: string | null;
    /** Precio de socio, solo presente si quien compra tiene la membresía activa. */
    subscriptionPrice?: number | null;
    /**
     * Oferta por stock: lo que queda a precio oferta, en la unidad del producto
     * (kg en los de peso). El carrito no deja pedir más. null = sin tope.
     */
    offerStock?: number | null;
    /**
     * Unidad de medida (Caja de 30, Bandeja de 15…). En estos renglones
     * `quantity` cuenta presentaciones y el precio es el fijo de la presentación:
     * sin escala, grupo de escala, oferta ni precio de socio. El id del renglón
     * es `presentationCartId(producto, presentación)`, así conviven con las
     * unidades sueltas del mismo producto en renglones separados.
     */
    presentation?: CartPresentation | null;
    /** Stock del producto en unidades al agregarlo: tope de presentaciones. */
    stock?: number | null;
    /** Item de sorteo: `raffle:<raffleId>:<number>`. Cantidad siempre 1 y reserva activa con expiresAt. */
    raffle?: {
        raffleId: string;
        raffleSlug: string;
        number: number;
        expiresAt: string;
    };
}

/** Detecta si un id corresponde a un número de sorteo */
export function isRaffleCartId(id: string): boolean {
    return id.startsWith('raffle:');
}

/**
 * Precio por escala para una cantidad: el del tramo más alto que alcanza, o el
 * base. Es la regla del servidor (`findPriceTier` en lib/product-price), que
 * también arregla las escalas mal cargadas.
 */
export function getTieredPrice(basePrice: number, priceTiers: PriceTier[] | undefined, quantity: number): number {
    return findPriceTier(priceTiers, quantity)?.price ?? basePrice;
}

/**
 * Precio unitario final, ya con tramos por cantidad y precio de suscriptor.
 *
 * Espejo exacto de `resolveUnitPrice` en lib/store-pricing.ts, que es lo que el
 * servidor cobra de verdad. Si las dos reglas se separan, el carrito muestra un
 * total y el checkout cobra otro — por eso el suscriptor paga acá también el
 * MENOR entre su precio de socio y el que le tocaría igual.
 *
 * Las APIs de producto solo mandan `subscriptionPrice` a quien tiene la
 * membresía activa, así que su sola presencia significa "este que mira es
 * suscriptor". No hace falta pasear el estado de la membresía por el front.
 */
export function getEffectivePrice(
    basePrice: number,
    priceTiers: PriceTier[] | undefined,
    quantity: number,
    subscriptionPrice?: number | null,
): number {
    const tiered = getTieredPrice(basePrice, priceTiers, quantity);
    if (!subscriptionPrice || subscriptionPrice <= 0) return tiered;
    return Math.min(tiered, subscriptionPrice);
}

/** True when the product is sold in kg but displayed as equivalent units */
export function hasEquiv(item: { equivLabel?: string | null; equivWeight?: number | null }): boolean {
    return Boolean(item.equivLabel && item.equivWeight && item.equivWeight > 0);
}

/**
 * Tope de una línea del carrito por oferta por stock, en la cantidad de esa
 * línea (piezas en los de unidad equivalente, kg en los de peso), o null si no
 * hay tope. El servidor hace cumplir lo mismo (offerCapError en lib/store-pricing).
 */
export function getOfferCartCap(item: Pick<CartItem, 'id' | 'unit' | 'equivLabel' | 'equivWeight' | 'offerStock'>): number | null {
    if (item.offerStock === null || item.offerStock === undefined) return null;
    if (hasEquiv(item) && !item.id.endsWith('__kg')) return Math.floor(item.offerStock / item.equivWeight! + 1e-6);
    if (isWeightUnit(item.unit) || item.id.endsWith('__kg')) return item.offerStock;
    return Math.floor(item.offerStock);
}

/** La línea ya llegó a lo que queda en oferta: no se puede sumar más. */
export function isAtOfferCap(item: CartItem): boolean {
    const cap = getOfferCartCap(item);
    return cap !== null && item.quantity >= cap - 1e-6;
}

function capByOffer(item: Pick<CartItem, 'id' | 'unit' | 'equivLabel' | 'equivWeight' | 'offerStock'>, quantity: number): number {
    const cap = getOfferCartCap(item);
    return cap === null ? quantity : Math.min(quantity, cap);
}

/** Unidades del producto que ocupa un renglón (cajas × unidades en los de presentación). */
export function cartLineUnits(item: Pick<CartItem, 'quantity' | 'presentation'>): number {
    return item.presentation ? item.quantity * item.presentation.units : item.quantity;
}

/**
 * Tope de un renglón por presentación: las cajas que caben en el stock que
 * dejan los otros renglones del mismo producto. null = sin tope (por unidad).
 * El servidor hace cumplir lo mismo (presentationStockError).
 */
export function getPresentationCap(item: CartItem, items: CartItem[]): number | null {
    if (!item.presentation || item.stock === null || item.stock === undefined) return null;
    const productId = cartLineProductId(item.id);
    const others = items
        .filter((other) => other.id !== item.id && cartLineProductId(other.id) === productId)
        .reduce((sum, other) => sum + cartLineUnits(other), 0);
    return maxPresentationBoxes(item.stock, item.presentation.units, others);
}

function capByPresentationStock(item: CartItem, quantity: number, items: CartItem[]): number {
    const cap = getPresentationCap(item, items);
    return cap === null ? quantity : Math.min(quantity, cap);
}

/** Los productos de la tienda por id, de a 100 (el tope de la API). */
async function fetchStoreProducts(ids: string[], signal: AbortSignal): Promise<Map<string, StoreProductPayload>> {
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
    const pages = await Promise.all(chunks.map(async (chunk) => {
        const res = await fetch(`/api/store/products?ids=${chunk.map(encodeURIComponent).join(',')}&limit=100`, { signal });
        if (!res.ok) return [];
        const json = await res.json();
        return Array.isArray(json?.data) ? (json.data as StoreProductPayload[]) : [];
    }));
    return new Map(pages.flat().map((p) => [p.id, p]));
}

/**
 * Renglón por unidad puesto al día con el precio, la escala, el grupo y la
 * oferta de hoy. El carrito guarda esos datos al agregar: si después cambian
 * (POSVECI corrige un tramo, se acaba una oferta), seguía mostrando los viejos
 * aunque el servidor cobre los nuevos. Igual que lo agrega la tarjeta.
 */
function refreshCartLine(item: CartItem, product: StoreProductPayload | undefined): CartItem {
    if (!product || isRaffleCartId(item.id) || item.presentation) return item;
    const hasOffer = Boolean(product.isOffer && product.offerPrice && product.offerPrice < product.price);
    const fresh: CartItem = {
        ...item,
        price: hasOffer ? product.offerPrice! : product.price,
        priceTiers: product.priceTiers ?? [],
        subscriptionPrice: product.subscriptionPrice ?? null,
        offerStock: hasOffer ? product.offerStock ?? null : null,
        // El renglón por kilo de un producto por unidad equivalente no lleva grupo.
        ...(item.id.endsWith('__kg') ? {} : { tierGroup: product.tierGroup ?? null }),
    };
    const quantity = capByOffer(fresh, item.quantity);
    return { ...fresh, quantity: quantity > 0 ? quantity : item.quantity };
}

interface CartContextValue {
    items: CartItem[];
    totalItems: number;
    subtotal: number;
    /**
     * Precio unitario del ítem tal como está en el carrito: con el tramo de
     * escala que le toca contando a los demás de su grupo, y precio de socio.
     * Es lo que cobra el servidor (lib/store-pricing), usar SIEMPRE esto.
     */
    getItemUnitPrice: (item: CartItem) => number;
    /** Cantidad con la que el ítem busca su tramo (la de su grupo entero). */
    getItemTierQuantity: (item: CartItem) => number;
    /** Unidades en el carrito de un grupo de escala (0 si no hay). */
    getGroupQuantity: (tierGroup?: string | null) => number;
    /** Cantidad de un renglón del carrito por su id (0 si no está). */
    getLineQuantity: (id: string) => number;
    /** Renglón por presentación que ya no tiene stock para otra caja. */
    isAtStockCap: (item: CartItem) => boolean;
    addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
    updateQuantity: (id: string, quantity: number) => void;
    removeItem: (id: string) => void;
    clearCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'miniveci_cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);

    useEffect(() => {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        let saved: CartItem[] = [];
        try {
            const parsed = JSON.parse(raw) as CartItem[];
            if (Array.isArray(parsed)) {
                saved = parsed.filter((item) => item?.id && item.quantity > 0);
                setItems(saved);
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }

        // Los renglones guardados se ponen al día con los precios y escalas de hoy.
        const ids = [...new Set(
            saved.filter((item) => !isRaffleCartId(item.id) && !item.presentation).map((item) => cartLineProductId(item.id)),
        )];
        if (ids.length === 0) return;
        const controller = new AbortController();
        fetchStoreProducts(ids, controller.signal)
            .then((fresh) => {
                if (fresh.size === 0) return;
                setItems((prev) => prev.map((item) => refreshCartLine(item, fresh.get(cartLineProductId(item.id)))));
            })
            .catch(() => {});
        return () => controller.abort();
    }, []);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }, [items]);

    const addItem = (item: Omit<CartItem, 'quantity'>, quantity?: number) => {
        if (isRaffleCartId(item.id)) {
            setItems((prev) => {
                if (prev.some((p) => p.id === item.id)) return prev;
                return [...prev, { ...item, quantity: 1 }];
            });
            return;
        }
        if (item.presentation) {
            // Presentaciones enteras, sin pasarse del stock del producto.
            const boxes = Math.max(1, Math.round(quantity ?? 1));
            setItems((prev) => {
                const existing = prev.find((p) => p.id === item.id);
                if (existing) {
                    // Precio y stock más nuevos que los guardados.
                    const fresh = { ...existing, price: item.price, presentation: item.presentation, stock: item.stock ?? null };
                    const next = capByPresentationStock(fresh, existing.quantity + boxes, prev);
                    return prev.map((p) => (p.id === item.id ? { ...fresh, quantity: Math.max(next, 1) } : p));
                }
                const line = { ...item, quantity: boxes } as CartItem;
                const next = capByPresentationStock(line, boxes, prev);
                if (next <= 0) return prev;
                return [...prev, { ...line, quantity: next }];
            });
            return;
        }
        const equiv = hasEquiv(item);
        const isWeight = !equiv && isWeightUnit(item.unit);
        const isKgDirect = !equiv && item.id.endsWith('__kg');
        const minQty = (isWeight || isKgDirect) ? 0.5 : 1;
        const safeQuantity = equiv
            ? Math.max(1, Math.round(quantity ?? 1))
            : Math.max(minQty, quantity ?? minQty);
        setItems((prev) => {
            const existing = prev.find((p) => p.id === item.id);
            if (existing) {
                // Precio, escala y stock en oferta que llegan ahora son más nuevos que los guardados.
                const fresh: CartItem = {
                    ...existing,
                    price: item.price,
                    priceTiers: item.priceTiers,
                    tierGroup: item.tierGroup,
                    subscriptionPrice: item.subscriptionPrice,
                    offerStock: item.offerStock ?? null,
                };
                const quantity = capByOffer(fresh, equiv ? existing.quantity + safeQuantity : round2(existing.quantity + safeQuantity));
                return prev.map((p) => (p.id === item.id ? { ...fresh, quantity } : p));
            }
            const quantity = capByOffer(item, safeQuantity);
            if (quantity <= 0) return prev;
            return [...prev, { ...item, quantity }];
        });
    };

    const updateQuantity = (id: string, quantity: number) => {
        if (isRaffleCartId(id)) {
            if (quantity < 1) removeItem(id);
            return; // No se puede cambiar la cantidad de un número de sorteo
        }
        const item = items.find((i) => i.id === id);
        if (item?.presentation) {
            if (quantity < 1) {
                removeItem(id);
                return;
            }
            setItems((prev) => prev.map((p) => (
                p.id === id ? { ...p, quantity: Math.max(1, capByPresentationStock(p, Math.round(quantity), prev)) } : p
            )));
            return;
        }
        const equiv = item ? hasEquiv(item) : false;
        const isWeight = !equiv && isWeightUnit(item?.unit);
        const isKgDirect = !equiv && id.endsWith('__kg');
        const minQty = (isWeight || isKgDirect) ? 0.5 : (equiv ? 1 : 1);
        if (quantity < minQty) {
            removeItem(id);
            return;
        }
        const safeQuantity = equiv ? Math.max(1, Math.round(quantity)) : round2(Math.max(minQty, quantity));
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: capByOffer(item, safeQuantity) } : item)));
    };

    const removeItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    const clearCart = () => setItems([]);

    // Cantidad de tramo por ítem: los del mismo grupo de escala suman entre sí.
    // Los sorteos y las presentaciones (precio fijo) no participan.
    const tierQtyById = useMemo(() => {
        const lines = items.filter((item) => !isRaffleCartId(item.id) && !item.id.endsWith('__kg') && !item.presentation);
        const qty = tierQuantities(lines);
        return new Map(lines.map((item, i) => [item.id, qty[i]]));
    }, [items]);

    const getItemTierQuantity = useCallback(
        (item: CartItem) => tierQtyById.get(item.id) ?? item.quantity,
        [tierQtyById],
    );

    // En un renglón por presentación es el precio de la presentación entera
    // (`quantity` cuenta presentaciones), igual que lo cobra el servidor.
    const getItemUnitPrice = useCallback(
        (item: CartItem) => item.presentation
            ? item.presentation.price
            : getEffectivePrice(item.price, item.priceTiers, getItemTierQuantity(item), item.subscriptionPrice),
        [getItemTierQuantity],
    );

    const getGroupQuantity = useCallback((tierGroup?: string | null) => {
        const key = tierGroupKey(tierGroup);
        if (!key) return 0;
        return items.reduce((sum, item) => (
            tierGroupKey(item.tierGroup) === key && !item.presentation && !hasEquiv(item) && !isWeightUnit(item.unit) ? sum + item.quantity : sum
        ), 0);
    }, [items]);

    const getLineQuantity = useCallback(
        (id: string) => items.find((item) => item.id === id)?.quantity ?? 0,
        [items],
    );

    const isAtStockCap = useCallback((item: CartItem) => {
        const cap = getPresentationCap(item, items);
        return cap !== null && item.quantity >= cap;
    }, [items]);

    const value = useMemo<CartContextValue>(() => {
        const totalItems = items.length;
        const subtotal = items.reduce((sum, item) => {
            const effectivePrice = getItemUnitPrice(item);
            if (hasEquiv(item)) {
                // precio por kg × peso unitario × cantidad de unidades
                return sum + Math.round(effectivePrice * item.equivWeight! * item.quantity);
            }
            return sum + effectivePrice * item.quantity;
        }, 0);
        return { items, totalItems, subtotal, getItemUnitPrice, getItemTierQuantity, getGroupQuantity, getLineQuantity, isAtStockCap, addItem, updateQuantity, removeItem, clearCart };
    }, [items, getItemUnitPrice, getItemTierQuantity, getGroupQuantity, getLineQuantity, isAtStockCap]);

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart debe usarse dentro de CartProvider');
    }
    return context;
}
