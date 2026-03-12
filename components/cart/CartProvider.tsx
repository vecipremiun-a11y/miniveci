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

export interface CartItem {
    id: string;
    name: string;
    price: number;
    image?: string | null;
    slug?: string;
    unit?: string;
    quantity: number;
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
        const isWeight = isWeightUnit(item.unit);
        const minQty = isWeight ? 0.1 : 1;
        const safeQuantity = Math.max(minQty, quantity ?? minQty);
        setItems((prev) => {
            const existing = prev.find((p) => p.id === item.id);
            if (existing) {
                return prev.map((p) =>
                    p.id === item.id
                        ? { ...p, quantity: round2(p.quantity + safeQuantity) }
                        : p
                );
            }
            return [...prev, { ...item, quantity: safeQuantity }];
        });
    };

    const updateQuantity = (id: string, quantity: number) => {
        const item = items.find((i) => i.id === id);
        const isWeight = isWeightUnit(item?.unit);
        const minQty = isWeight ? 0.1 : 1;
        if (quantity < minQty) {
            removeItem(id);
            return;
        }
        const safeQuantity = round2(Math.max(minQty, quantity));
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: safeQuantity } : item)));
    };

    const removeItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    const clearCart = () => setItems([]);

    const value = useMemo<CartContextValue>(() => {
        const totalItems = items.length;
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
