'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

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
    /** Precio de socio, solo presente si quien compra tiene la membresía activa. */
    subscriptionPrice?: number | null;
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

/** Returns the effective unit price for a given quantity based on price tiers */
export function getTieredPrice(basePrice: number, priceTiers: PriceTier[] | undefined, quantity: number): number {
    if (!priceTiers || priceTiers.length === 0) return basePrice;
    const tier = priceTiers.find(t =>
        quantity >= t.minQty && (t.maxQty === null || quantity <= t.maxQty)
    );
    return tier ? tier.price : basePrice;
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

interface CartContextValue {
    items: CartItem[];
    totalItems: number;
    subtotal: number;
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

        try {
            const parsed = JSON.parse(raw) as CartItem[];
            if (Array.isArray(parsed)) {
                setItems(parsed.filter((item) => item?.id && item.quantity > 0));
            }
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
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
                return prev.map((p) =>
                    p.id === item.id
                        ? { ...p, quantity: equiv ? p.quantity + safeQuantity : round2(p.quantity + safeQuantity) }
                        : p
                );
            }
            return [...prev, { ...item, quantity: safeQuantity }];
        });
    };

    const updateQuantity = (id: string, quantity: number) => {
        if (isRaffleCartId(id)) {
            if (quantity < 1) removeItem(id);
            return; // No se puede cambiar la cantidad de un número de sorteo
        }
        const item = items.find((i) => i.id === id);
        const equiv = item ? hasEquiv(item) : false;
        const isWeight = !equiv && isWeightUnit(item?.unit);
        const isKgDirect = !equiv && id.endsWith('__kg');
        const minQty = (isWeight || isKgDirect) ? 0.5 : (equiv ? 1 : 1);
        if (quantity < minQty) {
            removeItem(id);
            return;
        }
        const safeQuantity = equiv ? Math.max(1, Math.round(quantity)) : round2(Math.max(minQty, quantity));
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: safeQuantity } : item)));
    };

    const removeItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    const clearCart = () => setItems([]);

    const value = useMemo<CartContextValue>(() => {
        const totalItems = items.length;
        const subtotal = items.reduce((sum, item) => {
            const effectivePrice = getEffectivePrice(item.price, item.priceTiers, item.quantity, item.subscriptionPrice);
            if (hasEquiv(item)) {
                // precio por kg × peso unitario × cantidad de unidades
                return sum + Math.round(effectivePrice * item.equivWeight! * item.quantity);
            }
            return sum + effectivePrice * item.quantity;
        }, 0);
        return { items, totalItems, subtotal, addItem, updateQuantity, removeItem, clearCart };
    }, [items]);

    return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart debe usarse dentro de CartProvider');
    }
    return context;
}
