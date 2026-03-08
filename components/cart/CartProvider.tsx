'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export interface CartItem {
    id: string;
    name: string;
    price: number;
    image?: string | null;
    slug?: string;
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

    const addItem = (item: Omit<CartItem, 'quantity'>, quantity = 1) => {
        const safeQuantity = Math.max(1, quantity);
        setItems((prev) => {
            const existing = prev.find((p) => p.id === item.id);
            if (existing) {
                return prev.map((p) =>
                    p.id === item.id
                        ? { ...p, quantity: p.quantity + safeQuantity }
                        : p
                );
            }
            return [...prev, { ...item, quantity: safeQuantity }];
        });
    };

    const updateQuantity = (id: string, quantity: number) => {
        const safeQuantity = Math.max(1, quantity);
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, quantity: safeQuantity } : item)));
    };

    const removeItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    const clearCart = () => setItems([]);

    const value = useMemo<CartContextValue>(() => {
        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
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
